import type { RefObject } from "react";

export type PlayerPresentation = "compact" | "fullscreen";

type PlayerPresentationState = {
	presentation: PlayerPresentation;
	compactHeight: number | undefined;
	playerRef: RefObject<HTMLDivElement | null>;
	expand: () => void;
	close: () => void;
};

// Owns presentation, compact-height measurement, and scroll-lock lifecycle.
// The working player will adopt this hook after the contracts are reviewed.
export function usePlayerPresentation(): PlayerPresentationState {
	throw new Error("Not implemented");
}
