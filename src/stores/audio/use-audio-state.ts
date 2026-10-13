import { useSyncExternalStore } from "react";
import { useStores } from "../stores-context";

export function useAudioState() {
	const { audioStore } = useStores();
	return useSyncExternalStore(
		audioStore.subscribe,
		audioStore.getSnapshot,
		audioStore.getServerSnapshot,
	);
}
