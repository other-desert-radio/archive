import { useCallback, useSyncExternalStore } from "react";
import { useInitialization } from "../../hooks/useInitialization";
import { useStores } from "../../stores";
import type { PlaybackRecord } from "../../stores/playback/types";
import type { PlaylistEntry } from "../../stores/playlists/types";
import type { ShowStore } from "../../stores/shows/show-store";

const emptyRecords: readonly PlaybackRecord[] = [];

/** Keep unresolved references so the page can show unavailable entries without deleting them. */
export function resolvePlaylistShows({
	entries,
	showStore,
	records,
}: {
	entries: readonly PlaylistEntry[];
	showStore: Pick<ShowStore, "get">;
	records: readonly PlaybackRecord[];
}) {
	const recordsByShowId = new Map(
		records.map((record) => [record.showId, record]),
	);
	return [...entries]
		.sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt))
		.map((entry) => ({
			entry,
			show: showStore.get(entry.showId),
			record: recordsByShowId.get(entry.showId),
		}));
}

/** Loads catalog data and subscribes to playback progress for playlist entries. */
export function usePlaylistShows(entries: readonly PlaylistEntry[]) {
	const stores = useStores();
	const { status, retry } = useInitialization(stores);
	const { playbackStore } = stores;
	const subscribe = useCallback(
		(listener: () => void) => playbackStore.subscribe(listener),
		[playbackStore],
	);
	const records = useSyncExternalStore(
		subscribe,
		playbackStore.getSnapshot,
		() => emptyRecords,
	);
	return {
		status,
		retry,
		shows:
			status === "ready"
				? resolvePlaylistShows({
						entries,
						showStore: stores.showStore,
						records,
					})
				: [],
		tags: stores.tagStore.getMap(),
	};
}
