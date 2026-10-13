import { match, P } from "ts-pattern";
import type {
	AudioStore,
	AudioTrack,
	PlaybackRequest,
} from "../../stores/audio/audio-store";
import type { MixcloudWidget } from "./mixcloud-api";

/**
 * Applies the shared store's playback requests to one existing Mixcloud widget.
 *
 * Intended owner: MixcloudWidget creates one adapter for its iframe, using
 * audioStore from useStores(), and disposes it during effect cleanup. This
 * ownership is not wired yet. The adapter never creates or moves the iframe.
 *
 * Loads are serialized and use the latest request after readiness and each
 * completion. Track identity avoids reloading for play/pause requests while
 * allowing an explicit reselection of the same show to load again.
 *
 * Loads with autoplay disabled, then applies the latest play/pause intent.
 * Clear, source changes, and disposal pause the widget. Command completion
 * does not confirm playing or paused state; widget events remain future work.
 */
export class MixcloudAdapter {
	private widget: MixcloudWidget | undefined;
	private loadedTrack: AudioTrack | undefined;
	private latestRequest: PlaybackRequest | undefined;
	private processedRequestId: number | undefined;
	private running = false;
	private disposed = false;
	private unsubscribe: () => void;

	/**
	 * Seeds the latest selection, then caches requests until the widget is ready.
	 * @param store Shared playback store; confirmations and errors use its selected track.
	 * @param widgetReady Validated widget readiness promise from the iframe owner.
	 * Readiness failure reports an error for the current Mixcloud selection.
	 */
	constructor(
		private store: AudioStore,
		widgetReady: PromiseLike<MixcloudWidget>,
	) {
		this.latestRequest = store.getRequestSnapshot();
		this.unsubscribe = store.subscribeRequests((request) => {
			this.latestRequest = request;
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
		void this.pauseGently();
		this.widget = undefined;
		this.loadedTrack = undefined;
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
						// Do not autoplay a selection that could be superseded while loading.
						await widget.load(request.track.source.cloudcastKey, false);
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
