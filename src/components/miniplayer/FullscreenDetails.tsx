import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { useInitialization } from "../../hooks/useInitialization";
import { useStores } from "../../stores";
import { useAudioState } from "../../stores/audio";
import type { ShowDetailEntry } from "../../stores/show-details/types";
import type { Show } from "../../utils/fetch-shows";
import SaveToPlaylist from "../playlists/SaveToPlaylist";
import styles from "./Miniplayer.module.css";

export function FullscreenTracklist({
	entries,
}: {
	entries: readonly ShowDetailEntry[];
}) {
	if (entries.length === 0) {
		return null;
	}
	const occurrences = new Map<string, number>();
	return (
		<section className={styles["fullscreen-tracklist"]} aria-label="Tracklist">
			<h2>TRACKLIST</h2>
			<ol>
				{entries.map((entry) => {
					const value = JSON.stringify(entry);
					const occurrence = occurrences.get(value) ?? 0;
					occurrences.set(value, occurrence + 1);
					return (
						<li key={`${value}:${occurrence}`}>
							{"chapter" in entry
								? entry.chapter
								: `${entry.artist} — ${entry.song}`}
						</li>
					);
				})}
			</ol>
		</section>
	);
}

export default function FullscreenDetails({
	show,
	base,
	onNavigate,
}: {
	show: Show;
	base: string;
	onNavigate: () => void;
}) {
	const { showDetailStore } = useStores();
	const audio = useAudioState();
	const { status, retry } = useInitialization(showDetailStore);
	const detail = useSyncExternalStore(
		showDetailStore.subscribe,
		() => showDetailStore.get(show.id),
		() => undefined,
	);
	const entries = detail?.tracklist ?? [];
	const titleRef = useRef<HTMLAnchorElement>(null);
	useLayoutEffect(() => {
		const title = titleRef.current;
		const text = title?.firstElementChild;
		if (!title || !(text instanceof HTMLElement)) {
			return;
		}
		const fit = () => {
			text.style.removeProperty("--fitted-title-size");
			if (text.offsetWidth > title.clientWidth && title.clientWidth > 0) {
				const size = Number.parseFloat(getComputedStyle(text).fontSize);
				text.style.setProperty(
					"--fitted-title-size",
					`${(size * title.clientWidth) / text.getBoundingClientRect().width}px`,
				);
			}
		};
		const observer = new ResizeObserver(fit);
		observer.observe(title);
		fit();
		void document.fonts.ready.then(() => {
			if (title.isConnected) {
				fit();
			}
		});
		return () => observer.disconnect();
	});
	return (
		<div
			className={styles["fullscreen-details"]}
			data-has-tracklist={entries.length > 0}
			data-playing={audio.status === "playing"}
		>
			<a
				ref={titleRef}
				className={styles["fullscreen-title"]}
				href={`${base}/shows/${show.id}`}
				aria-label={`View ${show.title}`}
				onClick={onNavigate}
			>
				<span className={styles["fullscreen-title-text"]}>{show.title}</span>
				<span className={styles["fullscreen-marquee"]} aria-hidden="true">
					{["first", "second", "third"].map((row) => (
						<span className={styles["marquee-row"]} key={row}>
							{["original", "loop"].map((group) => (
								<span className={styles["marquee-group"]} key={group}>
									<span>{show.title}</span>
									<span>{show.title}</span>
									<span>{show.title}</span>
								</span>
							))}
						</span>
					))}
				</span>
			</a>
			<div
				className={styles["fullscreen-body"]}
				data-has-tracklist={entries.length > 0}
			>
				<div className={styles["fullscreen-artwork"]}>
					<img src={show.image_large} alt={show.title} />
					<div className={styles["fullscreen-save"]}>
						<SaveToPlaylist key={show.id} showId={show.id} showNote={false} />
					</div>
				</div>
				<FullscreenTracklist entries={entries} />
			</div>
			{status === "error" && (
				<button
					type="button"
					aria-label="Retry loading tracklist"
					onClick={retry}
				>
					Retry loading tracklist
				</button>
			)}
		</div>
	);
}
