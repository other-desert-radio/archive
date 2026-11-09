import { useEffect, useState } from "react";
import LoadingState from "../../components/LoadingState";
import { usePlaylists } from "../../components/playlists/usePlaylists";
import styles from "./PlaylistPage.module.css";

export default function PlaylistPage() {
	const { playlists, status } = usePlaylists();
	const [playlistId, setPlaylistId] = useState("");
	useEffect(() => {
		const pathname = window.location.pathname;
		const update = () => {
			// Back changes the URL before Astro swaps out this page.
			if (window.location.pathname === pathname) {
				setPlaylistId(window.location.hash.slice(1));
			}
		};
		update();
		window.addEventListener("hashchange", update);
		window.addEventListener("popstate", update);
		document.addEventListener("astro:page-load", update);
		return () => {
			window.removeEventListener("hashchange", update);
			window.removeEventListener("popstate", update);
			document.removeEventListener("astro:page-load", update);
		};
	}, []);
	const playlist = playlists.find((item) => item.id === playlistId);
	return (
		<div>
			<div className={styles["title-flex"]}>
				<h1>{playlist?.title ?? "Playlist"}</h1>
				<div className={styles["title-actions"]}>
					<button type="button">Edit</button>
					<button type="button">Delete</button>
				</div>
			</div>
			<p>Playlists are stored in this browser.</p>
			<LoadingState
				status={status}
				loading="Loading playlist..."
				error="Could not load playlists. Reload the page to retry."
			>
				{playlist ? (
					<pre className={styles["record"]}>
						{JSON.stringify(playlist, null, 2)}
					</pre>
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
