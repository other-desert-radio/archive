import { AudioStore } from "./audio/audio-store";
import { ShowStore } from "./shows/show-store";

export type Stores = {
	audioStore: AudioStore;
	showStore: ShowStore;
};

export function createStores(): Stores {
	return { audioStore: new AudioStore(), showStore: new ShowStore() };
}

// One shared set per browser module graph, retained across ClientRouter navigation.
export const stores = createStores();
