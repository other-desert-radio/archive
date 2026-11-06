import { type Ref, type SubmitEvent, useId, useRef, useState } from "react";
import { useStores } from "../../stores";
import { getBasePath } from "../../utils/get-base-path";
import LoadingState from "../LoadingState";
import NewPlaylistModal from "./NewPlaylistModal";
import styles from "./PlaylistModal.module.css";
import { saveShowToPlaylists } from "./save-show-to-playlists";
import { usePlaylists } from "./usePlaylists";

export default function PlaylistModal({
	ref,
	showId,
}: {
	ref: Ref<HTMLDialogElement>;
	showId: number;
}) {
	const { playlistStore } = useStores();
	const newPlaylistModal = useRef<HTMLDialogElement>(null);
	const discardModal = useRef<HTMLDialogElement>(null);
	const discardDescriptionId = useId();
	const dialogRef = useRef<HTMLDialogElement>(null);

	const { playlists, status } = usePlaylists();
	const [selected, setSelected] = useState<string[] | null>(null);
	const [note, setNote] = useState<string | undefined>(undefined);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const savedIds = playlists
		.filter((playlist) =>
			playlist.shows.some((entry) => entry.showId === showId),
		)
		.map((playlist) => playlist.id);
	const selectedIds = selected ?? savedIds;
	const savedNote =
		playlists
			.flatMap((playlist) => playlist.shows)
			.find((entry) => entry.showId === showId && entry.note)?.note ?? "";
	const dirty =
		selectedIds.length !== savedIds.length ||
		selectedIds.some((id) => !savedIds.includes(id)) ||
		(note ?? savedNote) !== savedNote;

	function requestClose() {
		if (saving) {
			return;
		}
		if (dirty) {
			discardModal.current?.showModal();
		} else {
			dialogRef.current?.close();
		}
	}

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
		<>
			<dialog
				ref={(dialog) => {
					dialogRef.current = dialog;
					if (typeof ref === "function") {
						return ref(dialog);
					}
					if (ref) {
						ref.current = dialog;
					}
				}}
				className={styles["modal"]}
				aria-label="Playlist"
				onPointerDown={(event) => {
					if (event.target !== event.currentTarget) {
						return;
					}
					const rect = event.currentTarget.getBoundingClientRect();
					if (
						event.clientX < rect.left ||
						event.clientX > rect.right ||
						event.clientY < rect.top ||
						event.clientY > rect.bottom
					) {
						requestClose();
					}
				}}
				onCancel={(event) => {
					event.preventDefault();
					requestClose();
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
							onClick={requestClose}
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

					<LoadingState
						status={status}
						loading="Loading playlists..."
						error="Could not load playlists. Reload the page to retry."
					/>
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
						disabled={saving || status !== "ready"}
						onClick={() => newPlaylistModal.current?.showModal()}
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
								value={note ?? savedNote}
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
			<dialog
				ref={discardModal}
				className={`${styles["modal"]} ${styles["discard"]}`}
				aria-label="Discard unsaved changes?"
				aria-describedby={discardDescriptionId}
			>
				<h2>Discard unsaved changes?</h2>
				<p id={discardDescriptionId}>
					Your changes will be lost if you close this form.
				</p>
				<div className={styles["discard-actions"]}>
					<button
						type="button"
						aria-label="Keep editing"
						onClick={() => discardModal.current?.close()}
					>
						Keep editing
					</button>
					<button
						type="button"
						aria-label="Discard changes"
						onClick={() => {
							discardModal.current?.close();
							dialogRef.current?.close();
						}}
					>
						Discard changes
					</button>
				</div>
			</dialog>
			<NewPlaylistModal
				ref={newPlaylistModal}
				onCreated={(playlist) => setSelected([...selectedIds, playlist.id])}
			/>
		</>
	);
}
