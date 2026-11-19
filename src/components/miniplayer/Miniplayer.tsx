import { useRef } from "react";
import { useInitialization } from "../../hooks/useInitialization";
import { useStores } from "../../stores";
import type { AudioTrack } from "../../stores/audio";
import { useAudioState } from "../../stores/audio";
import MixcloudWidget from "../mixcloud";
import PlaylistModal from "../playlists/PlaylistModal";
import { DesktopActions, MobileExpand } from "./CompactActions";
import ExpandHandle from "./ExpandHandle";
import FullscreenDetails from "./FullscreenDetails";
import FullscreenNav from "./FullscreenNav";
import styles from "./Miniplayer.module.css";
import TrackTitle from "./TrackTitle";
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
	const stores = useStores();
	useInitialization(stores);
	const playlistModal = useRef<HTMLDialogElement>(null);
	const openFavorites = () => playlistModal.current?.showModal();
	const {
		presentation,
		compactHeight,
		playerRef,
		expand,
		close,
		closeImmediately,
	} = usePlayerPresentation();

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
						<MobileExpand onExpand={expand} />
						<ExpandHandle
							playerRef={playerRef}
							compactHeight={compactHeight}
							fullscreen={presentation === "fullscreen"}
							expand={expand}
							close={closeImmediately}
						/>
						<div className={styles["controls"]} data-miniplayer-scroll>
							{presentation === "fullscreen" && (
								<FullscreenDetails
									show={track.show}
									base={base}
									onNavigate={closeImmediately}
								/>
							)}
							<TrackTitle
								show={track.show}
								base={base}
								inert={presentation === "fullscreen"}
							/>
							<div className={styles["fullscreen-content"]}>
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
							<DesktopActions
								onFavorite={openFavorites}
								base={base}
								hidden={presentation === "fullscreen"}
								onExpand={expand}
							/>
						</div>
					</div>
					<PlaylistModal
						key={track.show.id}
						ref={playlistModal}
						showId={track.show.id}
					/>
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
