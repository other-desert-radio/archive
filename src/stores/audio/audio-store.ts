export type PlaybackSource =
	| Readonly<{ kind: "mixcloud"; cloudcastKey: string }>
	| Readonly<{ kind: "samcast"; streamUrl: string }>;

export type AudioTrack = Readonly<{
	title: string;
	source: PlaybackSource;
}>;

export type AudioState =
	| Readonly<{ status: "idle" }>
	| Readonly<{ status: "loading" | "playing" | "paused"; track: AudioTrack }>
	| Readonly<{ status: "error"; track: AudioTrack; message: string }>;

export type PlaybackRequest =
	| Readonly<{
			id: number;
			action: "load" | "play" | "pause";
			track: AudioTrack;
	  }>
	| Readonly<{ id: number; action: "clear" }>;

const initialState: AudioState = Object.freeze({ status: "idle" });

type Listener = {
	notify: () => void;
};

function subscribeTo(listeners: Set<Listener>, notify: () => void) {
	const listener: Listener = { notify };
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export class AudioStore {
	private state: AudioState = initialState;
	private request: PlaybackRequest | undefined;
	private requestId = 0;
	private listeners = new Set<Listener>();
	private requestListeners = new Set<Listener>();

	getSnapshot = (): AudioState => this.state;

	// Astro's initial HTML and the first hydration render both start idle.
	getServerSnapshot = (): AudioState => initialState;

	subscribe = (notify: () => void) => subscribeTo(this.listeners, notify);

	// Adapters read the latest intent here, including after mounting or becoming ready.
	getRequestSnapshot = (): PlaybackRequest | undefined => this.request;
	subscribeRequests = (notify: () => void) =>
		subscribeTo(this.requestListeners, notify);

	select(track: AudioTrack) {
		const selected = Object.freeze({
			...track,
			source: Object.freeze({ ...track.source }),
		});
		this.publish({ id: ++this.requestId, action: "load", track: selected });
		this.update({ status: "loading", track: selected });
		this.notifyRequests();
	}

	play(track?: AudioTrack) {
		if (track) {
			this.select(track);
			return;
		}
		if (this.state.status === "idle") return;
		if (this.state.status === "playing" && this.request?.action !== "pause")
			return;
		const selected = this.state.track;
		this.publish({ id: ++this.requestId, action: "play", track: selected });
		if (this.state.status === "error") {
			this.update({ status: "loading", track: selected });
		}
		this.notifyRequests();
	}

	pause() {
		if (this.state.status === "idle") return;
		if (this.state.status === "paused" && this.request?.action !== "play")
			return;
		this.publish({
			id: ++this.requestId,
			action: "pause",
			track: this.state.track,
		});
		this.notifyRequests();
	}

	clear() {
		if (this.state.status === "idle") return;
		this.publish({ id: ++this.requestId, action: "clear" });
		this.update(initialState);
		this.notifyRequests();
	}

	// Pass the track object from the request, not the original caller's metadata.
	// Its identity prevents an old source's callbacks from updating a newer selection.
	confirmPlaying(track: AudioTrack) {
		if (!this.isCurrent(track) || this.state.status === "playing") return;
		this.update({ status: "playing", track });
	}

	confirmPaused(track: AudioTrack) {
		if (!this.isCurrent(track) || this.state.status === "paused") return;
		this.update({ status: "paused", track });
	}

	reportError(track: AudioTrack, message: string) {
		if (!this.isCurrent(track)) return;
		this.update({ status: "error", track, message });
	}

	private isCurrent(track: AudioTrack): boolean {
		return this.state.status !== "idle" && this.state.track === track;
	}

	private publish(request: PlaybackRequest) {
		this.request = Object.freeze(request);
	}

	private notifyRequests() {
		for (const listener of this.requestListeners) listener.notify();
	}

	private update(state: AudioState) {
		this.state = Object.freeze(state);
		for (const listener of this.listeners) listener.notify();
	}
}
