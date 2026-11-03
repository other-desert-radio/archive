import { match, P } from "ts-pattern";
import type {
	AudioStore,
	AudioTrack,
	PlaybackRequest,
} from "../../stores/audio/audio-store";
import type { PlaybackStore } from "../../stores/playback/playback-store";
import type { MixcloudWidget } from "./mixcloud-api";

/**
 * Applies the shared store's playback requests to one existing Mixcloud widget.
 *
 * Owner: MixcloudWidget creates one adapter for its iframe, using audioStore
 * from useStores(), and disposes it during effect cleanup. The adapter never
 * creates or moves the iframe.
 *
 * Loads are serialized and use the latest request after readiness and each
 * completion. Track identity avoids reloading for play/pause requests while
 * allowing an explicit reselection of the same show to load again.
 *
 * Loads with autoplay disabled, then applies the latest play/pause intent.
 * Resume seeks wait for confirmed play because earlier seeks reset on startup.
 * Clear, source changes, and disposal pause the widget. Command completion
 * does not confirm playing or paused state; widget events confirm the loaded track.
 */
export class MixcloudAdapter {
	private widget: MixcloudWidget | undefined;
	private loadedTrack: AudioTrack | undefined;
	private latestRequest: PlaybackRequest | undefined;
	private processedRequestId: number | undefined;
	private running = false;
	private disposed = false;
	private unsubscribe: () => void;
	private historyReady = false;
	private completed = false;
	private resumePosition: number | undefined;
	private seeking = false;

	/**
	 * Seeds the latest selection, then caches requests until the widget is ready.
	 * @param store Shared playback store; confirmations and errors use its selected track.
	 * @param widgetReady Validated widget readiness promise from the iframe owner.
	 * @param playback Local sessions and resume progress, independent of catalog refresh.
	 * Readiness failure reports an error for the current Mixcloud selection.
	 */
	constructor(
		private store: AudioStore,
		widgetReady: PromiseLike<MixcloudWidget>,
		private readonly playback: PlaybackStore,
	) {
		this.latestRequest = store.getRequestSnapshot();
		this.unsubscribe = store.subscribeRequests((request) => {
			this.latestRequest = request;
			if (request.action === "clear" || request.track !== this.loadedTrack) {
				this.save(this.playback.flush());
				if (this.loadedTrack && request.action !== "clear") {
					const previous = this.playback.get(this.loadedTrack.show.id);
					console.log(
						"[PlaybackStore] Switching shows; saving previous position",
						{
							showId: this.loadedTrack.show.id,
							nextShowId: request.track.show.id,
							positionInSeconds: previous?.positionInSeconds,
							inProgress: previous?.inProgress,
							session: previous?.history.at(-1),
						},
					);
				}
			}
			const shouldPause = match(request)
				// Stop the old show on clear, a source change, or a different track.
				// Track identity allows reselection while preserving play/pause intent.
				.with(
					{ action: "clear" },
					{ track: { source: { kind: P.not("mixcloud") } } },
					{
						track: P.when(
							(track) =>
								this.loadedTrack !== undefined && track !== this.loadedTrack,
						),
					},
					() => true,
				)
				// Interrupt a pending command; otherwise the idle loop applies the pause.
				.with({ action: "pause" }, () => this.running)
				.otherwise(() => false);
			if (shouldPause) {
				// Interrupt old playback even while a previous command is pending.
				void this.pauseGently();
			}
			void this.processRequests();
		});
		Promise.resolve(widgetReady).then(
			(widget) => {
				if (this.disposed) {
					void this.pauseGently(widget);
					return;
				}
				this.widget = widget;
				widget.events.play.on(this.onPlay);
				widget.events.pause.on(this.onPause);
				widget.events.error.on(this.onError);
				widget.events.progress.on(this.onProgress);
				widget.events.buffering.on(this.onBuffering);
				widget.events.ended.on(this.onEnded);
				// Includes requests made before mounting or during widget initialization.
				void this.processRequests();
			},
			() => {
				if (this.disposed) {
					return;
				}
				const request = this.latestRequest;
				if (
					request &&
					request.action !== "clear" &&
					request.track.source.kind === "mixcloud"
				) {
					this.store.reportError(
						request.track,
						"Mixcloud widget could not initialize.",
					);
				}
			},
		);
	}

