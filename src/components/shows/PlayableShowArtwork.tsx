import { useAudioState, useStores } from "../../stores";
import type { Show } from "../../utils/fetch-shows";
import styles from "./PlayableShowArtwork.module.css";
import {
	isSelectedShow,
	mixcloudShowTrack,
	toggleShowPlayback,
} from "./show-playback";

type Props = {
	show: Show;
	base: string;
	loading?: "lazy" | "eager";
	border?: "primary" | "secondary";
};

export default function PlayableShowArtwork({
	show,
	base,
	loading = "lazy",
	border = "primary",
}: Props) {
	const detailBase = base.replace(/\/$/, "");
	const { audioStore } = useStores();
	const audio = useAudioState();
	const track = mixcloudShowTrack(show);
	const selected = isSelectedShow(audio, track);
	const pause =
		selected && (audio.status === "playing" || audio.status === "loading");

	return (
		<div className={styles["artwork"]}>
			<img
				className={`${styles["show-image"]} image-border-${border}`}
				src={show.image_large}
				alt={show.title}
				loading={loading}
				decoding="async"
			/>
			<button
				type="button"
				className={styles["playback-button"]}
				data-show-playback
				data-selected={selected}
				aria-label={`${pause ? "Pause" : "Play"} ${show.title}`}
				onClick={() => toggleShowPlayback(audioStore, track)}
			>
				<img
					src={`${detailBase}/assets/icons/${pause ? "pause" : "play"}.svg`}
					alt=""
					aria-hidden="true"
				/>
			</button>
		</div>
	);
}
