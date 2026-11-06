import { useCallback, useSyncExternalStore } from "react";
import { useInitialization } from "../../hooks/useInitialization";
import { useStores } from "../../stores";
import type { PlaybackRecord } from "../../stores/playback/types";
import type { ShowStore } from "../../stores/shows/show-store";
import type { TagStore } from "../../stores/tags/tag-store";
import LoadingState from "../LoadingState";
import PlaylistView from "../playlists/PlaylistView";
import { usePlaylists } from "../playlists/usePlaylists";
import { ShowCard } from "../shows";
import styles from "./HistoryPane.module.css";

const emptyRecords: readonly PlaybackRecord[] = [];

export default function HistoryPane() {
	const stores = useStores();
	const { playlists, status: playlistStatus } = usePlaylists();
	const { playbackStore, showStore, tagStore } = stores;
	const { status } = useInitialization(stores);

	const subscribe = useCallback(
		(notify: () => void) => playbackStore.subscribe(notify),
		[playbackStore],
	);

	const records = useSyncExternalStore(
		subscribe,
		playbackStore.getSnapshot,
		() => emptyRecords,
	);

	const inProgress =
		status === "ready" ? records.filter((r) => r.inProgress) : [];

	return (
		<div>
			<div className={styles["wip"]}>Under Construction</div>
			<LoadingState
				status={status}
				loading="Loading shows..."
				error="Could not load shows."
			>
				<h2>Recently Played</h2>
				<div className={styles["show-container"]}>
					{inProgress.map((record) =>
						renderRecord({ record, showStore, tagStore }),
					)}
				</div>
			</LoadingState>
			<section aria-label="Playlists">
				<h2>Playlists</h2>
				<p>Playlists are stored in this browser.</p>
				<LoadingState
					status={playlistStatus}
					loading="Loading playlists..."
					error="Could not load playlists. Reload the page to retry."
				>
					<div className={styles["playlists"]}>
						{playlists.map((playlist) => (
							<PlaylistView key={playlist.id} playlist={playlist} />
						))}
					</div>
				</LoadingState>
			</section>
		</div>
	);
}

type Params = {
	record: PlaybackRecord;
	showStore: ShowStore;
	tagStore: TagStore;
};
const renderRecord = ({ record, showStore, tagStore }: Params) => {
	const show = showStore.get(record.showId);
	if (!show) {
		return <div key={record.showId}>missing show id {record.showId}</div>;
	}

	return <ShowCard key={record.showId} show={show} tags={tagStore.getMap()} />;
};
