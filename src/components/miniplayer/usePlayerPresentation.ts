import { type RefObject, useEffect, useRef, useState } from "react";
import { activateFullscreenFocus } from "./fullscreen-focus";
import { lockBackgroundScroll } from "./scroll-lock";

export type PlayerPresentation = "compact" | "fullscreen";

type PlayerPresentationState = {
	presentation: PlayerPresentation;
	compactHeight: number | undefined;
	playerRef: RefObject<HTMLDivElement | null>;
	expand: (trigger: HTMLButtonElement) => void;
	close: () => void;
};

// Owns presentation, compact-height measurement, and scroll-lock lifecycle.
export function usePlayerPresentation(): PlayerPresentationState {
	const [presentation, setPresentation] =
		useState<PlayerPresentation>("compact");
	const [compactHeight, setCompactHeight] = useState<number>();
	const playerRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement | undefined>(undefined);

	useEffect(() => {
		if (presentation !== "fullscreen") {
			return;
		}

		const player = playerRef.current;
		if (!player) {
			return;
		}
		const unlockScroll = lockBackgroundScroll();
		const releaseFocus = activateFullscreenFocus(player, () =>
			setPresentation("compact"),
		);
		return () => {
			releaseFocus();
			unlockScroll();
			if (triggerRef.current?.isConnected) {
				triggerRef.current.focus({ preventScroll: true });
			}
		};
	}, [presentation]);

	function expand(trigger: HTMLButtonElement) {
		triggerRef.current = trigger;
		setCompactHeight(playerRef.current?.getBoundingClientRect().height);
		setPresentation("fullscreen");
	}

	function close() {
		setPresentation("compact");
	}

	return { presentation, compactHeight, playerRef, expand, close };
}
