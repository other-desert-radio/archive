import type { Database, DBStore } from "../../database/types";
import type { Playlist } from "./types";

/** Owns local playlists; publish edits only after persistence commits. */
export class PlaylistStore {
	private playlists = new Map<string, Playlist>();
	private snapshot: readonly Playlist[] = Object.freeze([]);
	private listeners = new Set<() => void>();
	private objectStore: DBStore<Playlist, string>;
	private initialization: Promise<void> | undefined;

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
	create(_options: { title: string }): Promise<Playlist> {
		throw new Error("Not implemented");
	}

	rename(_options: { playlistId: string; title: string }): Promise<void> {
		throw new Error("Not implemented");
	}

	delete(_options: { playlistId: string }): Promise<void> {
		throw new Error("Not implemented");
	}

	/** Appends a show reference; duplicate additions reject. */
	addShow(_options: { playlistId: string; showId: number }): Promise<void> {
		throw new Error("Not implemented");
	}

	removeShow(_options: { playlistId: string; showId: number }): Promise<void> {
		throw new Error("Not implemented");
	}

	setNote(_options: {
		playlistId: string;
		showId: number;
		note: string | undefined;
	}): Promise<void> {
		throw new Error("Not implemented");
	}
}
