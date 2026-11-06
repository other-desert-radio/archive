import { useEffect, useState } from "react";

export type InitializationStatus = "loading" | "ready" | "error";

/** Initializes a stable store and ignores completion after it is replaced or unmounted. */
export function useInitialization(store: { initialize(): Promise<void> }) {
	const [status, setStatus] = useState<InitializationStatus>("loading");
	useEffect(() => {
		let active = true;
		setStatus("loading");
		void store.initialize().then(
			() => {
				if (active) {
					setStatus("ready");
				}
			},
			() => {
				if (active) {
					setStatus("error");
				}
			},
		);
		return () => {
			active = false;
		};
	}, [store]);
	return status;
}
