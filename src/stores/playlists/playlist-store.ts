import type { Database } from "../../database/types";
import type { Playlist } from "./types";

/** Owns local playlists; publish edits only after persistence commits. */
export class PlaylistStore {
	constructor(_options: { database: Database }) {
		throw new Error("Not implemented");
	}

	/** Loads local data independently of catalog initialization. */
	initialize(): Promise<void> {
		throw new Error("Not implemented");
	}

	get(_options: { playlistId: string }): Playlist | undefined {
		throw new Error("Not implemented");
	}

	getAll(): Playlist[] {
		throw new Error("Not implemented");
	}

	getSnapshot = (): readonly Playlist[] => {
		throw new Error("Not implemented");
	};

	subscribe(_options: { listener: () => void }): () => void {
		throw new Error("Not implemented");
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
