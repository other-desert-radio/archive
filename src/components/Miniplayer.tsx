import { useState } from "react";
import type { AudioTrack } from "../stores/audio";
import { useAudioState } from "../stores/audio";
import FullscreenPlayer from "./FullscreenPlayer";
import styles from "./Miniplayer.module.css";
import MixcloudWidget from "./mixcloud";

export default function Miniplayer() {
	const audio = useAudioState();

	if (audio.status === "idle") {
		return null;
	}
	return <ActiveMiniplayer key={audio.track.source.kind} track={audio.track} />;
}

function ActiveMiniplayer({ track }: { track: AudioTrack }) {
	const [fullscreenOpen, setFullscreenOpen] = useState(false);

	switch (track.source.kind) {
		case "mixcloud":
			return (
				<div
					className={`${styles["miniplayer"]} ${styles["hover-player"]}`}
					data-miniplayer
				>
					<div className={styles["controls"]}>
						<div className={styles["widget-slot"]}>
							<MixcloudWidget
								initialCloudcastKey={track.source.cloudcastKey}
								iframeParams={{
									mini: true,
									hide_cover: true,
									hide_artwork: true,
									light: false,
								}}
							/>
						</div>
						<button type="button" aria-label="Open fullscreen player" disabled>
							F
						</button>
					</div>
					<div
						className={styles["expansion"]}
						data-miniplayer-expansion
						aria-hidden="true"
					/>
				</div>
			);
		case "samcast":
			break;
	}

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
