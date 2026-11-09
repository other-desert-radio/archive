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

type Props = {
	show: Show;
	entry: PlaylistEntry;
	tags: TagMap;
	record?: Pick<PlaybackRecord, "positionInSeconds" | "inProgress"> | undefined;
};

/** Artwork above a full-width chin containing tags and the optional entry note. */
export default function PlaylistShowCard({
	show,
	entry,
	tags,
	record,
}: Props): ReactElement {
	return (
		<div className={styles["card"]}>
			<PlayableShowArtwork show={show} record={record} base={getBasePath()} />
			<div className={styles["chin"]}>
				<TagContainer tagIds={show.tagIds} tags={tags} size="large" />
				{entry.note !== undefined && entry.note !== "" && (
					<div className={styles["note"]}>
						<div className={styles["note-header"]}>
							<time className={styles["note-date"]} dateTime={entry.updatedAt}>
								{formatDateTime(entry.updatedAt)}
							</time>
							<button
								type="button"
								className="button-secondary"
								aria-label={`Edit note for ${show.title}`}
							>
								Edit
							</button>
						</div>
						<div className={styles["note-text"]}>{entry.note}</div>
					</div>
				)}
			</div>
		</div>
	);
}
