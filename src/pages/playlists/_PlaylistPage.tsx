import { useEffect, useState } from "react";
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
			<h1>{playlist?.title ?? "Playlist"}</h1>
			<p>Playlists are stored in this browser.</p>
			{status === "loading" && <p role="status">Loading playlist...</p>}
			{status === "error" && (
				<p role="alert">Could not load playlists. Reload the page to retry.</p>
			)}
			{status === "ready" &&
				(playlist ? (
					<pre className={styles["record"]}>
						{JSON.stringify(playlist, null, 2)}
					</pre>
				) : (
					<p>
						{playlistId
							? "Playlist not found in this browser."
							: "Choose a playlist from History."}
					</p>
				))}
		</div>
	);
}
