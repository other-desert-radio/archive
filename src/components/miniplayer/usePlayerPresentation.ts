import { type RefObject, useEffect, useRef, useState } from "react";
import { lockBackgroundScroll } from "./scroll-lock";

export type PlayerPresentation = "compact" | "fullscreen";

type PlayerPresentationState = {
	presentation: PlayerPresentation;
	compactHeight: number | undefined;
	playerRef: RefObject<HTMLDivElement | null>;
	expand: () => void;
	close: () => void;
};

// Owns presentation, compact-height measurement, and scroll-lock lifecycle.
export function usePlayerPresentation(): PlayerPresentationState {
	const [presentation, setPresentation] =
		useState<PlayerPresentation>("compact");
	const [compactHeight, setCompactHeight] = useState<number>();
	const playerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (presentation !== "fullscreen") {
			return;
		}

		return lockBackgroundScroll();
	}, [presentation]);

	function expand() {
		setCompactHeight(playerRef.current?.getBoundingClientRect().height);
		setPresentation("fullscreen");
	}

	function close() {
		setPresentation("compact");
	}

	return { presentation, compactHeight, playerRef, expand, close };
}
