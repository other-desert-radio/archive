import type { Playlist } from "../../stores";
import { getBasePath } from "../../utils/get-base-path";
import styles from "./PlaylistView.module.css";

export default function PlaylistView({ playlist }: { playlist: Playlist }) {
	return (
		<a
			className={styles["playlist"]}
			href={`${getBasePath()}/playlists/#${playlist.id}`}
			aria-label={`View playlist ${playlist.title}`}
		>
			{playlist.title}
		</a>
	);
}
