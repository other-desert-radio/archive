import { useRef } from "react";
import { getBasePath } from "../../utils/get-base-path";
import PlaylistModal from "./PlaylistModal";
import styles from "./SaveToPlaylist.module.css";
import { usePlaylists } from "./usePlaylists";

export default function SaveToPlaylist({ showId }: { showId: number }) {
	const modal = useRef<HTMLDialogElement>(null);
	const { status } = usePlaylists();
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
					className={styles["save-button"]}
					aria-label="Save to Playlist"
					onClick={() => modal.current?.showModal()}
				>
					<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<use href={`${getBasePath()}/assets/icons/bookmark.svg#bookmark`} />
					</svg>
					Save to Playlist
				</button>
			)}
			<PlaylistModal key={showId} ref={modal} showId={showId} />
		</>
	);
}