	/**
	 * Unsubscribes and ignores pending results. Safe to call more than once.
	 * Requests a pause; in-flight widget promises cannot be canceled. The adapter
	 * also pauses after a pending command settles, but never removes the iframe.
	 * A disposed adapter cannot be reused.
	 */
	dispose() {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.unsubscribe();
		this.save(this.playback.flush());
		if (this.widget) {
			this.widget.events.play.off(this.onPlay);
			this.widget.events.pause.off(this.onPause);
			this.widget.events.error.off(this.onError);
			this.widget.events.progress.off(this.onProgress);
			this.widget.events.buffering.off(this.onBuffering);
			this.widget.events.ended.off(this.onEnded);
		}
		void this.pauseGently();
		this.widget = undefined;
		this.loadedTrack = undefined;
	}

	// Events have no show identity. Ignore them during loads and use the store's
	// identity check to reject callbacks after selection changes or clear.
	private onPlay = () => {
		if (!this.isCurrent() || !this.loadedTrack || this.seeking) {
			return;
		}
		if (this.completed) {
			this.completed = false;
		}
		this.store.confirmPlaying(this.loadedTrack);
		if (this.resumePosition !== undefined && this.widget) {
			const position = this.resumePosition;
			const track = this.loadedTrack;
			const widget = this.widget;
			this.resumePosition = undefined;
			this.seeking = true;
			// Mixcloud accepts an earlier seek but resets it when audio starts.
			void Promise.resolve()
				.then(() => {
					if (this.isCurrent() && this.loadedTrack === track) {
						console.log("[PlaybackStore] Resuming from saved position", {
							showId: track.show.id,
							positionInSeconds: position,
						});
						return widget.seek(position);
					}
					return undefined;
				})
				.then((allowed) => {
					if (allowed === true) {
						console.log("[PlaybackStore] Resume seek accepted", {
							showId: track.show.id,
							positionInSeconds: position,
						});
					}
					if (allowed === false) {
						console.error("[PlaybackStore] Mixcloud refused resume position");
					}
				})
				.catch((error: unknown) => {
					console.error("[PlaybackStore] resume seek failed", error);
				})
				.finally(() => {
					if (this.loadedTrack === track) {
						this.seeking = false;
						if (this.store.getSnapshot().status === "paused") {
							void this.pauseGently(widget);
						}
					}
				});
		}
	};

	private onPause = () => {
		if (!this.isCurrent() || !this.loadedTrack) {
			return;
		}
		this.save(this.playback.flush());
		this.store.confirmPaused(this.loadedTrack);
	};

	private onError = () => {
		if (!this.isCurrent() || !this.loadedTrack) {
			return;
		}
		this.save(this.playback.flush());
		this.store.reportError(
			this.loadedTrack,
			"Mixcloud playback failed. Try the widget controls.",
		);
	};

	private isCurrent(): boolean {
		const state = this.store.getSnapshot();
		return (
			!this.disposed &&
			state.status !== "idle" &&
			state.track === this.loadedTrack
		);
	}

	private onProgress = (position: number, _duration: number) => {
		if (
			!this.isCurrent() ||
			!this.historyReady ||
			this.completed ||
			this.seeking ||
			!this.loadedTrack ||
			this.store.getSnapshot().status !== "playing" ||
			!Number.isFinite(position) ||
			position < 0
		) {
			return;
		}

		this.save(this.playback.progress(this.loadedTrack.show.id, position));
	};

	private onBuffering = () => {
		if (this.isCurrent()) {
			this.save(this.playback.flush());
		}
	};

