const observer = new ResizeObserver((entries) => {
	for (const { target } of entries) {
		const label = target.querySelector<HTMLElement>("[data-tag-label]");
		if (label) {
			label.style.setProperty(
				"--tag-label-scale",
				String(Math.min(1, target.clientWidth / label.offsetWidth)),
			);
			label.style.visibility = "visible";
		}
	}
});

function observeTags() {
	observer.disconnect();
	document.querySelectorAll("[data-tag-segment]").forEach((segment) => {
		observer.observe(segment);
	});
}

observeTags();
document.addEventListener("astro:page-load", observeTags);
document.addEventListener("astro:before-swap", () => observer.disconnect());
