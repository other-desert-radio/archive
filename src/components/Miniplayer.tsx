import { useState } from "react";
import type { AudioTrack } from "../audio/audio-store";
import { useAudioState } from "../audio/use-audio-state";
import FullscreenPlayer from "./FullscreenPlayer";
import styles from "./Miniplayer.module.css";

export default function Miniplayer() {
	const audio = useAudioState();

	if (audio.status === "idle") return null;
	return <ActiveMiniplayer track={audio.track} />;
}

function ActiveMiniplayer({ track }: { track: AudioTrack }) {
	const [fullscreenOpen, setFullscreenOpen] = useState(false);

	return (
		<div className={styles["miniplayer"]} data-miniplayer>
			<div className={styles["controls"]}>
				<span className={styles["title"]}>{track.title}</span>
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
