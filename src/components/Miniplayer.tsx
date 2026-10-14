import { useState } from "react";
import type { AudioTrack } from "../stores/audio";
import { useAudioState } from "../stores/audio";
import styles from "./Miniplayer.module.css";
import MixcloudWidget from "./mixcloud";

type PlayerPresentation = "compact" | "fullscreen";

export default function Miniplayer({ base }: { base: string }) {
	const audio = useAudioState();

	if (audio.status === "idle") {
		return null;
	}
	return (
		<ActiveMiniplayer
			key={audio.track.source.kind}
			track={audio.track}
			base={base}
		/>
	);
}

function ActiveMiniplayer({
	track,
	base,
}: {
	track: AudioTrack;
	base: string;
}) {
	// Expand/close handlers will own transitions in the next implementation unit.
	const [presentation] = useState<PlayerPresentation>("compact");

	switch (track.source.kind) {
		case "mixcloud":
			return (
				<div
					className={styles["miniplayer"]}
					data-miniplayer
					data-presentation={presentation}
				>
					<div hidden={presentation !== "fullscreen"}>
						<span>OTHER DESERT RADIO</span>
						{/* The close SVG and handler are deferred to implementation. */}
						<button type="button" aria-label="Close player">
							Close
						</button>
					</div>
					<button
						type="button"
						className={styles["mobile-expand"]}
						aria-label="Expand player"
					>
						expand <span aria-hidden="true">↑</span>
					</button>
					<div className={styles["controls"]}>
						<TrackTitle show={track.show} base={base} />
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
						<div className={styles["desktop-actions"]}>
							<button type="button" aria-label="Favorite show">
								<span aria-hidden="true">{"\u2661\uFE0E"}</span>
							</button>
							<button type="button" aria-label="Expand player">
								<span aria-hidden="true">{"\u26F6\uFE0E"}</span>
							</button>
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
				<TrackTitle show={track.show} base={base} />
			</div>
			<div className={styles["progress-track"]} aria-hidden="true" />
		</div>
	);
}

function TrackTitle({
	show,
	base,
}: {
	show: AudioTrack["show"];
	base: string;
}) {
	return (
		<div className={styles["title"]}>
			<span className={styles["desktop-title"]}>
				{show.djs.map((dj, index) => (
					<span key={dj.id}>
						{index > 0 && ", "}
						<a href={`${base}/djs/${dj.id}`} aria-label={`View ${dj.title}`}>
							{dj.title}
						</a>
					</span>
				))}
				{show.djs.length > 0 && (
					<span className={styles["divider"]} aria-hidden="true">
						|
					</span>
				)}
				<a href={`${base}/shows/${show.id}`} aria-label={`View ${show.title}`}>
					{show.title}
				</a>
			</span>
		</div>
	);
}
