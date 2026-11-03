import type { Database, DBStore } from "../../database/types";
import type { PlaybackRecord } from "./types";

/** Owns local history; the adapter supplies confirmed playback events. */
export class PlaybackStore {
	private records = new Map<number, PlaybackRecord>();
	private pending = new Map<number, PlaybackRecord>();
	private listeners = new Set<() => void>();
	private objectStore: DBStore<PlaybackRecord, number>;
	private initialization: Promise<void> | undefined;
	private saving: Promise<void> = Promise.resolve();

	constructor(private readonly database: Database) {
		this.objectStore = database.getObjectStore("playback");
	}

	/** Load local records independently of catalog refresh; share concurrent reads. */
	initialize(): Promise<void> {
		this.initialization ??= this.objectStore
			.getAll()
			.then((records) => {
				for (const record of records) {
					// A pending local update takes precedence over a slow initial read.
					if (!this.records.has(record.showId)) {
						this.records.set(record.showId, structuredClone(record));
					}
				}
				this.notify();
			})
			.catch((error: unknown) => {
				this.initialization = undefined;
				throw error;
			});
		return this.initialization;
	}

	/** Synchronous resume lookup after initialization. */
	get(showId: number): PlaybackRecord | undefined {
		const record = this.records.get(showId);
		return record === undefined ? undefined : structuredClone(record);
	}

	/** Supply records for future history/progress rows. */
	getAll(): PlaybackRecord[] {
		return structuredClone([...this.records.values()]);
	}

	/** Notify consumers when in-memory records change; return cleanup. */
	subscribe(notify: () => void): () => void {
		this.listeners.add(notify);
		return () => {
			this.listeners.delete(notify);
		};
	}

	/** Update memory immediately; flush persists a snapshot of pending records. */
	set(record: PlaybackRecord): void {
		const snapshot = structuredClone(record);
		this.records.set(snapshot.showId, snapshot);
		this.pending.set(snapshot.showId, snapshot);
		this.notify();
	}

	private notify(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}

	/** Advancing widget progress starts/resumes timing and updates position. */
	progress(_showId: number, _positionInSeconds: number): void {
		throw new Error("Not implemented");
	}

	/** Pause, buffering, or error stops timing without ending the session. */
	suspend(): void {
		throw new Error("Not implemented");
	}

	/** Close the active session; only natural completion clears resume progress. */
	end(_completed: boolean): void {
		throw new Error("Not implemented");
	}

	/** Serialize pending saves; reject on failure so the owner can report it. */
	flush(): Promise<void> {
		const save = this.saving.then(async () => {
			const records = [...this.pending.values()];
			if (records.length === 0) {
				return;
			}
			await this.database.transaction(
				records.map((record) => ({
					store: "playback",
					action: "set",
					value: structuredClone(record),
				})),
			);
			for (const record of records) {
				if (this.pending.get(record.showId) === record) {
					this.pending.delete(record.showId);
				}
			}
		});
		// Keep the queue usable after failure; the caller still receives rejection.
		this.saving = save.catch(() => {});
		return save;
	}
}
