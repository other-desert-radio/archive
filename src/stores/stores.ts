import { createIndexedDB } from "../database/indexed-db";
import type { Database } from "../database/types";
import { AudioStore } from "./audio/audio-store";
import { PlaybackStore } from "./playback/playback-store";
import { PlaylistStore } from "./playlists/playlist-store";
import { SearchHistoryStore } from "./search-history-store";
import { ShowStore } from "./shows/show-store";
import { TagStore } from "./tags/tag-store";
import { VersionsStore } from "./versions/versions-store";

export type Stores = {
	searchHistoryStore: SearchHistoryStore;
	audioStore: AudioStore;
	playbackStore: PlaybackStore;
	playlistStore: PlaylistStore;
	showStore: ShowStore;
	tagStore: TagStore;
	versionsStore: VersionsStore;
	initialize(): Promise<void>;
};

export function createStores(database: Database = createIndexedDB()): Stores {
	const versionsStore = new VersionsStore(database);
	const showStore = new ShowStore(database, versionsStore);
	const tagStore = new TagStore(database, versionsStore);
	let initialization: Promise<void> | undefined;
	return {
		searchHistoryStore: new SearchHistoryStore(database),
		audioStore: new AudioStore(),
		playbackStore: new PlaybackStore(database),
		playlistStore: new PlaylistStore({ database }),
		showStore,
		tagStore,
		versionsStore,
		initialize() {
			initialization ??= versionsStore
				.initialize()
				.then(() => showStore.initialize())
				.then(() => tagStore.initialize())
				.catch((error: unknown) => {
					initialization = undefined;
					versionsStore.invalidatePublished();
					throw error;
				});
			return initialization;
		},
	};
}

// Construction is safe during SSR; browser effects initialize the shared stores.
// One shared set per browser module graph, retained across ClientRouter navigation.
export const stores = createStores();
