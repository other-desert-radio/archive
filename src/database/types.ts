import type { PlaybackRecord } from "../stores/playback/types";
import type { Playlist } from "../stores/playlists/types";
import type { Show } from "../utils/fetch-shows";

import type { Tag } from "../utils/fetch-tags";

export type StoreSchema = {
	// local user playlists; independent of published catalog revisions
	playlists: { value: Playlist; key: string };

	// playback history
	playback: { value: PlaybackRecord; key: number };

	// local cache of shows
	shows: { value: Show; key: number };
	// local cache of tags
	tags: { value: Tag; key: number };
	// local cache of data_versions.json
	metadata: { value: { key: string; revision: number }; key: string };
};

export type StoreName = keyof StoreSchema;

export type TransactionOperation = {
	[N in StoreName]:
		| { store: N; action: "clear" }
		| { store: N; action: "set"; value: StoreSchema[N]["value"] }
		| { store: N; action: "delete"; key: StoreSchema[N]["key"] };
}[StoreName];

export type Database = {
	// Check and insert within one transaction, preserving any existing liked playlist.
	ensureLikedPlaylist({
		fallback,
	}: {
		fallback: Playlist & { type: "liked" };
	}): Promise<void>;
	getObjectStore<N extends StoreName>(
		name: N,
	): DBStore<StoreSchema[N]["value"], StoreSchema[N]["key"]>;
	// Commit the batch in order, or roll it all back; resolve only after commit.
	transaction(operations: TransactionOperation[]): Promise<void>;
};

export type DBStore<T, K> = {
	get(key: K): Promise<T | undefined>;
	getAll(): Promise<T[]>;
	set(value: T): Promise<void>;
	delete(key: K): Promise<void>;
};
