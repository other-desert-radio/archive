import type { ReactElement } from "react";
import type { PlaybackRecord } from "../../stores/playback/types";
import type { PlaylistEntry } from "../../stores/playlists/types";
import type { Show } from "../../utils/fetch-shows";
import type { TagMap } from "../../utils/fetch-tags";
import { formatDateTime } from "../../utils/format-date";
import { getBasePath } from "../../utils/get-base-path";
import PlayableShowArtwork from "../shows/PlayableShowArtwork";
import TagContainer from "../TagContainer";
import styles from "./PlaylistShowCard.module.css";

const showTags = false;

type Props = {
	show: Show;
	entry: PlaylistEntry;
	tags: TagMap;
	onEdit: () => void;
	record?: Pick<PlaybackRecord, "positionInSeconds" | "inProgress"> | undefined;
};

/** Artwork above a full-width chin containing the title and optional entry note. */
export default function PlaylistShowCard({
	show,
	entry,
	tags,
	record,
	onEdit,
}: Props): ReactElement {
	const hasNote = entry.note !== undefined && entry.note !== "";
	return (
		<div className={styles["card"]}>
			<PlayableShowArtwork show={show} record={record} base={getBasePath()} />
			<div className={styles["chin"]} data-has-note={hasNote}>
				<a
					className={styles["title"]}
					href={`${getBasePath()}/shows/${show.id}`}
					aria-label={`View ${show.title}`}
				>
					{show.title}
				</a>
				{showTags && (
					<TagContainer tagIds={show.tagIds} tags={tags} size="large" />
				)}
				<div className={styles["note-header"]}>
					<time className={styles["note-date"]} dateTime={entry.addedAt}>
						Added on {formatDateTime(entry.addedAt)}
					</time>
					<button
						type="button"
						className="button-secondary"
						aria-label={`Edit note for ${show.title}`}
						onClick={onEdit}
					>
						Edit
					</button>
				</div>
				{hasNote && <div className={styles["note-text"]}>{entry.note}</div>}
			</div>
		</div>
	);
}
