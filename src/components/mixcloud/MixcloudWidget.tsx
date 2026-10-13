import { useEffect, useRef, useState } from "react";
import { useStores } from "../../stores";
import styles from "./MixcloudWidget.module.css";
import { MixcloudAdapter } from "./mixcloud-adapter";
import {
	loadMixcloudApi,
	type MixcloudWidget as Widget,
	waitForMixcloudWidget,
} from "./mixcloud-api";
import { type MixcloudEmbedParams, mixcloudEmbedUrl } from "./mixcloud-embed";

type Props = {
	initialCloudcastKey: string;
	iframeParams: MixcloudEmbedParams;
};

type Readiness =
	| { status: "loading" | "ready" }
	| { status: "error"; message: string };

export default function MixcloudWidget({
	initialCloudcastKey,
	iframeParams,
}: Props) {
	const { audioStore } = useStores();
	// Later selections must use widget.load(), preserving the original iframe src.
	const [src] = useState(() =>
		mixcloudEmbedUrl(initialCloudcastKey, iframeParams),
	);
	const [readiness, setReadiness] = useState<Readiness>({ status: "loading" });
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const widgetPromise = useRef<Promise<Widget> | undefined>(undefined);

	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe) {
			return;
		}

		let disposed = false;
		// Reuse initialization if React replays the effect in development.
		widgetPromise.current ??= loadMixcloudApi().then((api) => {
			if (!iframe.isConnected) {
				throw new Error("Mixcloud iframe was removed before initialization.");
			}
			return waitForMixcloudWidget(api.PlayerWidget(iframe));
		});
		const adapter = new MixcloudAdapter(audioStore, widgetPromise.current);
		widgetPromise.current.then(
			() => {
				if (!disposed) {
					setReadiness({ status: "ready" });
				}
			},
			() => {
				if (!disposed) {
					setReadiness({
						status: "error",
						message:
							"Mixcloud controls could not connect. Try reloading the page.",
					});
				}
			},
		);
		return () => {
			disposed = true;
			adapter.dispose();
		};
	}, [audioStore]);

	return (
		<div data-mixcloud-widget={readiness.status}>
			<iframe
				ref={iframeRef}
				className={styles["widget"]}
				src={src}
				title="Mixcloud show player"
				aria-label="Mixcloud show player"
				allow="autoplay"
			/>
			{readiness.status === "error" && <p role="status">{readiness.message}</p>}
		</div>
	);
}
