import type { AudioState, AudioStore, AudioTrack } from "../../stores/audio";
import type { Show } from "../../utils/fetch-shows";

export function mixcloudShowTrack(show: Show): AudioTrack {
	const url = new URL(show.url);
	if (
		url.protocol !== "https:" ||
		!["www.mixcloud.com", "mixcloud.com"].includes(url.hostname) ||
		url.port ||
		url.username ||
		url.password ||
		!/^\/[^/?#\s]+\/[^/?#\s]+\/$/.test(url.pathname)
	) {
		throw new Error("Expected a Mixcloud show URL.");
	}
	return {
		title: show.title,
		source: { kind: "mixcloud", cloudcastKey: url.pathname },
	};
}

export function isSelectedShow(state: AudioState, track: AudioTrack): boolean {
	return (
		state.status !== "idle" &&
		state.track.source.kind === "mixcloud" &&
		track.source.kind === "mixcloud" &&
		state.track.source.cloudcastKey === track.source.cloudcastKey
	);
}

export function toggleShowPlayback(store: AudioStore, track: AudioTrack) {
	const state = store.getSnapshot();
	if (!isSelectedShow(state, track)) {
		store.select(track);
		return;
	}
	if (state.status === "playing" || state.status === "loading") {
		store.pause();
		return;
	}
	store.play();
}
