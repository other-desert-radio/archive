import { useCallback, useSyncExternalStore } from "react";
import { useInitialization } from "../../hooks/useInitialization";
import { type Playlist, useStores } from "../../stores";

const emptyPlaylists: readonly Playlist[] = [];

/** Loads local playlists independently of the catalog and subscribes to store changes.
 * Returns the current playlist snapshot and its loading, ready, or error status.
 */
export function usePlaylists() {
	const { playlistStore } = useStores();
	const status = useInitialization(playlistStore);
	const subscribe = useCallback(
		(listener: () => void) => playlistStore.subscribe({ listener }),
		[playlistStore],
	);
	const playlists = useSyncExternalStore(
		subscribe,
		playlistStore.getSnapshot,
		() => emptyPlaylists,
	);
	return { playlists, status };
}
