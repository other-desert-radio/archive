import { useEffect, useState } from "react";
import LoadingState from "../../components/LoadingState";
import PlaylistShowCard from "../../components/playlists/PlaylistShowCard";
import { usePlaylists } from "../../components/playlists/usePlaylists";
import styles from "./PlaylistPage.module.css";
import { usePlaylistShows } from "./usePlaylistShows";

export default function PlaylistPage() {
	const { playlists, status } = usePlaylists();
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
	return (
		<div>
			<div className={styles["title-flex"]}>
				<h1>{playlist?.title ?? "Playlist"}</h1>
				<div className={styles["title-actions"]}>
					<button type="button" className="button-primary">
						Rename
					</button>
					<button type="button" className="button-primary button-danger">
						Delete
					</button>
				</div>
			</div>
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
		</div>
	);
}
