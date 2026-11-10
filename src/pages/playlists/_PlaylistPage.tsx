import { type SubmitEvent, useEffect, useRef, useState } from "react";
import ConfirmationModal from "../../components/ConfirmationModal";
import LoadingState from "../../components/LoadingState";
import PlaylistModal from "../../components/playlists/PlaylistModal";
import PlaylistShowCard from "../../components/playlists/PlaylistShowCard";
import { usePlaylists } from "../../components/playlists/usePlaylists";
import SearchBar from "../../components/search/SearchBar";
import { useSearchQuery } from "../../components/search/useSearchQuery";
import { useStores } from "../../stores";
import { getBasePath } from "../../utils/get-base-path";
import styles from "./PlaylistPage.module.css";
import { usePlaylistShows } from "./usePlaylistShows";

// Keep the ref stable so playback rerenders don't refocus the title field.
function focusTitle(input: HTMLTextAreaElement | null) {
	input?.focus();
}

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
	const deleteModal = useRef<HTMLDialogElement>(null);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string>();
	const deletePending = useRef(false);
	const modal = useRef<HTMLDialogElement>(null);
	const [editingShowId, setEditingShowId] = useState<number>();
	useEffect(() => {
		if (editingShowId !== undefined) {
			modal.current?.showModal();
		}
	}, [editingShowId]);
	const [playlistId, setPlaylistId] = useState("");
	const [query, setQuery] = useSearchQuery(`playlist:${playlistId}`);
	useEffect(() => {
		setPlaylistId(new URLSearchParams(window.location.search).get("id") ?? "");
	}, []);
	const playlist = playlists.find((item) => item.id === playlistId);
	const {
		shows,
		tags,
		status: showStatus,
		retry,
	} = usePlaylistShows(playlist?.shows ?? [], query);
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
	async function deletePlaylist() {
		if (deletePending.current || !playlist || playlist.type !== "user") {
			return;
		}
		deletePending.current = true;
		setDeleting(true);
		setDeleteError(undefined);
		try {
			await playlistStore.delete({ playlistId: playlist.id });
		} catch {
			setDeleteError("Could not delete playlist. Please try again.");
			return;
		} finally {
			deletePending.current = false;
			setDeleting(false);
		}
		deleteModal.current?.close();
		const { navigate } = await import("astro:transitions/client");
		await navigate(`${getBasePath()}/history`);
	}

	return (
		<div>
			{draftTitle !== undefined ? (
				<form
					className={styles["title-editor"]}
					onSubmit={rename}
					aria-busy={saving}
				>
					<textarea
						className={styles["title-input"]}
						rows={1}
						aria-label="Playlist title"
						ref={focusTitle}
						value={draftTitle}
						required
						disabled={saving}
						onChange={(event) => {
							setDraftTitle(event.currentTarget.value);
							setRenameError(undefined);
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.nativeEvent.isComposing) {
								event.preventDefault();
								event.currentTarget.form?.requestSubmit();
							}
							if (event.key === "Escape") {
								event.preventDefault();
								cancelRename();
							}
						}}
					/>
					<div className={styles["title-actions"]}>
						<button
							type="button"
							aria-label="Cancel playlist rename"
							disabled={saving}
							onClick={cancelRename}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<use href={`${getBasePath()}/assets/icons/close.svg#close`} />
							</svg>
						</button>
						<button
							type="submit"
							aria-label="Save playlist title"
							disabled={saving || !draftTitle.trim()}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<use href={`${getBasePath()}/assets/icons/check.svg#check`} />
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
								onClick={() => deleteModal.current?.showModal()}
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
			{playlist && <SearchBar value={query} onChange={setQuery} />}
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
							<p>
								{playlist.shows.length === 0
									? "No shows in this playlist."
									: "No shows found."}
							</p>
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
			<ConfirmationModal
				ref={deleteModal}
				title="Delete playlist?"
				body={
					<p>
						Delete “{playlist?.title}” from this device? This cannot be undone.
					</p>
				}
				primaryAction={{
					label: deleting ? "Deleting..." : "Delete playlist",
					onClick: deletePlaylist,
					destructive: true,
				}}
				cancelLabel="Cancel"
				pending={deleting}
				error={deleteError}
				onClose={() => setDeleteError(undefined)}
			/>

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
