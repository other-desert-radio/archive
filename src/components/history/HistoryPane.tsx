import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
	type InitializationStatus,
	useInitialization,
} from "../../hooks/useInitialization";
import { useStores } from "../../stores";
import type { PlaybackRecord } from "../../stores/playback/types";
import type { Playlist } from "../../stores/playlists/types";
import type { ShowStore } from "../../stores/shows/show-store";
import LoadingState from "../LoadingState";
import PlaylistCard from "../playlists/PlaylistCard";
import PlaylistCardSkeleton from "../playlists/PlaylistCardSkeleton";
import { usePlaylists } from "../playlists/usePlaylists";
import styles from "./HistoryPane.module.css";
import HistoryShowCard from "./HistoryShowCard";
import HistoryShowCardSkeleton from "./HistoryShowCardSkeleton";

const skeletonSlots = Array.from({ length: 10 }, (_, index) => index);

function useSkeletonLoading(status: InitializationStatus) {
	const [visible, setVisible] = useState(true);
	useEffect(() => {
		if (status === "loading") {
			setVisible(true);
			return;
		}
		const duration =
			document.documentElement.hasAttribute("data-client-navigation") ||
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
				? 0
				: 120;
		const timer = window.setTimeout(() => setVisible(false), duration);
		return () => window.clearTimeout(timer);
	}, [status]);
	return status === "loading" || visible;
}

const emptyRecords: readonly PlaybackRecord[] = [];

export function historyPlaylists(playlists: readonly Playlist[]) {
	return [...playlists].sort(
		(a, b) => Number(b.type === "liked") - Number(a.type === "liked"),
	);
}

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
	const showsLoading = useSkeletonLoading(status);
	const playlistsLoading = useSkeletonLoading(playlistStatus);

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
			<h1 className={`page-inset ${styles["heading"]}`}>Recently Played</h1>
			<section
				className={`gutter-scroll ${styles["show-container"]}`}
				aria-label="Recently played shows"
				aria-busy={showsLoading}
			>
				<LoadingState
					status={showsLoading ? "loading" : status}
					loading="Loading shows..."
					error="Could not load shows."
					className={showsLoading ? styles["loading-message"] : undefined}
				>
					{recentRecords.map((record) => renderRecord({ record, showStore }))}
				</LoadingState>
				{showsLoading &&
					skeletonSlots.map((slot) => (
						<HistoryShowCardSkeleton
							key={slot}
							exiting={status !== "loading"}
						/>
					))}
			</section>
			<section className="page-inset" aria-label="Playlists">
				<h1 className={styles["heading"]}>Playlists</h1>
				<p className={styles["disclaimer"]}>
					Playlists are stored locally on your device.
				</p>
				<div className={styles["playlists"]} aria-busy={playlistsLoading}>
					<LoadingState
						status={playlistsLoading ? "loading" : playlistStatus}
						loading="Loading playlists..."
						className={playlistsLoading ? styles["loading-message"] : undefined}
						error="Could not load playlists. Reload the page to retry."
					>
						{historyPlaylists(playlists).map((playlist) => (
							<PlaylistCard
								key={playlist.id}
								playlist={playlist}
								shows={
									status === "ready"
										? showStore.getPage(
												playlist.shows.map((entry) => entry.showId),
												0,
												playlist.shows.length,
											)
										: []
								}
							/>
						))}
					</LoadingState>
					{playlistsLoading &&
						[0, 1, 2].map((slot) => (
							<PlaylistCardSkeleton
								key={slot}
								exiting={playlistStatus !== "loading"}
							/>
						))}
				</div>
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

	return <HistoryShowCard key={record.showId} show={show} record={record} />;
};
