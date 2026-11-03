import { useCallback, useSyncExternalStore } from "react";
import { useStores } from "../../stores";
import styles from "./HistoryPane.module.css";

export default function HistoryPane() {
	const { playbackStore } = useStores();

	const subscribe = useCallback(
		(notify: () => void) => playbackStore.subscribe(notify),
		[playbackStore],
	);

	const getSnapshot = useCallback(
		() => JSON.stringify(playbackStore.getAll(), undefined, 2),
		[playbackStore],
	);

	const records = useSyncExternalStore(subscribe, getSnapshot, () => "[]");

	return (
		<div>
			<div className={styles["wip"]}>Under Construction</div>
			<pre>{records}</pre>
		</div>
	);
}
