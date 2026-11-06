import type { Playlist } from "../../stores";
import type { Show } from "../../utils/fetch-shows";
import { getBasePath } from "../../utils/get-base-path";
import PlayableShowArtwork from "../shows/PlayableShowArtwork";
import styles from "./PlaylistView.module.css";

type PlaylistViewProps = {
	playlist: Playlist;
	shows: readonly Show[];
};

export default function PlaylistView({ playlist, shows }: PlaylistViewProps) {
	const base = getBasePath();
	const recentShows = [...playlist.shows]
		.sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt))
		.flatMap((entry) => {
			const show = shows.find((show) => show.id === entry.showId);
			return show ? [show] : [];
		})
		.slice(0, 4);

	return (
		<div className={styles["playlist-container"]}>
			<div className={styles["playlist-shows-grid"]}>
				{recentShows.map((show) => (
					<PlayableShowArtwork key={show.id} show={show} base={base} />
				))}
				{[0, 1, 2, 3].slice(recentShows.length).map((slot) => (
					<div
						key={`placeholder-${slot}`}
						className={styles["placeholder"]}
						aria-hidden="true"
					/>
				))}
			</div>
			<a
				className={styles["playlist"]}
				href={`${base}/playlists/#${playlist.id}`}
				aria-label={`View playlist ${playlist.title}`}
			>
				{playlist.title}
			</a>
		</div>
	);
}
