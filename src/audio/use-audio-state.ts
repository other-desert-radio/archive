import { useSyncExternalStore } from "react";
import { audioStore } from "./audio-store";

export function useAudioState() {
	return useSyncExternalStore(
		audioStore.subscribe,
		audioStore.getSnapshot,
		audioStore.getServerSnapshot,
	);
}
