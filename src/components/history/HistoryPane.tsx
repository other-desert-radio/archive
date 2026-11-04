import { useCallback, useSyncExternalStore } from "react";
import { useStores } from "../../stores";
import type { PlaybackRecord } from "../../stores/playback/types";
import type { ShowStore } from "../../stores/shows/show-store";
import type { TagStore } from "../../stores/tags/tag-store";
import { ShowCard } from "../shows";
import styles from "./HistoryPane.module.css";

export default function HistoryPane() {
	const { playbackStore, showStore, tagStore } = useStores();

	const subscribe = useCallback(
		(notify: () => void) => playbackStore.subscribe(notify),
		[playbackStore],
	);

	const records = useSyncExternalStore(
		subscribe,
		playbackStore.getSnapshot,
		() => [],
	);

	const inProgress = records.filter((r) => r.inProgress);

	const tempRender = (records: Readonly<PlaybackRecord[]>) =>
		JSON.stringify(records, undefined, 2);

	return (
		<div>
			<div className={styles["wip"]}>Under Construction</div>
			<h2>Recently Played</h2>
			<pre>{tempRender(inProgress)}</pre>
			{inProgress.map((record) =>
				renderRecord({ record, showStore, tagStore }),
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
		return <div>missing show id {record.showId}</div>;
	}

	return <ShowCard show={show} tags={tagStore.getMap()} />;
};
