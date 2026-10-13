import type { AudioStore, AudioTrack } from "../../stores/audio/audio-store";
import type { MixcloudWidget } from "./mixcloud-api";

/**
 * Loads the shared store's selected Mixcloud show into one existing widget.
 *
 * Intended owner: MixcloudWidget creates one adapter for its iframe, using
 * audioStore from useStores(), and disposes it during effect cleanup. This
 * ownership is not wired yet. The adapter never creates or moves the iframe.
 *
 * Loads are serialized and use the latest request after readiness and each
 * completion. Track identity avoids reloading for play/pause requests while
 * allowing an explicit reselection of the same show to load again.
 *
 * Currently loading only: load(key, false) does not request playback, and a
 * successful load does not confirm playing or paused state. Playback commands,
 * widget events, and stopping on clear/source changes remain future work.
 */
export class MixcloudAdapter {
	private widget: MixcloudWidget | undefined;
	private loadedTrack: AudioTrack | undefined;
	private processedRequestId: number | undefined;
	private running = false;
	private disposed = false;
	private unsubscribe: () => void;

	/**
	 * Subscribes immediately, then reads the latest selection once the widget is ready.
	 * @param store Shared playback store; confirmations and errors use its selected track.
	 * @param widgetReady Validated widget readiness promise from the iframe owner.
	 * Readiness failure reports an error for the current Mixcloud selection.
	 */
	constructor(
		private store: AudioStore,
		widgetReady: PromiseLike<MixcloudWidget>,
	) {
		this.unsubscribe = store.subscribeRequests(() => {
			void this.loadLatestSelection();
		});
		Promise.resolve(widgetReady).then(
			(widget) => {
				if (this.disposed) {
					return;
				}
				this.widget = widget;
				// Includes requests made before mounting or during widget initialization.
				void this.loadLatestSelection();
			},
			() => {
				if (this.disposed) {
					return;
				}
				const request = this.store.getRequestSnapshot();
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
	 * In-flight widget promises cannot be canceled; this does not stop playback
	 * or remove the iframe. A disposed adapter cannot be reused.
	 */
	dispose() {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.unsubscribe();
		this.widget = undefined;
		this.loadedTrack = undefined;
	}

	/**
	 * Drains new requests through one load at a time, skipping intermediate selections.
	 * Only errors for the latest request reach the store; a newer request can retry.
	 */
	private async loadLatestSelection() {
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
					this.loadedTrack = undefined;
					continue;
				}
				if (request.track === this.loadedTrack) continue;
				try {
					// Do not autoplay a selection that could be superseded while loading.
					await widget.load(request.track.source.cloudcastKey, false);
					if (this.disposed) {
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
				}
				// Re-read intent after each asynchronous load; intermediate selections are skipped.
			}
		} finally {
			this.running = false;
		}
	}
}
