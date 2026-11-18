import type { PlaybackRecord } from "../../stores/playback/types";
import type { PlaylistSave } from "../../stores/playlists/types";
import type { Show } from "../../utils/fetch-shows";
import type { TagMap } from "../../utils/fetch-tags";
import { formatDate } from "../../utils/format-date";
import { getBasePath } from "../../utils/get-base-path";
import { SaveToPlaylistButton } from "../playlists/SaveToPlaylist";
import TagContainer from "../TagContainer";
import styles from "./ShowCard.module.css";
import SquareShowCard from "./SquareShowCard";

type Props = {
	show: Show;
	tags: TagMap;
	playlistSaves: readonly PlaylistSave[];
	record?: Pick<PlaybackRecord, "positionInSeconds" | "inProgress"> | undefined;
};

/**
 * Renders the compact DJ links associated with a show.
 */
const renderDJs = (djs: Show["djs"], base: string) =>
	djs.map((dj) => (
		<a
			key={dj.id}
			href={`${base}/djs/${dj.id}`}
			className={styles["dj-container"]}
			aria-label={`View ${dj.title}`}
		>
			<span className={styles["dj-name-title"]}>{dj.title}</span>
		</a>
	));

/**
 * Renders one archive show with its date, tags, and associated DJs.
 */
export default function ShowCard({ show, tags, record, playlistSaves }: Props) {
	const detailBase = getBasePath();

	return (
		<article className={styles["show-card"]}>
			<div className={styles["artwork"]}>
				<SquareShowCard
					mode="playback"
					show={show}
					record={record}
					base={detailBase}
				/>
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
				{show.tagIds.length > 0 && (
					<TagContainer tagIds={show.tagIds} tags={tags} size="large" />
				)}
				{renderDJs(show.djs, detailBase)}
				{playlistSaves.length > 0 && (
					<SaveToPlaylistButton
						showId={show.id}
						playlistSaves={playlistSaves}
						showNote={false}
						compact
					/>
				)}
			</div>
		</article>
	);
}
