import { useRef } from "react";
import { getBasePath } from "../../utils/get-base-path";
import PlaylistModal from "./PlaylistModal";
import styles from "./SaveToPlaylist.module.css";

export default function SaveToPlaylist() {
	const modal = useRef<HTMLDialogElement>(null);
	return (
		<>
			<button
				type="button"
				className={styles["save-button"]}
				aria-label="Save to Playlist"
				onClick={() => modal.current?.showModal()}
			>
				<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
					<use href={`${getBasePath()}/assets/icons/heart.svg#heart`} />
				</svg>
				Save to Playlist
			</button>
			<PlaylistModal ref={modal} />
		</>
	);
}
