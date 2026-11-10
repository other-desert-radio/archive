import { swapFunctions } from "astro:transitions/client";

/**
 * Keeps the Mixcloud iframe attached during internal archive navigation.
 * iOS Safari versions without Element.moveBefore() cannot use Astro's
 * state-preserving moves for transition:persist. Astro's fallback DOM moves
 * reload the iframe, interrupting playback. Keep the body and player header
 * in place and swap the navigation and surrounding page content instead.
 * Idle players and browsers supporting moveBefore() use Astro's default swap.
 */
document.addEventListener("astro:before-swap", (event) => {
	if (typeof document.documentElement.moveBefore === "function") {
		return;
	}

	const header = document.querySelector<HTMLElement>("[data-site-header]");
	// Only pay for the compatibility swap when there is a widget to preserve.
	// Keep paused/loading widgets too: moving them would reset their document.
	if (!header?.querySelector("[data-miniplayer-bar] iframe")) {
		return;
	}

	const nextHeader =
		event.newDocument.querySelector<HTMLElement>("[data-site-header]");
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
		// Carry the incoming tab compression seed onto the retained header before restoring scroll.
		header.style.setProperty(
			"--tabs-progress",
			nextHeader.style.getPropertyValue("--tabs-progress"),
		);
		nav.replaceWith(nextNav);
		header.querySelector("[data-category-tabs]")?.remove();
		const nextTabs = nextHeader.querySelector("[data-category-tabs]");
		if (nextTabs) {
			header.append(nextTabs);
		}
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
