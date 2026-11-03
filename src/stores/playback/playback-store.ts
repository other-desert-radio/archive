import type { Database } from "../../database/types";
import type { PlaybackRecord } from "./types";

/** Owns local history; the adapter supplies confirmed playback events. */
export class PlaybackStore {
	// Store composition will supply the database when integration is implemented.
	constructor(_database: Database) {}

	/** Load records independently of catalog refresh and recover open sessions. */
	async initialize(): Promise<void> {
		throw new Error("Not implemented");
	}

	/** Synchronous resume lookup after initialization. */
	get(_showId: number): PlaybackRecord | undefined {
		throw new Error("Not implemented");
	}

	/** Supply records for future history/progress rows. */
	getAll(): PlaybackRecord[] {
		throw new Error("Not implemented");
	}

	/** Notify consumers when in-memory records change; return cleanup. */
	subscribe(_notify: () => void): () => void {
		throw new Error("Not implemented");
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
	async flush(): Promise<void> {
		throw new Error("Not implemented");
	}
}
