import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useStores } from "../../stores";
import type { PlaybackRecord } from "../../stores/playback/types";
import type { ShowStore } from "../../stores/shows/show-store";
import type { TagStore } from "../../stores/tags/tag-store";
import { ShowCard } from "../shows";
import styles from "./HistoryPane.module.css";

const emptyRecords: readonly PlaybackRecord[] = [];

export default function HistoryPane() {
	const stores = useStores();
	const { playbackStore, showStore, tagStore } = stores;
	const [status, setStatus] = useState<"loading" | "ready" | "error">(
		"loading",
	);

	useEffect(() => {
		let active = true;
		setStatus("loading");
		void stores.initialize().then(
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
	}, [stores]);

	const subscribe = useCallback(
		(notify: () => void) => playbackStore.subscribe(notify),
		[playbackStore],
	);

	const records = useSyncExternalStore(
		subscribe,
		playbackStore.getSnapshot,
		() => emptyRecords,
	);

	const inProgress = records.filter((r) => r.inProgress);

	return (
		<div>
			{status === "loading" && <p role="status">Loading shows...</p>}
			{status === "error" && <p role="alert">Could not load shows.</p>}
			{status === "ready" && (
				<>
					<div className={styles["wip"]}>Under Construction</div>
					<h2>Recently Played</h2>
					<div className={styles["show-container"]}>
						{inProgress.map((record) =>
							renderRecord({ record, showStore, tagStore }),
						)}
					</div>
				</>
			)}
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
