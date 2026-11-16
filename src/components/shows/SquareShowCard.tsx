import { useCallback, useSyncExternalStore } from "react";
import { useAudioState, useStores } from "../../stores";
import type { PlaybackRecord } from "../../stores/playback/types";
import type { Show } from "../../utils/fetch-shows";
import { getBasePath } from "../../utils/get-base-path";
import styles from "./SquareShowCard.module.css";
import {
	isSelectedShow,
	mixcloudShowTrack,
	toggleShowPlayback,
} from "./show-playback";

type DetailsShow = Pick<Show, "id" | "title" | "duration" | "image_large">;

type Props = {
	record?: Pick<PlaybackRecord, "positionInSeconds" | "inProgress"> | undefined;
	base: string;
	loading?: "lazy" | "eager";
	border?: "primary" | "secondary";
	alwaysShowProgress?: boolean;
} & (
	| { mode: "playback"; show: Show; fromTag?: never }
	| {
			mode: "details";
			show: DetailsShow;
			fromTag?: number | undefined;
	  }
);

// Hydrate related-show grids once rather than creating an island per card.
export function SquareShowCards({
	shows,
	base,
	fromTag,
}: {
	shows: DetailsShow[];
	base: string;
	fromTag?: number;
}) {
	return shows.map((show) => (
		<SquareShowCard
			key={show.id}
			mode="details"
			show={show}
			base={base}
			fromTag={fromTag}
		/>
	));
}

export default function SquareShowCard({
	show,
	mode,
	fromTag,
	record,
	base,
	loading = "lazy",
	border = "primary",
	alwaysShowProgress = false,
}: Props) {
	const detailBase = getBasePath(base);
	const { playbackStore } = useStores();
	const subscribe = useCallback(
		(notify: () => void) =>
			record === undefined ? playbackStore.subscribe(notify) : () => {},
		[playbackStore, record],
	);
	const playbackRecord = useSyncExternalStore(
		subscribe,
		() =>
			record ??
			playbackStore.getSnapshot().find((entry) => entry.showId === show.id),
		() => record,
	);
	const progress =
		playbackRecord &&
		Number.isFinite(playbackRecord.positionInSeconds) &&
		Number.isFinite(show.duration) &&
		show.duration > 0
			? Math.min(
					100,
					Math.max(0, (playbackRecord.positionInSeconds / show.duration) * 100),
				)
			: undefined;
	const remaining = Math.ceil(
		Math.max(
			0,
			show.duration - Math.max(0, playbackRecord?.positionInSeconds ?? 0),
		),
	);

	return (
		<div
			className={styles["artwork"]}
			data-always-show-progress={alwaysShowProgress || undefined}
		>
			<img
				className={`${styles["show-image"]} image-border-${border}`}
				src={show.image_large}
				alt={show.title}
				loading={loading}
				decoding="async"
			/>
			{mode === "playback" ? (
				<PlaybackButton show={show} base={detailBase} />
			) : (
				<a
					className={styles["details-link"]}
					href={`${detailBase}/shows/${show.id}${fromTag === undefined ? "" : `?fromTag=${fromTag}`}`}
					aria-label={`View ${show.title}`}
				>
					<span className={`${styles["overlay"]} image-border-${border}`}>
						<span className={styles["title"]}>{show.title}</span>
					</span>
				</a>
			)}
			{playbackRecord?.inProgress === false || progress === 100 ? (
				<span className={styles["played"]}>
					PLAYED
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						aria-hidden="true"
					>
						<use href={`${detailBase}/assets/icons/check.svg#check`} />
					</svg>
				</span>
			) : (
				progress !== undefined && (
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
				)
			)}
		</div>
	);
}

function PlaybackButton({ show, base }: { show: Show; base: string }) {
	const { audioStore } = useStores();
	const audio = useAudioState();
	const track = mixcloudShowTrack(show);
	const selected = isSelectedShow(audio, track);
	const pause =
		selected && (audio.status === "playing" || audio.status === "loading");
	return (
		<button
			type="button"
			className={styles["playback-button"]}
			data-show-playback
			data-selected={selected}
			aria-label={`${pause ? "Pause" : "Play"} ${show.title}`}
			onClick={() => toggleShowPlayback(audioStore, track)}
		>
			<img
				src={`${base}/assets/icons/${pause ? "pause" : "play"}.svg`}
				alt=""
				aria-hidden="true"
			/>
		</button>
	);
}
