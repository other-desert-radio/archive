import tagCatalog from "../../res/tags.json";
import type { AudioTrack } from "../../stores/audio";
import { useAudioState } from "../../stores/audio";
import MixcloudWidget from "../mixcloud";
import { DesktopActions, MobileExpand } from "./CompactActions";
import {
	FullscreenDJs,
	FullscreenHeart,
	FullscreenTags,
} from "./FullscreenDetails";
import FullscreenNav from "./FullscreenNav";
import styles from "./Miniplayer.module.css";
import TrackTitle from "./TrackTitle";
import { usePlayerPresentation } from "./usePlayerPresentation";

const tags = new Map(tagCatalog.map((tag) => [tag.id, tag]));

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
						<MobileExpand
							hidden={presentation === "fullscreen"}
							onExpand={expand}
						/>
						<div className={styles["controls"]}>
							<div
								className={styles["fullscreen-artwork"]}
								hidden={presentation !== "fullscreen"}
							>
								{presentation === "fullscreen" && (
									<img src={track.show.image_large} alt={track.show.title} />
								)}
							</div>
							<TrackTitle
								show={track.show}
								base={base}
								hidden={presentation === "fullscreen"}
							/>
							<div className={styles["fullscreen-content"]}>
								<div
									className={styles["fullscreen-metadata"]}
									hidden={presentation !== "fullscreen"}
								>
									{presentation === "fullscreen" && (
										<a
											className={styles["fullscreen-title"]}
											href={`${base}/shows/${track.show.id}`}
											aria-label={`View ${track.show.title}`}
											onClick={close}
										>
											{track.show.title}
										</a>
									)}
									{presentation === "fullscreen" && (
										<FullscreenTags
											show={track.show}
											base={base}
											tags={tags}
											onNavigate={close}
										/>
									)}
								</div>
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
								<div className={styles["fullscreen-actions"]}>
									<div
										className={styles["fullscreen-heart"]}
										hidden={presentation !== "fullscreen"}
									>
										{presentation === "fullscreen" && (
											<FullscreenHeart base={base} />
										)}
									</div>
									<div
										className={styles["fullscreen-djs"]}
										hidden={presentation !== "fullscreen"}
									>
										{presentation === "fullscreen" && (
											<FullscreenDJs
												show={track.show}
												base={base}
												onNavigate={close}
											/>
										)}
									</div>
								</div>
							</div>
							<DesktopActions
								base={base}
								hidden={presentation === "fullscreen"}
								onExpand={expand}
							/>
						</div>
					</div>
				</div>
			);
		case "samcast": {
			return (
				<div className={styles["miniplayer"]} data-miniplayer>
					<div className={styles["controls"]}>
						<TrackTitle show={track.show} base={base} />
					</div>
					<div className={styles["progress-track"]} aria-hidden="true" />
				</div>
			);
		}
	}
}
