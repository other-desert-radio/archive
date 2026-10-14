import type { AudioTrack } from "../../stores/audio";
import { useAudioState } from "../../stores/audio";
import MixcloudWidget from "../mixcloud";
import styles from "./Miniplayer.module.css";
import { usePlayerPresentation } from "./usePlayerPresentation";

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
	const { presentation, compactHeight, playerRef, expand, close } =
		usePlayerPresentation();

	switch (track.source.kind) {
		case "mixcloud":
			return (
				<div
					className={styles["player-shell"]}
					style={{
						height: presentation === "fullscreen" ? compactHeight : undefined,
					}}
				>
					<div
						ref={playerRef}
						className={styles["miniplayer"]}
						data-miniplayer
						data-presentation={presentation}
					>
						{presentation === "fullscreen" && (
							<FullscreenNav base={base} onClose={close} />
						)}
						<button
							type="button"
							className={styles["mobile-expand"]}
							hidden={presentation === "fullscreen"}
							onClick={expand}
							aria-label="Expand player"
						>
							expand <span aria-hidden="true">↑</span>
						</button>
						<div className={styles["controls"]}>
							<TrackTitle
								show={track.show}
								base={base}
								hidden={presentation === "fullscreen"}
							/>
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
							<div
								className={styles["desktop-actions"]}
								hidden={presentation === "fullscreen"}
							>
								<button type="button" aria-label="Favorite show">
									<span className={styles["heart-icon"]} aria-hidden="true">
										{"\u2661\uFE0E"}
									</span>
								</button>
								<button
									type="button"
									aria-label="Expand player"
									onClick={expand}
								>
									<span aria-hidden="true">{"\u26F6\uFE0E"}</span>
								</button>
							</div>
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

function FullscreenNav({
	base,
	onClose,
}: {
	base: string;
	onClose: () => void;
}) {
	return (
		<div className={styles["fullscreen-header"]}>
			<span>OTHER DESERT RADIO</span>
			<button
				type="button"
				className={styles["close-button"]}
				aria-label="Close player"
				onClick={onClose}
			>
				<img src={`${base}/assets/icons/close.svg`} alt="" aria-hidden="true" />
			</button>
		</div>
	);
}

function TrackTitle({
	show,
	base,
	hidden = false,
}: {
	show: AudioTrack["show"];
	base: string;
	hidden?: boolean;
}) {
	return (
		<div className={styles["title"]} hidden={hidden}>
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
