import { useEffect, useRef, useState } from "react";
import type { AudioTrack } from "../../stores/audio";
import { useAudioState } from "../../stores/audio";
import MixcloudWidget from "../mixcloud";
import styles from "./Miniplayer.module.css";

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
	const [presentation, setPresentation] =
		useState<PlayerPresentation>("compact");
	const [compactHeight, setCompactHeight] = useState<number>();
	const playerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (presentation !== "fullscreen") {
			return;
		}

		const { scrollX, scrollY } = window;
		const body = document.body;
		const root = document.documentElement;
		const scrollbarWidth = window.innerWidth - root.clientWidth;
		const bodyPadding = Number.parseFloat(getComputedStyle(body).paddingRight);
		const bodyProperties = [
			"position",
			"top",
			"left",
			"width",
			"overflow",
			"padding-right",
		];
		const savedBodyStyles = bodyProperties.map((property) => ({
			property,
			value: body.style.getPropertyValue(property),
			priority: body.style.getPropertyPriority(property),
		}));
		const rootOverflow = root.style.getPropertyValue("overflow");
		const rootOverflowPriority = root.style.getPropertyPriority("overflow");

		// Fixing the body also locks touch scrolling in iOS Safari. Keep the
		// iframe attached and offset the page to preserve its current position.
		body.style.position = "fixed";
		body.style.top = `${-scrollY}px`;
		body.style.left = `${-scrollX}px`;
		body.style.width = "100%";
		body.style.overflow = "hidden";
		body.style.paddingRight = `${bodyPadding + scrollbarWidth}px`;
		root.style.overflow = "hidden";

		return () => {
			for (const { property, value, priority } of savedBodyStyles) {
				body.style.setProperty(property, value, priority);
			}
			root.style.setProperty("overflow", rootOverflow, rootOverflowPriority);
			window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
		};
	}, [presentation]);

	function expand() {
		setCompactHeight(playerRef.current?.getBoundingClientRect().height);
		setPresentation("fullscreen");
	}

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
							<FullscreenNav
								base={base}
								onClose={() => setPresentation("compact")}
							/>
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
