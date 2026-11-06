import { type Ref, type SubmitEvent, useRef, useState } from "react";
import { type Playlist, useStores } from "../../stores";
import { getBasePath } from "../../utils/get-base-path";
import styles from "./NewPlaylistModal.module.css";
import modalStyles from "./PlaylistModal.module.css";

type NewPlaylistModalProps = {
	ref: Ref<HTMLDialogElement>;
	onCreated?: (playlist: Playlist) => void;
};

export default function NewPlaylistModal({
	ref,
	onCreated,
}: NewPlaylistModalProps) {
	const { playlistStore } = useStores();
	const [title, setTitle] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string>();
	const pending = useRef(false);

	async function create(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (pending.current || !title.trim()) {
			return;
		}
		const dialog = event.currentTarget.closest("dialog");
		pending.current = true;
		setSaving(true);
		setError(undefined);
		let playlist: Playlist;
		try {
			playlist = await playlistStore.create({ title });
		} catch {
			setError("Could not create playlist. Please try again.");
			return;
		} finally {
			pending.current = false;
			setSaving(false);
		}
		dialog?.close();
		onCreated?.(playlist);
	}

	return (
		<dialog
			ref={ref}
			className={`${modalStyles["modal"]} ${styles["creation"]}`}
			aria-label="New Playlist"
			onCancel={(event) => {
				if (pending.current) {
					event.preventDefault();
				}
			}}
			onClose={() => {
				setTitle("");
				setError(undefined);
			}}
		>
			<form method="dialog" onSubmit={create} aria-busy={saving}>
				<div className={modalStyles["header"]}>
					<h1>New Playlist</h1>
					<button
						type="button"
						aria-label="Close new playlist"
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
				<label>
					Playlist name
					<input
						ref={(input) => {
							if (input) {
								input.autofocus = true;
							}
						}}
						name="title"
						aria-label="Playlist name"
						required
						value={title}
						disabled={saving}
						onChange={(event) => setTitle(event.currentTarget.value)}
					/>
				</label>
				{error && <p role="alert">{error}</p>}
				<div className={styles["actions"]}>
					<button
						type="button"
						aria-label="Cancel new playlist"
						disabled={saving}
						onClick={(event) => event.currentTarget.closest("dialog")?.close()}
					>
						Cancel
					</button>
					<button
						className={modalStyles["save"]}
						type="submit"
						aria-label="Create playlist"
						disabled={saving || !title.trim()}
					>
						{saving ? "Creating..." : "Create"}
					</button>
				</div>
			</form>
		</dialog>
	);
}
