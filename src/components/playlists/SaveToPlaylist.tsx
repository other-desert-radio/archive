import { useRef } from "react";
import { getBasePath } from "../../utils/get-base-path";
import PlaylistModal from "./PlaylistModal";
import styles from "./SaveToPlaylist.module.css";
import { usePlaylists } from "./usePlaylists";

export default function SaveToPlaylist({ showId }: { showId: number }) {
	const modal = useRef<HTMLDialogElement>(null);
	const { playlists, status } = usePlaylists();
	const savedPlaylists = playlists.filter((playlist) =>
		playlist.shows.some((entry) => entry.showId === showId),
	);
	const isSaved = savedPlaylists.length > 0;
	const note = savedPlaylists
		.flatMap((playlist) => playlist.shows)
		.find((entry) => entry.showId === showId && entry.note)?.note;
	return (
		<>
			{status === "loading" ? (
				<div
					className={styles["skeleton"]}
					role="status"
					aria-label="Loading playlists"
				/>
			) : (
				<button
					type="button"
					className={`${styles["save-button"]} ${isSaved ? styles["saved"] : ""}`}
					aria-label="Save to Playlist"
					onClick={() => modal.current?.showModal()}
				>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<use
							href={`${getBasePath()}/assets/icons/${isSaved ? "bookmark-filled" : "bookmark"}.svg#bookmark`}
						/>
					</svg>
					<span>
						{isSaved
							? savedPlaylists.map((playlist) => playlist.title).join(", ")
							: "Save to Playlist"}
					</span>
					{note && <span className={styles["note"]}>{note}</span>}
				</button>
			)}
			<PlaylistModal key={showId} ref={modal} showId={showId} />
		</>
	);
}
