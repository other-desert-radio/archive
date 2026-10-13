import { useAudioState, useStores } from "../../stores";
import type { Show } from "../../utils/fetch-shows";
import type { TagMap } from "../../utils/fetch-tags";
import { formatDate } from "../../utils/format-date";
import TagContainer from "../TagContainer";
import styles from "./ShowCard.module.css";
import {
	isSelectedShow,
	mixcloudShowTrack,
	toggleShowPlayback,
} from "./show-playback";

type Props = {
	show: Show;
	base: string;
	tags: TagMap;
};

/**
 * Renders the compact DJ links associated with a show.
 *
 * TODO: dj.image_tiny ?
 */
const renderDJs = (djs: Show["djs"], base: string) =>
	djs.map((dj) => (
		<a
			key={dj.id}
			href={`${base}/djs/${dj.id}`}
			className={styles["dj-container"]}
			aria-label={`View ${dj.title}`}
		>
			<img
				className={`${styles["dj-image"]} image-border-secondary`}
				src={`${base}/${dj.image_small}`}
				alt={dj.title}
			/>
			<span className={styles["dj-name-title"]}>{dj.title}</span>
		</a>
	));

/**
 * Renders one archive show with its date, tags, and associated DJs.
 */
export default function ShowCard({ show, base, tags }: Props) {
	const detailBase = base.replace(/\/$/, "");
	const { audioStore } = useStores();
	const audio = useAudioState();
	const track = mixcloudShowTrack(show);
	const selected = isSelectedShow(audio, track);
	const pause =
		selected && (audio.status === "playing" || audio.status === "loading");

	return (
		<article className={styles["show-card"]}>
			<div className={styles["artwork"]}>
				<img
					className={`${styles["show-image"]} image-border-primary`}
					src={show.image_large}
					alt={show.title}
				/>
				<button
					type="button"
					className={styles["playback-button"]}
					data-selected={selected}
					aria-label={`${pause ? "Pause" : "Play"} ${show.title}`}
					onClick={() => toggleShowPlayback(audioStore, track)}
				>
					<img
						src={`${detailBase}/assets/icons/${pause ? "pause" : "play"}.svg`}
						alt=""
						aria-hidden="true"
					/>
				</button>
			</div>
			<div className={styles["trailing-content"]}>
				<a
					href={`${detailBase}/shows/${show.id}`}
					className={styles["show-title"]}
					aria-label={`View ${show.title}`}
				>
					{show.title}
				</a>
				<time className={styles["show-date"]} dateTime={show.date}>
					{formatDate(show.date)}
				</time>
				<TagContainer tagIds={show.tagIds} tags={tags} size="normal" />
				{renderDJs(show.djs, detailBase)}
			</div>
		</article>
	);
}
