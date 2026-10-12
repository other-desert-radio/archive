import { useState } from "react";
import FullscreenPlayer from "./FullscreenPlayer";
import styles from "./Miniplayer.module.css";

export default function Miniplayer() {
	const [fullscreenOpen, setFullscreenOpen] = useState(false);

	return (
		<div className={styles["miniplayer"]} data-miniplayer>
			<div className={styles["controls"]}>
				<span className={styles["title"]}>MUSIC GOES HERE</span>
				<button
					type="button"
					aria-label="Open fullscreen player"
					aria-haspopup="dialog"
					onClick={() => setFullscreenOpen(true)}
				>
					F
				</button>
			</div>
			<div className={styles["progress-track"]} aria-hidden="true" />
			{fullscreenOpen && (
				<FullscreenPlayer onClose={() => setFullscreenOpen(false)} />
			)}
		</div>
	);
}
