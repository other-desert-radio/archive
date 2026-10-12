export type AudioTrack = Readonly<{
	title: string;
	source: "mixcloud" | "samcast";
}>;

export type AudioState =
	| Readonly<{ status: "idle" }> // no track has been played yet
	| Readonly<{ status: "playing"; track: AudioTrack }>
	| Readonly<{ status: "paused"; track: AudioTrack }>;

const initialState: AudioState = Object.freeze({ status: "idle" });

type Listener = {
	notify: () => void;
};

export class AudioStore {
	private state: AudioState = initialState;
	private listeners = new Set<Listener>();

	getSnapshot = (): AudioState => this.state;

	// Astro's initial HTML and the first hydration render both start idle.
	getServerSnapshot = (): AudioState => initialState;

	subscribe = (notify: () => void) => {
		const listener: Listener = { notify };
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	// These methods update shared state; audio source adapters are still deferred.
	play(track?: AudioTrack) {
		const selected =
			track ?? (this.state.status === "idle" ? undefined : this.state.track);
		if (!selected) return;
		if (
			this.state.status === "playing" &&
			this.state.track.title === selected.title &&
			this.state.track.source === selected.source
		)
			return;
		this.update({ status: "playing", track: Object.freeze({ ...selected }) });
	}

	pause() {
		if (this.state.status !== "playing") return;
		this.update({ status: "paused", track: this.state.track });
	}

	clear() {
		if (this.state.status === "idle") return;
		this.update(initialState);
	}

	private update(state: AudioState) {
		this.state = Object.freeze(state);
		for (const listener of this.listeners) {
			listener.notify();
		}
	}
}

// One shared instance per browser module graph, retained across ClientRouter navigation.
export const audioStore = new AudioStore();
