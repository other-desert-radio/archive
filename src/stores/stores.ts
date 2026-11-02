import { createIndexedDB } from "../database/indexed-db";
import type { Database } from "../database/types";
import { AudioStore } from "./audio/audio-store";
import { ShowStore } from "./shows/show-store";

export type Stores = {
	audioStore: AudioStore;
	showStore: ShowStore;
	initialize(): Promise<void>;
};

export function createStores(database: Database = createIndexedDB()): Stores {
	const showStore = new ShowStore(database);
	let initialization: Promise<void> | undefined;
	return {
		audioStore: new AudioStore(),
		showStore,
		initialize() {
			initialization ??= database
				.getObjectStore("metadata")
				.get("shows")
				.then((cachedMetadata) => showStore.initialize(cachedMetadata))
				.catch((error: unknown) => {
					initialization = undefined;
					throw error;
				});
			return initialization;
		},
	};
}

// Construction is safe during SSR; browser effects initialize the shared stores.
// One shared set per browser module graph, retained across ClientRouter navigation.
export const stores = createStores();
