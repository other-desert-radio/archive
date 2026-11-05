import type { Ref } from "react";
import { getBasePath } from "../../utils/get-base-path";
import styles from "./PlaylistModal.module.css";

export default function PlaylistModal({
	ref,
}: {
	ref: Ref<HTMLDialogElement>;
}) {
	return (
		<dialog ref={ref} className={styles["modal"]} aria-label="Playlist">
			<p>Playlist</p>
			<form method="dialog">
				<button type="submit" aria-label="Close playlist">
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						aria-hidden="true"
					>
						<use href={`${getBasePath()}/assets/icons/close.svg#close`} />
					</svg>
				</button>
			</form>
		</dialog>
	);
}
