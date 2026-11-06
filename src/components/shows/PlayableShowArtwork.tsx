import { useAudioState, useStores } from "../../stores";
import type { PlaybackRecord } from "../../stores/playback/types";
import type { Show } from "../../utils/fetch-shows";
import { getBasePath } from "../../utils/get-base-path";
import styles from "./PlayableShowArtwork.module.css";
import {
	isSelectedShow,
	mixcloudShowTrack,
	toggleShowPlayback,
} from "./show-playback";

type Props = {
	show: Show;
	record?: Pick<PlaybackRecord, "positionInSeconds" | "inProgress"> | undefined;
	base: string;
	loading?: "lazy" | "eager";
	border?: "primary" | "secondary";
	alwaysShowProgress?: boolean;
};

export default function PlayableShowArtwork({
	show,
	record,
	base,
	loading = "lazy",
	border = "primary",
	alwaysShowProgress = false,
}: Props) {
	const detailBase = getBasePath(base);
	const { audioStore } = useStores();
	const audio = useAudioState();
	const track = mixcloudShowTrack(show);
	const selected = isSelectedShow(audio, track);
	const pause =
		selected && (audio.status === "playing" || audio.status === "loading");
	const progress =
		record &&
		Number.isFinite(record.positionInSeconds) &&
		Number.isFinite(show.duration) &&
		show.duration > 0
			? Math.min(
					100,
					Math.max(0, (record.positionInSeconds / show.duration) * 100),
				)
			: undefined;
	const remaining = Math.ceil(
		Math.max(0, show.duration - Math.max(0, record?.positionInSeconds ?? 0)),
	);

	return (
		<div
			className={styles["artwork"]}
			data-always-show-progress={alwaysShowProgress}
		>
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
			{progress !== undefined && (
				<div
					className={`${styles["progress"]} image-border-${border}`}
					role="progressbar"
					aria-label={`Playback progress for ${show.title}`}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={progress}
				>
					<div
						className={styles["elapsed"]}
						style={{ width: `${progress}%` }}
					/>
					<span className={styles["remaining"]}>
						{Math.floor(remaining / 60)}:
						{String(remaining % 60).padStart(2, "0")}
					</span>
				</div>
			)}
		</div>
	);
}
