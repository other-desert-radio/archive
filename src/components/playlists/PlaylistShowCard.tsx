import { type ReactElement, useEffect, useRef, useState } from "react";
import type { PlaybackRecord } from "../../stores/playback/types";
import type { PlaylistEntry } from "../../stores/playlists/types";
import type { Show } from "../../utils/fetch-shows";
import type { TagMap } from "../../utils/fetch-tags";
import { formatDateTime } from "../../utils/format-date";
import { getBasePath } from "../../utils/get-base-path";
import PlayableShowArtwork from "../shows/PlayableShowArtwork";
import TagContainer from "../TagContainer";
import PlaylistModal from "./PlaylistModal";
import styles from "./PlaylistShowCard.module.css";

const showTags = false;

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
	const hasNote = entry.note !== undefined && entry.note !== "";
	const modal = useRef<HTMLDialogElement>(null);
	const [modalMounted, setModalMounted] = useState(false);
	useEffect(() => {
		if (modalMounted) {
			modal.current?.showModal();
		}
	}, [modalMounted]);
	function openModal() {
		if (modalMounted) {
			modal.current?.showModal();
		} else {
			setModalMounted(true);
		}
	}
	return (
		<div className={styles["card"]}>
			<PlayableShowArtwork show={show} record={record} base={getBasePath()} />
			<div className={styles["chin"]} data-has-note={hasNote}>
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
						onClick={openModal}
					>
						Edit
					</button>
				</div>
				{hasNote && <div className={styles["note-text"]}>{entry.note}</div>}
			</div>
			{modalMounted && (
				<PlaylistModal key={show.id} ref={modal} showId={show.id} mode="edit" />
			)}
		</div>
	);
}
