import type { AudioTrack } from "../stores/audio";
import { useAudioState } from "../stores/audio";
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
	switch (track.source.kind) {
		case "mixcloud":
			return (
				<div className={styles["miniplayer"]} data-miniplayer>
					<div className={styles["controls"]}>
						<span className={styles["title"]}>{track.show.title}</span>
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
					</div>
				</div>
			);
		case "samcast":
			break;
	}

	return (
		<div className={styles["miniplayer"]} data-miniplayer>
			<div className={styles["controls"]}>
				<span className={styles["title"]}>{track.show.title}</span>
			</div>
			<div className={styles["progress-track"]} aria-hidden="true" />
		</div>
	);
}
