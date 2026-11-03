import type { Database, DBStore } from "../../database/types";
import type { PlaybackRecord, PlaybackSession } from "./types";

/** Owns local history; the adapter supplies confirmed playback events. */
export class PlaybackStore {
	private records = new Map<number, PlaybackRecord>();
	private pending = new Map<number, PlaybackRecord>();
	private listeners = new Set<() => void>();
	private objectStore: DBStore<PlaybackRecord, number>;
	private initialization: Promise<void> | undefined;
	private saving: Promise<void> = Promise.resolve();
	private active:
		| {
				record: PlaybackRecord;
				session: PlaybackSession;
				tick: number | undefined;
				checkpoint: number;
		  }
		| undefined;

	constructor(
		private readonly database: Database,
		private readonly clock = {
			now: () => Date.now(),
			monotonic: () => performance.now(),
		},
	) {
		this.objectStore = database.getObjectStore("playback");
	}

	/** Load local records independently of catalog refresh; share concurrent reads. */
	initialize(): Promise<void> {
		this.initialization ??= this.objectStore
			.getAll()
			.then(async (records) => {
				let recovered = false;
				for (const record of records) {
					// A pending local update takes precedence over a slow initial read.
					if (!this.records.has(record.showId)) {
						for (const session of record.history) {
							if (session.endedAt === undefined) {
								session.endedAt = session.updatedAt;
								this.pending.set(record.showId, record);
								recovered = true;
							}
						}
						this.records.set(record.showId, record);
					}
				}
				this.notify();
				if (recovered) {
					await this.flush();
				}
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
	progress(showId: number, positionInSeconds: number): Promise<void> {
		if (
			!Number.isSafeInteger(showId) ||
			showId < 0 ||
			!Number.isFinite(positionInSeconds) ||
			positionInSeconds < 0
		) {
			return Promise.reject(new Error("Invalid playback progress"));
		}
		if (this.active && this.active.record.showId !== showId) {
			// Commit both the old session closure and the new show's checkpoint together.
			this.accountTime();
			this.active.session.endedAt = this.clock.now();
			this.checkpoint();
			this.active = undefined;
		}
		const tick = this.clock.monotonic();
		if (!this.active) {
			const now = this.clock.now();
			const record = this.get(showId) ?? {
				showId,
				inProgress: true,
				positionInSeconds,
				history: [],
			};
			const session: PlaybackSession = {
				startedAt: now,
				updatedAt: now,
				startPosition: positionInSeconds,
				endPosition: positionInSeconds,
				playedSeconds: 0,
			};
			record.inProgress = true;
			record.positionInSeconds = positionInSeconds;
			record.history.push(session);
			this.active = { record, session, tick, checkpoint: tick };
			console.log("[PlaybackStore] New session started", {
				showId,
				session: { ...session },
			});
			this.checkpoint();
			return this.flush();
		}
		if (positionInSeconds === this.active.record.positionInSeconds) {
			// A stationary progress report is not evidence of continued playback.
			this.active.tick = undefined;
			return Promise.resolve();
		}
		this.accountTime();
		this.active.tick = tick;
		this.active.record.positionInSeconds = positionInSeconds;
		this.active.session.endPosition = positionInSeconds;
		this.checkpoint();
		if (tick - this.active.checkpoint >= 5000) {
			this.active.checkpoint = tick;
			return this.flush();
		}
		return Promise.resolve();
	}

	/** Pause, buffering, or error stops timing without ending the session. */
	suspend(): Promise<void> {
		if (this.active) {
			this.accountTime();
			this.active.tick = undefined;
			this.checkpoint();
		}
		return this.flush();
	}

	/** Close the active session; only natural completion clears resume progress. */
	end(completed: boolean): Promise<void> {
		if (this.active) {
			this.accountTime();
			this.active.session.endedAt = this.clock.now();
			if (completed) {
				this.active.record.inProgress = false;
			}
			this.checkpoint();
			this.active = undefined;
		}
		return this.flush();
	}

	private accountTime(): void {
		if (this.active?.tick !== undefined) {
			const now = this.clock.monotonic();
			this.active.session.playedSeconds +=
				Math.max(0, now - this.active.tick) / 1000;
			this.active.tick = now;
		}
	}

	private checkpoint(): void {
		if (this.active) {
			this.active.session.updatedAt = this.clock.now();
			this.set(this.active.record);
		}
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
