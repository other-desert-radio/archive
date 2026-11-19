import { useSyncExternalStore } from "react";
import { useInitialization } from "../../hooks/useInitialization";
import { useStores } from "../../stores";
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
	const { status, retry } = useInitialization(showDetailStore);
	const detail = useSyncExternalStore(
		showDetailStore.subscribe,
		() => showDetailStore.get(show.id),
		() => undefined,
	);
	const entries = detail?.tracklist ?? [];
	return (
		<div className={styles["fullscreen-details"]}>
			<a
				className={styles["fullscreen-title"]}
				href={`${base}/shows/${show.id}`}
				aria-label={`View ${show.title}`}
				onClick={onNavigate}
			>
				{show.title}
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
