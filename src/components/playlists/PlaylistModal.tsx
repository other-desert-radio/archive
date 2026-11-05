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
			<form method="dialog">
				<div className={styles["header"]}>
					<h1>Save Show</h1>
					<button
						type="button"
						aria-label="Close playlist"
						onClick={(event) => event.currentTarget.closest("dialog")?.close()}
					>
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
				</div>

				<fieldset aria-label="Playlists">
					<label>
						<input
							type="checkbox"
							name="playlists"
							value="liked-showed"
							defaultChecked
							aria-label="Liked Showed"
						/>
						Liked Showed
					</label>
					<label>
						<input
							type="checkbox"
							name="playlists"
							value="for-later"
							aria-label="For Later"
						/>
						For Later
					</label>
				</fieldset>

				<button
					className={styles["new-playlist"]}
					type="button"
					aria-label="New playlist"
					disabled
				>
					+ New Playlist
				</button>

				<label>
					Add a note
					<textarea name="note" rows={6} aria-label="Add a note" />
				</label>

				<button
					className={styles["save"]}
					type="submit"
					aria-label="Save playlist"
				>
					Save
				</button>
			</form>
		</dialog>
	);
}
