import { createIndexedDB } from "../database/indexed-db";
import type { Database } from "../database/types";
import { AudioStore } from "./audio/audio-store";
import { ShowStore } from "./shows/show-store";
import { VersionsStore } from "./versions/versions-store";

export type Stores = {
	audioStore: AudioStore;
	showStore: ShowStore;
	versionsStore: VersionsStore;
	initialize(): Promise<void>;
};

export function createStores(database: Database = createIndexedDB()): Stores {
	const versionsStore = new VersionsStore(database);
	const showStore = new ShowStore(database, versionsStore);
	let initialization: Promise<void> | undefined;
	return {
		audioStore: new AudioStore(),
		showStore,
		versionsStore,
		initialize() {
			initialization ??= versionsStore
				.initialize()
				.then(() => showStore.initialize())
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
