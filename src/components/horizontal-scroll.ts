const SCROLL_PIXELS_PER_SECOND = 60;
const SCROLL_EASE_SECONDS = 0.16;
const NATIVE_SCROLL_IDLE_MS = 200;

export function setupHorizontalScroll(row: HTMLElement) {
	const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
	const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
	const controller = new AbortController();
	const options = { signal: controller.signal, passive: true };
	let dragging = false;
	let touching = false;
	let nativeScrollUntil = 0;
	let direction = 1;
	let velocity = 0;
	let previousTime: number | undefined;
	let position = row.scrollLeft;
	let lastScrollLeft = row.scrollLeft;
	let frame = 0;
	row.addEventListener(
		"touchstart",
		() => {
			touching = true;
		},
		options,
	);
	for (const event of ["touchend", "touchcancel"]) {
		window.addEventListener(
			event,
			() => {
				if (!touching) {
					return;
				}
				touching = false;
				nativeScrollUntil = (previousTime ?? 0) + NATIVE_SCROLL_IDLE_MS;
			},
			options,
		);
	}

	row.addEventListener(
		"pointerdown",
		() => {
			dragging = true;
		},
		options,
	);
	window.addEventListener(
		"pointerup",
		() => {
			dragging = false;
		},
		options,
	);
	window.addEventListener(
		"pointercancel",
		() => {
			dragging = false;
		},
		options,
	);

	function tick(time: number) {
		const elapsed =
			previousTime === undefined ? 0 : Math.min(time - previousTime, 50);
		previousTime = time;
		// Native panning and momentum can continue after pointercancel.
		if (row.scrollLeft !== lastScrollLeft) {
			nativeScrollUntil = time + NATIVE_SCROLL_IDLE_MS;
		}
		const end = row.scrollWidth - row.clientWidth;
		if (
			dragging ||
			touching ||
			time < nativeScrollUntil ||
			reducedMotion.matches ||
			document.hidden ||
			row.matches(":focus-within") ||
			end <= 0
		) {
			position = row.scrollLeft;
			velocity = 0;
		} else {
			const hovered = finePointer.matches && row.matches(":hover");
			if (hovered) {
				position = row.scrollLeft;
			}
			const distance = direction > 0 ? end - position : position;
			const target = hovered
				? 0
				: direction *
					Math.min(SCROLL_PIXELS_PER_SECOND, distance / SCROLL_EASE_SECONDS);
			velocity +=
				(target - velocity) *
				(1 - Math.exp(-elapsed / (SCROLL_EASE_SECONDS * 1000)));
			if (hovered && Math.abs(velocity) < 0.5) {
				velocity = 0;
			}

			position = Math.max(
				0,
				Math.min(end, position + (velocity * elapsed) / 1000),
			);
			row.scrollLeft = position;
			if (!hovered && (direction > 0 ? end - position : position) < 0.5) {
				position = direction > 0 ? end : 0;
				row.scrollLeft = position;
				direction *= -1;
				velocity = 0;
			}
		}
		lastScrollLeft = row.scrollLeft;
		frame = requestAnimationFrame(tick);
	}
	frame = requestAnimationFrame(tick);
	return () => {
		cancelAnimationFrame(frame);
		controller.abort();
	};
}

export function setupStickyRow(row: HTMLElement) {
	const anchor = row.previousElementSibling;
	const header = document.querySelector<HTMLElement>("[data-site-header]");
	let observer: IntersectionObserver | undefined;
	function update() {
		const top = header?.getBoundingClientRect().height ?? 0;
		row.style.setProperty("--scroll-sticky-top", `${top}px`);
		observer?.disconnect();
		observer = new IntersectionObserver(
			([entry]) => {
				if (entry) {
					row.classList.toggle("is-stuck", entry.boundingClientRect.top < top);
				}
			},
			{ rootMargin: `-${top}px 0px 0px 0px`, threshold: [0, 1] },
		);
		if (anchor) {
			observer.observe(anchor);
		}
	}
	const resize = new ResizeObserver(update);
	if (header) {
		resize.observe(header);
	}
	update();
	return () => {
		observer?.disconnect();
		resize.disconnect();
	};
}
