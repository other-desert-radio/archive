import type { Database, DBStore } from "../../database/types";
import type { PlaybackRecord } from "./types";

/** Owns local history; the adapter supplies confirmed playback events. */
export class PlaybackStore {
	private records = new Map<number, PlaybackRecord>();
	private snapshot: readonly PlaybackRecord[] = [];
	private pending = new Map<number, PlaybackRecord>();
	private listeners = new Set<() => void>();
	private objectStore: DBStore<PlaybackRecord, number>;
	private initialization: Promise<void> | undefined;
	private saving: Promise<void> = Promise.resolve();
	private lastCheckpoint = 0;

	constructor(
		private readonly database: Database,
		private readonly clock = {
			now: () => Date.now(),
		},
	) {
		this.objectStore = database.getObjectStore("playback");
	}

	/** Load local records independently of catalog refresh; share concurrent reads. */
	initialize(): Promise<void> {
		this.initialization ??= this.objectStore
			.getAll()
			.then((records) => {
				for (const record of records) {
					// A local update takes precedence over a slow initial read.
					if (!this.records.has(record.showId)) {
						this.records.set(record.showId, record);
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

	/** React snapshots retain their identity until records change. */
	getSnapshot = (): readonly PlaybackRecord[] => this.snapshot;

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
		this.snapshot = this.getAll();
		for (const listener of this.listeners) {
			listener();
		}
	}

	/** Create or reuse the latest unfinished listen and save its progress. */
	progress(showId: number, positionInSeconds: number): Promise<void> {
		if (
			!Number.isSafeInteger(showId) ||
			showId < 0 ||
			!Number.isFinite(positionInSeconds) ||
			positionInSeconds < 0
		) {
			return Promise.reject(new Error("Invalid playback progress"));
		}
		const now = this.clock.now();
		const record = this.get(showId) ?? {
			showId,
			inProgress: false,
			positionInSeconds,
			history: [],
		};
		let session = record.inProgress ? record.history.at(-1) : undefined;
		const isNew = !session || session.completedAt !== undefined;
		if (!session || session.completedAt !== undefined) {
			session = {
				startedAt: now,
				updatedAt: now,
				startPosition: positionInSeconds,
				endPosition: positionInSeconds,
			};
			record.history.push(session);
			console.log("[PlaybackStore] New session started", {
				showId,
				session: { ...session },
			});
		}
		session.updatedAt = now;
		session.endPosition = positionInSeconds;
		record.inProgress = true;
		record.positionInSeconds = positionInSeconds;
		this.set(record);
		if (isNew || now - this.lastCheckpoint >= 5000) {
			return this.flush();
		}
		return Promise.resolve();
	}

	/** Complete the latest unfinished listen once; interruptions only call flush. */
	complete(showId: number): Promise<void> {
		const record = this.get(showId);
		const session = record?.history.at(-1);
		if (record?.inProgress && session && session.completedAt === undefined) {
			session.completedAt = this.clock.now();
			session.updatedAt = session.completedAt;
			record.inProgress = false;
			this.set(record);
		}
		return this.flush();
	}

	/** Serialize pending saves; reject on failure so the owner can report it. */
	flush(): Promise<void> {
		this.lastCheckpoint = this.clock.now();
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
