import type { Playlist } from "../../stores";
import type { Show } from "../../utils/fetch-shows";
import { getBasePath } from "../../utils/get-base-path";
import styles from "./PlaylistCard.module.css";

type PlaylistCardProps = {
	playlist: Playlist;
	shows: readonly Show[];
};

export default function PlaylistCard({ playlist, shows }: PlaylistCardProps) {
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
					<img
						key={show.id}
						className={styles["show-image"]}
						src={show.image_large}
						alt={show.title}
						loading="lazy"
						decoding="async"
					/>
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
