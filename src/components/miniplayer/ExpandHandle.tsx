import { type RefObject, useEffect, useRef, useState } from "react";
import styles from "./Miniplayer.module.css";

type Props = {
	playerRef: RefObject<HTMLDivElement | null>;
	fullscreen: boolean;
	/** Measured compact player height in pixels; collapse travel defaults to 60. */
	compactHeight: number | undefined;
	expand: () => void;
	/** Leave fullscreen immediately; the handle finishes its own closing animation. */
	close: () => void;
};

/** Controls player expansion with pointer gestures and keyboard button activation. */
export default function ExpandHandle({
	playerRef,
	fullscreen,
	compactHeight,
	expand,
	close,
}: Props) {
	const handleRef = useRef<HTMLButtonElement>(null);
	const drag = useRef<
		| {
				start: number;
				last: number;
				time: number;
				velocity: number;
				distance: number;
				travel: number;
				closing: boolean;
		  }
		| undefined
	>(undefined);
	const animation = useRef<Animation | undefined>(undefined);
	const [dragging, setDragging] = useState<"up" | "down">();

	useEffect(() => {
		const player = playerRef.current;
		if (!player) {
			return;
		}
		function follow(event: PointerEvent) {
			if (event.pointerType !== "mouse" || !player) {
				return;
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
		player.addEventListener("pointerenter", follow);
		player.addEventListener("pointermove", follow);
		return () => {
			player.removeEventListener("pointerenter", follow);
			player.removeEventListener("pointermove", follow);
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
			if (
				window.matchMedia("(max-width: 600px)").matches &&
				!target.closest("[data-player-drag-handle]")
			) {
				return;
			}
			if (
				!handle.contains(target) &&
				!target.closest("[data-player-drag-handle]")
			) {
				if (
					fullscreen ||
					target.closest(
						"a, button, iframe, input, select, textarea, [contenteditable]",
					)
				) {
					return;
				}
				if (
					Array.from(target.childNodes).some(
						(node) =>
							node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
					)
				) {
					return;
				}
			}
			const player = playerRef.current;
			if (event.button !== 0 || !player || dragging || animation.current) {
				return;
			}
			const travel = Math.max(
				1,
				window.innerHeight -
					(fullscreen
						? (compactHeight ?? 60)
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
			const velocity =
				performance.now() - gesture.time < 100 ? gesture.velocity : 0;
			// Taps commit; drags project recent velocity to allow a short flick to commit.
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
			animation.current.onfinish = () => {
				if (!open) {
					close();
				}
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
