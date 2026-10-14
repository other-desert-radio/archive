// Preserve page position/styles while locked; cleanup restores both.
export function lockBackgroundScroll(): () => void {
	const { scrollX, scrollY } = window;
	const body = document.body;
	const root = document.documentElement;
	const scrollbarWidth = window.innerWidth - root.clientWidth;
	const bodyPadding = Number.parseFloat(getComputedStyle(body).paddingRight);
	const bodyProperties = [
		"position",
		"top",
		"left",
		"width",
		"overflow",
		"padding-right",
	];
	const savedBodyStyles = bodyProperties.map((property) => ({
		property,
		value: body.style.getPropertyValue(property),
		priority: body.style.getPropertyPriority(property),
	}));
	const rootOverflow = root.style.getPropertyValue("overflow");
	const rootOverflowPriority = root.style.getPropertyPriority("overflow");

	// Fixing the body also locks touch scrolling in iOS Safari. Keep the
	// iframe attached and offset the page to preserve its current position.
	body.style.position = "fixed";
	body.style.top = `${-scrollY}px`;
	body.style.left = `${-scrollX}px`;
	body.style.width = "100%";
	body.style.overflow = "hidden";
	body.style.paddingRight = `${bodyPadding + scrollbarWidth}px`;
	root.style.overflow = "hidden";

	return () => {
		for (const { property, value, priority } of savedBodyStyles) {
			body.style.setProperty(property, value, priority);
		}
		root.style.setProperty("overflow", rootOverflow, rootOverflowPriority);
		window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
	};
}
