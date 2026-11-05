import { type Ref, useCallback, useSyncExternalStore } from "react";
import { type Playlist, useStores } from "../../stores";
import { getBasePath } from "../../utils/get-base-path";
import styles from "./PlaylistModal.module.css";

const emptyPlaylists: readonly Playlist[] = [];

export default function PlaylistModal({
	ref,
}: {
	ref: Ref<HTMLDialogElement>;
}) {
	const { playlistStore } = useStores();

	const subscribe = useCallback(
		(listener: () => void) => playlistStore.subscribe({ listener }),
		[playlistStore],
	);
	const playlists = useSyncExternalStore(
		subscribe,
		playlistStore.getSnapshot,
		() => emptyPlaylists,
	);

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
					{playlists.map((playlist) => (
						<label key={playlist.id}>
							<input
								type="checkbox"
								name="playlists"
								value={playlist.id}
								aria-label={playlist.title}
							/>
							{playlist.title}
						</label>
					))}
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
