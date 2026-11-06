import { useCallback, useEffect, useRef, useState } from "react";

export type InitializationStatus = "loading" | "ready" | "error";

/** Initializes a stable store, supports retry, and ignores completion after it is replaced or unmounted. */
export function useInitialization(
	store: { initialize(): Promise<void> },
	initialStatus: InitializationStatus = "loading",
) {
	const [status, setStatus] = useState<InitializationStatus>(initialStatus);
	const attempt = useRef(0);
	const retry = useCallback(() => {
		const currentAttempt = ++attempt.current;
		setStatus("loading");
		void store.initialize().then(
			() => {
				if (currentAttempt === attempt.current) {
					setStatus("ready");
				}
			},
			() => {
				if (currentAttempt === attempt.current) {
					setStatus("error");
				}
			},
		);
	}, [store]);
	useEffect(() => {
		retry();
		return () => {
			attempt.current++;
		};
	}, [retry]);
	return { status, retry };
}
