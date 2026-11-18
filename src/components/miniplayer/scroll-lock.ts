// Preserve page position/styles while locked; cleanup restores both.
export function lockBackgroundScroll(): () => void {
	const { scrollX, scrollY } = window;
	const body = document.body;
	const root = document.documentElement;
	const scrollbarWidth = window.innerWidth - root.clientWidth;
	const bodyPadding = Number.parseFloat(getComputedStyle(body).paddingRight);
	const bodyProperties = ["padding-right"];
	const savedBodyStyles = bodyProperties.map((property) => ({
		property,
		value: body.style.getPropertyValue(property),
		priority: body.style.getPropertyPriority(property),
	}));
	const rootOverflow = root.style.getPropertyValue("overflow");
	const rootOverflowPriority = root.style.getPropertyPriority("overflow");

	// Keep sticky navigation and scroll-driven tabs in their original scroll context.
	body.style.paddingRight = `${bodyPadding + scrollbarWidth}px`;
	root.style.overflow = "hidden";

	function blockBackgroundTouch(event: TouchEvent) {
		if (event.touches.length !== 1) {
			return;
		}
		const target = event.target;
		if (
			!(target instanceof Element) ||
			!target.closest("[data-miniplayer-scroll], dialog[open]")
		) {
			event.preventDefault();
		}
	}
	document.addEventListener("touchmove", blockBackgroundTouch, {
		passive: false,
	});

	return () => {
		document.removeEventListener("touchmove", blockBackgroundTouch);
		for (const { property, value, priority } of savedBodyStyles) {
			body.style.setProperty(property, value, priority);
		}
		root.style.setProperty("overflow", rootOverflow, rootOverflowPriority);
		window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
	};
}
