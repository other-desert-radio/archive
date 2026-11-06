import type { PlaybackRecord } from "../../stores/playback/types";
import type { Show } from "../../utils/fetch-shows";
import { getBasePath } from "../../utils/get-base-path";
import PlayableShowArtwork from "../shows/PlayableShowArtwork";
import styles from "./HistoryShowCard.module.css";

type Props = {
	show: Show;
	record?: Pick<PlaybackRecord, "positionInSeconds" | "inProgress"> | undefined;
};

export default function HistoryShowCard({ show, record }: Props) {
	const base = getBasePath();
	return (
		<article className={styles["card"]}>
			<PlayableShowArtwork
				show={show}
				record={record}
				base={base}
				alwaysShowProgress
			/>
			<a
				className={styles["title"]}
				href={`${base}/shows/${show.id}`}
				aria-label={`View ${show.title}`}
			>
				{show.title}
			</a>
		</article>
	);
}
