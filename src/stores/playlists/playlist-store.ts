import type { Database, DBStore } from "../../database/types";
import type { Playlist } from "./types";

/** Owns local playlists; publish edits only after persistence commits. */
export class PlaylistStore {
	private playlists = new Map<string, Playlist>();
	private snapshot: readonly Playlist[] = Object.freeze([]);
	private listeners = new Set<() => void>();
	private objectStore: DBStore<Playlist, string>;
	private initialization: Promise<void> | undefined;
	private saving: Promise<void> = Promise.resolve();

	constructor({ database }: { database: Database }) {
		this.objectStore = database.getObjectStore("playlists");
	}

	/** Loads local data independently of catalog initialization. */
	initialize(): Promise<void> {
		this.initialization ??= this.objectStore
			.getAll()
			.then((playlists) => {
				this.playlists = new Map(
					playlists.map((playlist) => [playlist.id, structuredClone(playlist)]),
				);
				this.notify();
			})
			.catch((error: unknown) => {
				this.initialization = undefined;
				throw error;
			});
		return this.initialization;
	}

	get({ playlistId }: { playlistId: string }): Playlist | undefined {
		return this.playlists.get(playlistId);
	}

	/** Reuse the frozen snapshot; callers choose presentation order. */
	getAll(): readonly Playlist[] {
		return this.snapshot;
	}

	getSnapshot = (): readonly Playlist[] => this.snapshot;

	subscribe({ listener }: { listener: () => void }): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private notify(): void {
		const snapshot = [...this.playlists.values()];
		// Freeze once when publishing so reads can safely share the stored records.
		for (const playlist of snapshot) {
			for (const entry of playlist.shows) {
				Object.freeze(entry);
			}
			Object.freeze(playlist.shows);
			Object.freeze(playlist);
		}
		this.snapshot = Object.freeze(snapshot);
		for (const listener of this.listeners) {
			listener();
		}
	}

	/** Creates a UUID and timestamps; returns the committed playlist. */
	create({ title }: { title: string }): Promise<Playlist> {
		return this.enqueue({
			operation: async () => {
				const normalizedTitle = title.trim();
				if (!normalizedTitle) {
					throw new Error("Playlist title cannot be blank");
				}
				const now = new Date().toISOString();
				const playlist: Playlist = {
					id: crypto.randomUUID(),
					type: "user",
					title: normalizedTitle,
					createdAt: now,
					updatedAt: now,
					shows: [],
				};
				await this.objectStore.set(playlist);
				this.playlists.set(playlist.id, playlist);
				this.notify();
				return playlist;
			},
		});
	}

	rename({
		playlistId,
		title,
	}: {
		playlistId: string;
		title: string;
	}): Promise<void> {
		return this.enqueue({
			operation: async () => {
				const playlist = this.requirePlaylist({ playlistId });
				const normalizedTitle = title.trim();
				if (!normalizedTitle) {
					throw new Error("Playlist title cannot be blank");
				}
				if (playlist.title === normalizedTitle) {
					return;
				}
				const updated: Playlist = {
					...playlist,
					title: normalizedTitle,
					updatedAt: new Date().toISOString(),
				};
				await this.objectStore.set(updated);
				this.playlists.set(playlistId, updated);
				this.notify();
			},
		});
	}

	delete({ playlistId }: { playlistId: string }): Promise<void> {
		return this.enqueue({
			operation: async () => {
				this.requirePlaylist({ playlistId });
				await this.objectStore.delete(playlistId);
				this.playlists.delete(playlistId);
				this.notify();
			},
		});
	}

	private requirePlaylist({ playlistId }: { playlistId: string }): Playlist {
		const playlist = this.playlists.get(playlistId);
		if (!playlist) {
			throw new Error(`Playlist not found: ${playlistId}`);
		}
		return playlist;
	}

	/**
	 * Run mutations in call order after initialization so each reads the latest
	 * committed state. Each operation must persist before publishing its changes.
	 * Return its result or rejection to the caller; failures do not block later work.
	 */
	private enqueue<T>({
		operation,
	}: {
		operation: () => Promise<T>;
	}): Promise<T> {
		const save = this.saving.then(async () => {
			await this.initialize();
			return operation();
		});
		// Recover the queue after failure while preserving rejection for the caller.
		this.saving = save.then(
			() => {},
			() => {},
		);
		return save;
	}

	/** Appends a show reference; duplicate additions reject. */
	addShow({
		playlistId,
		showId,
	}: {
		playlistId: string;
		showId: number;
	}): Promise<void> {
		return this.enqueue({
			operation: async () => {
				const playlist = this.requirePlaylist({ playlistId });
				if (!Number.isSafeInteger(showId) || showId < 0) {
					throw new Error("Invalid show ID");
				}
				if (playlist.shows.some((entry) => entry.showId === showId)) {
					throw new Error(`Show already in playlist: ${showId}`);
				}
				await this.saveEntries({
					playlist,
					shows: [
						...playlist.shows,
						{ showId, addedAt: new Date().toISOString() },
					],
				});
			},
		});
	}

	removeShow({
		playlistId,
		showId,
	}: {
		playlistId: string;
		showId: number;
	}): Promise<void> {
		return this.enqueue({
			operation: async () => {
				const playlist = this.requirePlaylist({ playlistId });
				if (!playlist.shows.some((entry) => entry.showId === showId)) {
					throw new Error(`Show not in playlist: ${showId}`);
				}
				await this.saveEntries({
					playlist,
					shows: playlist.shows.filter((entry) => entry.showId !== showId),
				});
			},
		});
	}

	/** Preserve note text; undefined removes the note property. */
	setNote({
		playlistId,
		showId,
		note,
	}: {
		playlistId: string;
		showId: number;
		note: string | undefined;
	}): Promise<void> {
		return this.enqueue({
			operation: async () => {
				const playlist = this.requirePlaylist({ playlistId });
				const entry = playlist.shows.find((entry) => entry.showId === showId);
				if (!entry) {
					throw new Error(`Show not in playlist: ${showId}`);
				}
				if (entry.note === note) {
					return;
				}
				const updated = { ...entry };
				if (note === undefined) {
					delete updated.note;
				} else {
					updated.note = note;
				}
				await this.saveEntries({
					playlist,
					shows: playlist.shows.map((entry) =>
						entry.showId === showId ? updated : entry,
					),
				});
			},
		});
	}

	/** Called inside the mutation queue; never change a published playlist in place. */
	private async saveEntries({
		playlist,
		shows,
	}: {
		playlist: Playlist;
		shows: Playlist["shows"];
	}): Promise<void> {
		const updated: Playlist = {
			...playlist,
			shows,
			updatedAt: new Date().toISOString(),
		};
		await this.objectStore.set(updated);
		this.playlists.set(playlist.id, updated);
		this.notify();
	}
}
