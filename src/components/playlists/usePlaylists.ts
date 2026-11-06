import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { type Playlist, useStores } from "../../stores";

const emptyPlaylists: readonly Playlist[] = [];

/** Loads local playlists independently of the catalog and subscribes to store changes.
 * Returns the current playlist snapshot and its loading, ready, or error status.
 */
export function usePlaylists() {
	const { playlistStore } = useStores();
	const [status, setStatus] = useState<"loading" | "ready" | "error">(
		"loading",
	);
	useEffect(() => {
		let active = true;
		setStatus("loading");
		void playlistStore.initialize().then(
			() => {
				if (active) {
					setStatus("ready");
				}
			},
			() => {
				if (active) {
					setStatus("error");
				}
			},
		);
		return () => {
			active = false;
		};
	}, [playlistStore]);
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
