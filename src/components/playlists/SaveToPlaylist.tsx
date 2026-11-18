import { useEffect, useRef, useState } from "react";
import type { PlaylistSave } from "../../stores/playlists/types";
import { getBasePath } from "../../utils/get-base-path";
import PlaylistModal from "./PlaylistModal";
import styles from "./SaveToPlaylist.module.css";
import { usePlaylists } from "./usePlaylists";

export default function SaveToPlaylist({
	showId,
	showNote = true,
}: {
	showId: number;
	showNote?: boolean;
}) {
	const { playlists, status } = usePlaylists();
	const savedPlaylists = playlists.filter((playlist) =>
		playlist.shows.some((entry) => entry.showId === showId),
	);
	const note = savedPlaylists
		.flatMap((playlist) => playlist.shows)
		.find((entry) => entry.showId === showId && entry.note)?.note;
	return status === "loading" ? (
		<div
			className={styles["skeleton"]}
			role="status"
			aria-label="Loading playlists"
		/>
	) : (
		<SaveToPlaylistButton
			showId={showId}
			playlistSaves={savedPlaylists.map((playlist) => ({
				playlistId: playlist.id,
				title: playlist.title,
			}))}
			note={note}
			showNote={showNote}
		/>
	);
}

export function SaveToPlaylistButton({
	showId,
	playlistSaves,
	note,
	showNote = true,
}: {
	showId: number;
	playlistSaves: readonly PlaylistSave[];
	note?: string | undefined;
	showNote?: boolean;
}) {
	const isSaved = playlistSaves.length > 0;
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
		<>
			<button
				type="button"
				className={`${styles["save-button"]} ${isSaved ? styles["saved"] : ""}`}
				aria-label="Save to Playlist"
				onClick={openModal}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<use
						href={`${getBasePath()}/assets/icons/${isSaved ? "bookmark-filled" : "bookmark"}.svg#bookmark`}
					/>
				</svg>
				<span>
					{isSaved
						? playlistSaves.map((playlist) => playlist.title).join(", ")
						: "Save to Playlist"}
				</span>
				{showNote && note && <span className={styles["note"]}>{note}</span>}
			</button>
			{modalMounted && (
				<PlaylistModal key={showId} ref={modal} showId={showId} />
			)}
		</>
	);
}
