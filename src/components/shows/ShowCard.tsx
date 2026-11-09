import type { PlaybackRecord } from "../../stores/playback/types";
import type { PlaylistSave } from "../../stores/playlists/types";
import type { Show } from "../../utils/fetch-shows";
import type { TagMap } from "../../utils/fetch-tags";
import { formatDate } from "../../utils/format-date";
import { getBasePath } from "../../utils/get-base-path";
import PlaylistModal from "../playlists/PlaylistModal";
import TagContainer from "../TagContainer";
import PlayableShowArtwork from "./PlayableShowArtwork";
import styles from "./ShowCard.module.css";

type Props = {
	show: Show;
	tags: TagMap;
	playlistSaves: readonly PlaylistSave[];
	record?: Pick<PlaybackRecord, "positionInSeconds" | "inProgress"> | undefined;
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
			{dj.image_small && (
				<img
					className={`${styles["dj-image"]} image-border-secondary`}
					src={`${base}/${dj.image_small}`}
					alt={dj.title}
					loading="lazy"
					decoding="async"
				/>
			)}
			<span className={styles["dj-name-title"]}>{dj.title}</span>
		</a>
	));

/**
 * Renders one archive show with its date, tags, and associated DJs.
 */
export default function ShowCard({ show, tags, record, playlistSaves }: Props) {
	const detailBase = getBasePath();
	const modal = useRef<HTMLDialogElement>(null);
	const [modalMounted, setModalMounted] = useState(false);
	useEffect(() => {
		if (modalMounted) {
			modal.current?.showModal();
		}
	}, [modalMounted]);
	function openPlaylistModal() {
		if (modalMounted) {
			modal.current?.showModal();
		} else {
			setModalMounted(true);
		}
	}

	return (
		<article className={styles["show-card"]}>
			<div className={styles["artwork"]}>
				<PlayableShowArtwork show={show} record={record} base={detailBase} />
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
				<TagContainer tagIds={show.tagIds} tags={tags} size="large" />
				{renderDJs(show.djs, detailBase)}
				{playlistSaves.length > 0 && (
					<div className={styles["playlist-save"]}>
						<button
							type="button"
							className={styles["playlist-heart"]}
							aria-label="Save to Playlist"
							onClick={openPlaylistModal}
						>
							<span aria-hidden="true">♥</span>
						</button>
						<span className={styles["playlist-titles"]}>
							{playlistSaves.map(({ playlistId, title }, index) => (
								<span key={playlistId}>
									{index > 0 && ", "}
									<a
										href={`${detailBase}/playlists/?id=${playlistId}`}
										className={styles["playlist-title"]}
										aria-label={`View playlist ${title}`}
									>
										<b>{title}</b>
									</a>
								</span>
							))}
						</span>
					</div>
				)}
				{modalMounted && (
					<PlaylistModal key={show.id} ref={modal} showId={show.id} />
				)}
			</div>
		</article>
	);
}

import { useEffect, useRef, useState } from "react";
