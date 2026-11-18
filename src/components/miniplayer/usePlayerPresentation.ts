import {
	type RefObject,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { flushSync } from "react-dom";
import { lockBackgroundScroll } from "./scroll-lock";

export type PlayerPresentation = "compact" | "fullscreen";

type PlayerPresentationState = {
	presentation: PlayerPresentation;
	compactHeight: number | undefined;
	playerRef: RefObject<HTMLDivElement | null>;
	expand: () => void;
	close: () => void;
	closeImmediately: () => void;
};

// Owns presentation, compact-height measurement, and scroll-lock lifecycle.
export function usePlayerPresentation(): PlayerPresentationState {
	const [presentation, setPresentation] =
		useState<PlayerPresentation>("compact");
	const [compactHeight, setCompactHeight] = useState<number>();
	const playerRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		if (presentation !== "fullscreen") {
			return;
		}

		return lockBackgroundScroll();
	}, [presentation]);

	const transition = useRef<Animation | undefined>(undefined);
	useEffect(() => () => transition.current?.cancel(), []);
	useLayoutEffect(() => {
		const player = playerRef.current;
		if (presentation !== "fullscreen" || !player || player.style.transform) {
			return;
		}
		transition.current = player.animate(
			[
				{
					transform: `translateY(${window.innerHeight - (compactHeight ?? 0)}px)`,
					"--player-open": "0",
				},
				{ transform: "translateY(0)", "--player-open": "1" },
			],
			{
				duration: matchMedia("(prefers-reduced-motion: reduce)").matches
					? 0
					: 480,
				easing: "cubic-bezier(.2,.8,.2,1)",
			},
		);
		transition.current.onfinish = () => player.removeAttribute("data-opening");
	}, [presentation, compactHeight]);

	function expand() {
		if (presentation === "fullscreen") {
			return;
		}
		playerRef.current?.setAttribute("data-opening", "");
		setCompactHeight(playerRef.current?.getBoundingClientRect().height);
		setPresentation("fullscreen");
	}

	function closeImmediately() {
		// Commit compact layout before removing the animation that holds fullscreen offscreen.
		flushSync(() => setPresentation("compact"));
		transition.current?.cancel();
		playerRef.current?.removeAttribute("data-opening");
		playerRef.current?.removeAttribute("data-closing");
	}

	function close() {
		const player = playerRef.current;
		if (!player) {
			closeImmediately();
			return;
		}
		player.setAttribute("data-closing", "");
		const offset = new DOMMatrixReadOnly(getComputedStyle(player).transform)
			.m42;
		transition.current?.cancel();
		transition.current = player.animate(
			[
				{
					transform: getComputedStyle(player).transform,
					"--player-offset": `${offset}px`,
					"--player-open":
						getComputedStyle(player).getPropertyValue("--player-open"),
				},
				{
					transform: `translateY(${window.innerHeight - (compactHeight ?? 0)}px)`,
					"--player-open": "0",
					"--player-offset": `${window.innerHeight - (compactHeight ?? 0)}px`,
				},
			],
			{
				duration: matchMedia("(prefers-reduced-motion: reduce)").matches
					? 0
					: 480,
				easing: "cubic-bezier(.2,.8,.2,1)",
				fill: "forwards",
			},
		);
		transition.current.onfinish = closeImmediately;
	}

	return {
		presentation,
		compactHeight,
		playerRef,
		expand,
		close,
		closeImmediately,
	};
}
