const focusableSelector =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

// Isolate siblings along the ancestor chain, never the player or its iframe.
export function activateFullscreenFocus(
	player: HTMLElement,
	onClose: () => void,
): () => void {
	const background: { element: HTMLElement; inert: boolean }[] = [];
	let branch: HTMLElement = player;
	while (branch.parentElement) {
		for (const sibling of branch.parentElement.children) {
			if (sibling !== branch && sibling instanceof HTMLElement) {
				background.push({ element: sibling, inert: sibling.inert });
				sibling.inert = true;
			}
		}
		branch = branch.parentElement;
		if (branch === document.body) {
			break;
		}
	}

	function controls() {
		return Array.from(
			player.querySelectorAll<HTMLElement>(focusableSelector),
		).filter(
			(element) =>
				!element.hasAttribute("data-focus-guard") &&
				!element.closest("[hidden], [inert]") &&
				element.getClientRects().length > 0,
		);
	}

	function focusFirst() {
		(controls()[0] ?? player).focus({ preventScroll: true });
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			event.preventDefault();
			onClose();
		} else if (event.key === "Tab") {
			const elements = controls();
			const first = elements[0];
			const last = elements.at(-1);
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				(last ?? player).focus({ preventScroll: true });
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				focusFirst();
			}
		}
	}

	function onFocusIn(event: FocusEvent) {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			return;
		}
		if (target.dataset["focusGuard"] === "start") {
			(controls().at(-1) ?? player).focus({ preventScroll: true });
		} else if (
			!player.contains(target) ||
			target.dataset["focusGuard"] === "end"
		) {
			focusFirst();
		}
	}

	// Handle modal shortcuts before focused controls can stop propagation.
	window.addEventListener("keydown", onKeyDown, true);
	document.addEventListener("focusin", onFocusIn);
	focusFirst();

	return () => {
		window.removeEventListener("keydown", onKeyDown, true);
		document.removeEventListener("focusin", onFocusIn);
		for (const { element, inert } of background) {
			element.inert = inert;
		}
	};
}
