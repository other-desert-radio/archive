import { type RefObject, useEffect, useRef, useState } from "react";
import styles from "./Miniplayer.module.css";

type Props = {
	playerRef: RefObject<HTMLDivElement | null>;
	fullscreen: boolean;
	/** Measured compact player height in pixels; collapse travel defaults to 64. */
	compactHeight: number | undefined;
	expand: () => void;
	/** Leave fullscreen without another animation; called after the gesture settles. */
	close: () => void;
};

/** Controls player expansion with pointer gestures and keyboard button activation. */
function canGrabPlayer(
	target: Element,
	handle: HTMLButtonElement,
	fullscreen: boolean,
): boolean {
	const mobileHandle = target.closest("[data-player-drag-handle]");
	if (window.matchMedia("(max-width: 600px)").matches && !mobileHandle) {
		return false;
	}
	if (handle.contains(target) || mobileHandle) {
		return true;
	}
	return (
		!fullscreen &&
		!target.closest(
			"a, button, iframe, input, select, textarea, [contenteditable]",
		) &&
		!Array.from(target.childNodes).some(
			(node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
		)
	);
}

export default function ExpandHandle({
	playerRef,
	fullscreen,
	compactHeight,
	expand,
	close,
}: Props) {
	const handleRef = useRef<HTMLButtonElement>(null);
	// Keep pointer samples outside React state so movement does not trigger renders.
	const drag = useRef<
		| {
				start: number;
				last: number;
				time: number;
				velocity: number;
				distance: number;
				travel: number;
				// Snapshot the starting mode: expand() changes fullscreen during the gesture.
				closing: boolean;
		  }
		| undefined
	>(undefined);
	const animation = useRef<Animation | undefined>(undefined);
	const [dragging, setDragging] = useState<"up" | "down">();

	// Make the desktop mound follow the cursor and flatten farther from the top edge.
	useEffect(() => {
		const player = playerRef.current;
		if (!player) {
			return;
		}
		function follow(event: PointerEvent) {
			if (event.pointerType !== "mouse" || !player) {
				return;
			}
			const target = event.target;
			const handle = handleRef.current;
			if (target instanceof Element && handle) {
				player.style.cursor =
					drag.current || animation.current
						? "grabbing"
						: canGrabPlayer(
									target,
									handle,
									player.dataset["presentation"] === "fullscreen",
								)
							? "grab"
							: "";
			}
			const bounds = player.getBoundingClientRect();
			const distance = Math.max(
				0,
				Math.min(1, (event.clientY - bounds.top) / Math.max(1, bounds.height)),
			);
			handleRef.current?.style.setProperty(
				"--mound-scale",
				String(1 - distance * 0.7),
			);
			handleRef.current?.style.setProperty(
				"--mound-x",
				`${event.clientX - bounds.left}px`,
			);
		}
		function leave() {
			if (player?.dataset["presentation"] === "compact") {
				player.removeAttribute("data-mound-dismissed");
			}
		}
		player.addEventListener("pointerenter", follow);
		player.addEventListener("pointermove", follow);
		player.addEventListener("pointerleave", leave);
		return () => {
			player.removeEventListener("pointerenter", follow);
			player.removeEventListener("pointermove", follow);
			player.removeEventListener("pointerleave", leave);
		};
	}, [playerRef]);

	useEffect(() => {
		const player = playerRef.current;
		if (!player) {
			return;
		}
		function start(event: PointerEvent) {
			const target = event.target;
			const handle = handleRef.current;
			if (!(target instanceof Element) || !handle) {
				return;
			}
			if (!canGrabPlayer(target, handle, fullscreen)) {
				return;
			}
			const player = playerRef.current;
			if (event.button !== 0 || !player || dragging || animation.current) {
				return;
			}
			// Translation spans the viewport minus the compact player's visible height.
			const travel = Math.max(
				1,
				window.innerHeight -
					(fullscreen
						? (compactHeight ?? 64)
						: player.getBoundingClientRect().height),
			);
			drag.current = {
				start: event.clientY,
				last: event.clientY,
				time: performance.now(),
				velocity: 0,
				distance: 0,
				travel,
				closing: fullscreen,
			};
			(
				target.closest<HTMLElement>("[data-player-drag-handle]") ?? handle
			).setPointerCapture(event.pointerId);
			if (!fullscreen) {
				player.setAttribute("data-opening", "");
			}
			player.style.cursor = "grabbing";
			player.style.transform = `translateY(${fullscreen ? 0 : travel}px)`;
			if (fullscreen) {
				player.setAttribute("data-closing", "");
			}
			player.style.setProperty(
				"--player-offset",
				`${fullscreen ? 0 : travel}px`,
			);
			player.style.setProperty("--player-open", fullscreen ? "1" : "0");
			setDragging(fullscreen ? "down" : "up");
			if (!fullscreen) {
				// Mount fullscreen content before dragging it into view.
				expand();
			}
		}
		player.addEventListener("pointerdown", start);
		return () => player.removeEventListener("pointerdown", start);
	}, [playerRef, fullscreen, compactHeight, dragging, expand]);

	useEffect(() => () => animation.current?.cancel(), []);

	useEffect(() => {
		const player = playerRef.current;
		if (!player) {
			return;
		}

		function finish(cancelled: boolean) {
			const gesture = drag.current;
			const player = playerRef.current;
			if (!gesture || !player) {
				return;
			}
			drag.current = undefined;
			// Ignore an old movement sample when the user pauses before releasing.
			const velocity =
				performance.now() - gesture.time < 100 ? gesture.velocity : 0;
			// Taps commit; a 240 ms velocity projection must pass 35% travel for drags.
			const commit =
				!cancelled &&
				(gesture.distance < 5 ||
					gesture.distance + velocity * 240 > gesture.travel * 0.35);
			const open = gesture.closing ? !commit : commit;
			const offset = gesture.closing
				? gesture.distance
				: gesture.travel - gesture.distance;
			if (!open) {
				player.setAttribute("data-closing", "");
			}
			animation.current = player.animate(
				[
					{
						transform: `translateY(${offset}px)`,
						"--player-offset": `${offset}px`,
						"--player-open": String(1 - offset / gesture.travel),
					},
					{
						transform: `translateY(${open ? 0 : gesture.travel}px)`,
						"--player-offset": `${open ? 0 : gesture.travel}px`,
						"--player-open": open ? "1" : "0",
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
			// Keep fullscreen content mounted until settling, then return styling to CSS.
			animation.current.onfinish = () => {
				if (!open) {
					close();
				}
				player.style.removeProperty("cursor");
				player.style.removeProperty("transform");
				player.style.removeProperty("--player-open");
				player.style.removeProperty("--player-offset");
				player.removeAttribute("data-closing");
				animation.current?.cancel();
				animation.current = undefined;
				player.removeAttribute("data-opening");
				setDragging(undefined);
			};
		}

		function move(event: PointerEvent) {
			const gesture = drag.current;
			const player = playerRef.current;
			if (!gesture || !player) {
				return;
			}
			const now = performance.now();
			// Normalize direction so positive pixels/ms always means the intended action.
			gesture.velocity =
				(gesture.closing
					? event.clientY - gesture.last
					: gesture.last - event.clientY) / Math.max(1, now - gesture.time);
			gesture.last = event.clientY;
			gesture.time = now;
			gesture.distance = Math.max(
				0,
				Math.min(
					gesture.travel,
					gesture.closing
						? event.clientY - gesture.start
						: gesture.start - event.clientY,
				),
			);
			// CSS uses offset for pinned controls and openness (0–1) for content crossfades.
			player.style.transform = `translateY(${gesture.closing ? gesture.distance : gesture.travel - gesture.distance}px)`;
			player.style.setProperty(
				"--player-offset",
				`${gesture.closing ? gesture.distance : gesture.travel - gesture.distance}px`,
			);
			player.style.setProperty(
				"--player-open",
				String(
					gesture.closing
						? 1 - gesture.distance / gesture.travel
						: gesture.distance / gesture.travel,
				),
			);
		}
		function release() {
			finish(false);
		}
		function cancel() {
			finish(true);
		}
		player.addEventListener("pointermove", move);
		player.addEventListener("pointerup", release);
		player.addEventListener("pointercancel", cancel);
		player.addEventListener("lostpointercapture", cancel);
		return () => {
			player.removeEventListener("pointermove", move);
			player.removeEventListener("pointerup", release);
			player.removeEventListener("pointercancel", cancel);
			player.removeEventListener("lostpointercapture", cancel);
		};
	}, [playerRef, close]);

	return (
		<button
			ref={handleRef}
			type="button"
			className={styles["expand-handle"]}
			data-direction={dragging ?? (fullscreen ? "down" : "up")}
			data-dragging={dragging || undefined}
			aria-label={fullscreen && !dragging ? "Collapse player" : "Expand player"}
			onClick={(event) => {
				// Pointer activation already settles through finish(); keyboard clicks do not.
				if (event.detail === 0) {
					if (fullscreen) {
						close();
					} else {
						expand();
					}
				}
			}}
		>
			<svg viewBox="0 0 320 32" preserveAspectRatio="none" aria-hidden="true">
				<path d="M0 32 C70 32 100 2 160 2 S250 32 320 32Z" />
			</svg>
			<span aria-hidden="true">{fullscreen && !dragging ? "↓" : "↑"}</span>
		</button>
	);
}
