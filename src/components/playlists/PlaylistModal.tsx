import {
	type Ref,
	type SubmitEvent,
	useCallback,
	useEffect,
	useState,
	useSyncExternalStore,
} from "react";
import { type Playlist, useStores } from "../../stores";
import { getBasePath } from "../../utils/get-base-path";
import styles from "./PlaylistModal.module.css";

import { saveShowToPlaylists } from "./save-show-to-playlists";

const emptyPlaylists: readonly Playlist[] = [];

export default function PlaylistModal({
	ref,
	showId,
}: {
	ref: Ref<HTMLDialogElement>;
	showId: number;
}) {
	const { playlistStore } = useStores();

	const [status, setStatus] = useState<"loading" | "ready" | "error">(
		"loading",
	);
	const [selected, setSelected] = useState<string[] | null>(null);
	const [note, setNote] = useState<string | undefined>(undefined);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		void playlistStore.initialize().then(
			() => {
				if (active) {
					setStatus("ready");
				}
			},
			() => {
				if (active) {
					setStatus("error");
				}
			},
		);

		return () => {
			active = false;
		};
	}, [playlistStore]);

	const subscribe = useCallback(
		(listener: () => void) => playlistStore.subscribe({ listener }),
		[playlistStore],
	);
	const playlists = useSyncExternalStore(
		subscribe,
		playlistStore.getSnapshot,
		() => emptyPlaylists,
	);

	const selectedIds =
		selected ??
		playlists
			.filter((playlist) =>
				playlist.shows.some((entry) => entry.showId === showId),
			)
			.map((playlist) => playlist.id);

	async function save(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (saving || status !== "ready") {
			return;
		}
		const dialog = event.currentTarget.closest("dialog");
		setSaving(true);
		setError(null);
		try {
			await saveShowToPlaylists({
				playlistStore,
				showId,
				playlistIds: selectedIds,
				note,
			});
			dialog?.close();
		} catch {
			setError("Could not save all changes. Please try again.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<dialog
			ref={ref}
			className={styles["modal"]}
			aria-label="Playlist"
			onCancel={(event) => {
				if (saving) {
					event.preventDefault();
				}
			}}
			onClose={() => {
				setSelected(null);
				setNote(undefined);
				setError(null);
			}}
		>
			<form method="dialog" onSubmit={save} aria-busy={saving}>
				<div className={styles["header"]}>
					<h1>Save Show</h1>
					<button
						type="button"
						aria-label="Close playlist"
						disabled={saving}
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

				{status === "loading" && <p role="status">Loading playlists...</p>}
				{status === "error" && (
					<p role="alert">
						Could not load playlists. Reload the page to retry.
					</p>
				)}
				<fieldset
					aria-label="Playlists"
					disabled={saving || status !== "ready"}
				>
					{playlists.map((playlist) => (
						<label key={playlist.id}>
							<input
								type="checkbox"
								name="playlists"
								value={playlist.id}
								aria-label={playlist.title}
								checked={selectedIds.includes(playlist.id)}
								onChange={(event) =>
									setSelected(
										event.currentTarget.checked
											? [...selectedIds, playlist.id]
											: selectedIds.filter((id) => id !== playlist.id),
									)
								}
							/>
							{playlist.title}
						</label>
					))}
				</fieldset>

				{status === "ready" && playlists.length === 0 && (
					<p>No playlists yet.</p>
				)}

				<button
					className={styles["new-playlist"]}
					type="button"
					aria-label="New playlist"
					disabled
				>
					+ New Playlist
				</button>

				{playlists.length > 0 && (
					<label>
						Add a note
						<textarea
							name="note"
							rows={6}
							aria-label="Add a note"
							disabled={saving}
							value={note ?? ""}
							onChange={(event) => setNote(event.currentTarget.value)}
						/>
					</label>
				)}

				{error && <p role="alert">{error}</p>}

				<button
					className={styles["save"]}
					type="submit"
					aria-label="Save playlist"
					disabled={saving || status !== "ready"}
				>
					{saving ? "Saving..." : "Save"}
				</button>
			</form>
		</dialog>
	);
}