	private onEnded = () => {
		if (
			!this.isCurrent() ||
			!this.loadedTrack ||
			this.completed ||
			!this.historyReady
		) {
			return;
		}
		this.save(this.playback.complete(this.loadedTrack.show.id));
		this.completed = true;
		this.store.confirmPaused(this.loadedTrack);
	};

	private save(result: Promise<void>): void {
		void result.catch((error: unknown) => {
			console.error("[PlaybackStore] save failed; will retry", error);
		});
	}

	/**
	 * Drains new requests through one load at a time, skipping intermediate selections.
	 * Only errors for the latest request reach the store; a newer request can retry.
	 */
	private async processRequests() {
		const widget = this.widget;
		if (!widget || this.disposed || this.running) {
			return;
		}
		this.running = true;
		try {
			while (!this.disposed) {
				const request = this.store.getRequestSnapshot();
				if (!request || request.id === this.processedRequestId) {
					return;
				}
				this.processedRequestId = request.id;
				if (
					request.action === "clear" ||
					request.track.source.kind !== "mixcloud"
				) {
					await this.pauseGently(widget);
					this.loadedTrack = undefined;
					continue;
				}
				// Seeking after ended can restart audio without another play event.
				if (this.completed && request.action === "play") {
					this.loadedTrack = undefined;
				}
				if (request.track !== this.loadedTrack) {
					if (this.loadedTrack) {
						await this.pauseGently(widget);
						if (this.disposed) {
							return;
						}
						if (this.store.getRequestSnapshot()?.id !== request.id) {
							continue;
						}
					}
					try {
						this.loadedTrack = undefined;
						this.completed = false;
						this.resumePosition = undefined;
						this.seeking = false;
						this.historyReady = false;
						try {
							await this.playback.initialize();
							this.historyReady = true;
						} catch (error) {
							console.error("[PlaybackStore] resume unavailable", error);
						}
						if (this.disposed) {
							return;
						}
						if (this.store.getRequestSnapshot()?.id !== request.id) {
							continue;
						}
						// Do not autoplay a selection that could be superseded while loading.
						await widget.load(request.track.source.cloudcastKey, false);
						const current = this.store.getRequestSnapshot();
						if (
							!this.disposed &&
							current?.action !== "clear" &&
							current?.track === request.track
						) {
							const saved = this.playback.get(request.track.show.id);
							if (saved?.inProgress && saved.positionInSeconds > 0) {
								console.log(
									"[PlaybackStore] Found saved playback record for resume",
									{
										objectStore: "playback",
										key: request.track.show.id,
										record: saved,
									},
								);
								this.resumePosition = saved.positionInSeconds;
							}
						}
						if (this.disposed) {
							await this.pauseGently(widget);
							return;
						}
						this.loadedTrack = request.track;
					} catch {
						this.loadedTrack = undefined;
						if (
							!this.disposed &&
							this.store.getRequestSnapshot()?.id === request.id
						) {
							this.store.reportError(
								request.track,
								"Mixcloud show could not load.",
							);
						}
						continue;
					}
				}
				if (this.store.getRequestSnapshot()?.id !== request.id) {
					continue;
				}
				try {
					switch (request.action) {
						case "load":
						case "play":
							await widget.play();
							break;
						case "pause":
							await widget.pause();
							break;
					}
				} catch {
					this.save(this.playback.flush());
					if (
						!this.disposed &&
						this.store.getRequestSnapshot()?.id === request.id
					) {
						this.store.reportError(
							request.track,
							"Mixcloud playback command failed. Try the widget controls.",
						);
					}
				}
				if (this.disposed) {
					await this.pauseGently(widget);
				}
				// Re-read intent after each asynchronous command; intermediate selections are skipped.
			}
		} finally {
			this.running = false;
		}
	}

	/** Stop without assigning failures from an old/cleared widget to a new selection. */
	private async pauseGently(widget = this.widget) {
		if (!widget) {
			return;
		}
		try {
			await widget.pause();
		} catch {
			// Teardown remains safe even if the external API throws synchronously.
		}
	}
}
