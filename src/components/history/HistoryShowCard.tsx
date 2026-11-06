import type { Show } from "../../utils/fetch-shows";
import { getBasePath } from "../../utils/get-base-path";
import PlayableShowArtwork from "../shows/PlayableShowArtwork";
import styles from "./HistoryShowCard.module.css";

type Props = {
	show: Show;
};

export default function HistoryShowCard({ show }: Props) {
	const base = getBasePath();
	return (
		<article className={styles["card"]}>
			<PlayableShowArtwork show={show} base={base} />
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
