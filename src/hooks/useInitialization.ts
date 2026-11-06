import { useCallback, useEffect, useState } from "react";

export type InitializationStatus = "loading" | "ready" | "error";

/** Initializes a stable store, supports retry, and ignores completion after it is replaced or unmounted. */
export function useInitialization(
	store: { initialize(): Promise<void> },
	initialStatus: InitializationStatus = "loading",
) {
	const [status, setStatus] = useState<InitializationStatus>(initialStatus);
	const [attempt, setAttempt] = useState(0);
	const retry = useCallback(() => {
		setStatus("loading");
		setAttempt((current) => current + 1);
	}, []);
	// biome-ignore lint/correctness/useExhaustiveDependencies: Each retry must rerun initialization, even for the same store.
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
	}, [store, attempt]);
	return { status, retry };
}
