import { AudioStore } from "./audio/audio-store";

export type Stores = {
	audioStore: AudioStore;
};

export function createStores(): Stores {
	return { audioStore: new AudioStore() };
}

// One shared set per browser module graph, retained across ClientRouter navigation.
export const stores = createStores();
