import { swapFunctions } from "astro:transitions/client";

/**
 * Keeps the Mixcloud iframe attached during internal archive navigation.
 * iOS Safari versions without Element.moveBefore() cannot use Astro's
 * state-preserving moves for transition:persist. Astro's fallback DOM moves
 * reload the iframe, interrupting playback. Keep the body and player header
 * in place and swap the navigation and surrounding page content instead.
 */
document.addEventListener("astro:before-swap", (event) => {
	const header = document.querySelector("[data-site-header]");
	const nextHeader = event.newDocument.querySelector("[data-site-header]");
	const nav = header?.querySelector("nav");
	const nextNav = nextHeader?.querySelector("nav");
	if (!header || !nextHeader || !nav || !nextNav) {
		return;
	}

	event.swap = () => {
		const nextDocument = event.newDocument;
		swapFunctions.deselectScripts(nextDocument);
		swapFunctions.swapRootAttributes(nextDocument);
		swapFunctions.swapHeadElements(nextDocument);
		const restoreFocus = swapFunctions.saveFocus();

		// Never detach the header or its iframe: Safari reloads moved iframes.
		nav.replaceWith(nextNav);
		for (const child of Array.from(document.body.childNodes)) {
			if (child !== header) {
				child.remove();
			}
		}
		let beforeHeader = true;
		for (const child of Array.from(nextDocument.body.childNodes)) {
			if (child === nextHeader) {
				beforeHeader = false;
				continue;
			}
			document.body.insertBefore(child, beforeHeader ? header : null);
		}
		restoreFocus();
	};
});
