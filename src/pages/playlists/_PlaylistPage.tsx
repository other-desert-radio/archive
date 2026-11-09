import { type SubmitEvent, useEffect, useRef, useState } from "react";
import LoadingState from "../../components/LoadingState";
import PlaylistModal from "../../components/playlists/PlaylistModal";
import PlaylistShowCard from "../../components/playlists/PlaylistShowCard";
import { usePlaylists } from "../../components/playlists/usePlaylists";
import { useStores } from "../../stores";
import styles from "./PlaylistPage.module.css";
import { usePlaylistShows } from "./usePlaylistShows";

export default function PlaylistPage() {
	const { playlists, status } = usePlaylists();
	const { playlistStore } = useStores();
	const [draftTitle, setDraftTitle] = useState<string>();
	const [saving, setSaving] = useState(false);
	const [renameError, setRenameError] = useState<string>();
	const pending = useRef(false);
	const renameButton = useRef<HTMLButtonElement>(null);
	function cancelRename() {
		if (pending.current) {
			return;
		}
		setDraftTitle(undefined);
		setRenameError(undefined);
		requestAnimationFrame(() => renameButton.current?.focus());
	}
	const modal = useRef<HTMLDialogElement>(null);
	const [editingShowId, setEditingShowId] = useState<number>();
	useEffect(() => {
		if (editingShowId !== undefined) {
			modal.current?.showModal();
		}
	}, [editingShowId]);
	const [playlistId, setPlaylistId] = useState("");
	useEffect(() => {
		setPlaylistId(new URLSearchParams(window.location.search).get("id") ?? "");
	}, []);
	const playlist = playlists.find((item) => item.id === playlistId);
	const {
		shows,
		tags,
		status: showStatus,
		retry,
	} = usePlaylistShows(playlist?.shows ?? []);
	async function rename(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (pending.current || !playlist || !draftTitle?.trim()) {
			return;
		}
		pending.current = true;
		setSaving(true);
		setRenameError(undefined);
		try {
			await playlistStore.rename({
				playlistId: playlist.id,
				title: draftTitle,
			});
			setDraftTitle(undefined);
			requestAnimationFrame(() => renameButton.current?.focus());
		} catch {
			setRenameError("Could not rename playlist. Please try again.");
		} finally {
			pending.current = false;
			setSaving(false);
		}
	}
	return (
		<div>
			{draftTitle !== undefined ? (
				<form
					className={styles["title-editor"]}
					onSubmit={rename}
					aria-busy={saving}
				>
					<input
						className={styles["title-input"]}
						aria-label="Playlist title"
						ref={(input) => input?.focus()}
						value={draftTitle}
						required
						disabled={saving}
						onChange={(event) => {
							setDraftTitle(event.currentTarget.value);
							setRenameError(undefined);
						}}
						onKeyDown={(event) => {
							if (event.key === "Escape") {
								event.preventDefault();
								cancelRename();
							}
						}}
					/>
					<div className={styles["title-actions"]}>
						<button
							type="submit"
							aria-label="Save playlist title"
							disabled={saving || !draftTitle.trim()}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path d="m5 12 4 4 10-10" />
							</svg>
						</button>
						<button
							type="button"
							aria-label="Cancel playlist rename"
							disabled={saving}
							onClick={cancelRename}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path d="m6 6 12 12M18 6 6 18" />
							</svg>
						</button>
					</div>
				</form>
			) : (
				<div className={styles["title-flex"]}>
					<h1>{playlist?.title ?? "Playlist"}</h1>
					{playlist?.type === "user" && (
						<div className={styles["title-actions"]}>
							<button
								ref={renameButton}
								type="button"
								className="button-primary"
								aria-label="Rename playlist"
								onClick={() => setDraftTitle(playlist.title)}
							>
								Rename
							</button>
							<button
								type="button"
								className="button-primary button-danger"
								aria-label="Delete playlist"
							>
								Delete
							</button>
						</div>
					)}
				</div>
			)}
			{renameError && <p role="alert">{renameError}</p>}
			<p className={styles["disclaimer"]}>
				Playlists are stored locally on this device.
			</p>
			<LoadingState
				status={status}
				loading="Loading playlist..."
				error="Could not load playlists. Reload the page to retry."
			>
				{playlist ? (
					<LoadingState
						status={showStatus}
						loading="Loading shows..."
						error={
							<>
								Could not load shows.{" "}
								<button type="button" onClick={retry}>
									Retry
								</button>
							</>
						}
					>
						{shows.length === 0 ? (
							<p>No shows in this playlist.</p>
						) : (
							<section
								className={styles["shows-grid"]}
								aria-label="Playlist shows"
							>
								{shows.map(({ entry, show, record }) =>
									show ? (
										<PlaylistShowCard
											key={entry.showId}
											show={show}
											tags={tags}
											record={record}
											onEdit={() => {
												if (editingShowId === show.id) {
													modal.current?.showModal();
												} else {
													setEditingShowId(show.id);
												}
											}}
											entry={entry}
										/>
									) : (
										<div key={entry.showId}>
											Show unavailable — Show ID: {entry.showId}
										</div>
									),
								)}
							</section>
						)}
					</LoadingState>
				) : (
					<p>
						{playlistId
							? "Playlist not found in this browser."
							: "Choose a playlist from History."}
					</p>
				)}
			</LoadingState>
			{editingShowId !== undefined && (
				<PlaylistModal
					key={editingShowId}
					ref={modal}
					showId={editingShowId}
					mode="edit"
				/>
			)}
		</div>
	);
}
