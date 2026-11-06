import { useCallback, useSyncExternalStore } from "react";
import { useInitialization } from "../../hooks/useInitialization";
import { useStores } from "../../stores";
import type { PlaybackRecord } from "../../stores/playback/types";
import type { ShowStore } from "../../stores/shows/show-store";
import LoadingState from "../LoadingState";
import PlaylistView from "../playlists/PlaylistView";
import { usePlaylists } from "../playlists/usePlaylists";
import styles from "./HistoryPane.module.css";
import HistoryShowCard from "./HistoryShowCard";

const emptyRecords: readonly PlaybackRecord[] = [];

export function recentlyPlayed(records: readonly PlaybackRecord[]) {
	return records
		.filter((record) => record.history.length > 0)
		.sort(
			(a, b) =>
				(b.history.at(-1)?.updatedAt ?? 0) - (a.history.at(-1)?.updatedAt ?? 0),
		)
		.slice(0, 10);
}

export default function HistoryPane() {
	const stores = useStores();
	const { playlists, status: playlistStatus } = usePlaylists();
	const { playbackStore, showStore } = stores;
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

	const recentRecords = status === "ready" ? recentlyPlayed(records) : [];

	return (
		<div>
			<LoadingState
				status={status}
				loading="Loading shows..."
				error="Could not load shows."
			>
				<h1>Recently Played</h1>
				<section
					className={styles["show-container"]}
					aria-label="Recently played shows"
				>
					{recentRecords.map((record) => renderRecord({ record, showStore }))}
				</section>
			</LoadingState>
			<section aria-label="Playlists">
				<h1>Playlists</h1>
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
};
const renderRecord = ({ record, showStore }: Params) => {
	const show = showStore.get(record.showId);
	if (!show) {
		return <div key={record.showId}>missing show id {record.showId}</div>;
	}

	return <HistoryShowCard key={record.showId} show={show} />;
};
