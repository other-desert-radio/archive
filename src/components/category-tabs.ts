type CategoryTabsConfig = {
	/** Scroll distance in CSS pixels to fully compress the tabs; must match CSS. */
	compressionScrollPx: number;
	/** Exponent of the ease-out curve; must match the CSS timeline's exponent. */
	easeOutPower: number;
	/** Fling threshold in CSS pixels per millisecond; slower drags keep easing. */
	fastScrollPxPerMs: number;
};

/**
 * Sets up tab compression and compact-entry restoration across Astro navigation.
 * Call once per document: navigation listeners persist and rebind each page's tabs.
 * Uses native CSS timelines when supported, otherwise a JavaScript scroll driver.
 */
export function setupCategoryTabsScrollBehavior({
	compressionScrollPx,
	easeOutPower,
	fastScrollPxPerMs,
}: CategoryTabsConfig): void {
	/** Starts the fallback scroll driver and returns listener/frame cleanup. */
	function observeCategoryTabs(tabs: HTMLElement): () => void {
		const header = tabs.closest<HTMLElement>("[data-site-header]");
		const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
		let frame: number | undefined;
		let lastProgress: number | undefined;
		let lastScrollY = window.scrollY;
		let lastScrollTime = performance.now();
		let snapDirection = 0;

		/** Applies eased progress, snapping fast gestures toward their endpoint. */
		function update(): void {
			frame = undefined;
			const now = performance.now();
			const scrollY = window.scrollY;
			const delta = scrollY - lastScrollY;
			// An idle gap is not part of the next gesture's velocity sample.
			const sampleMs = Math.min(32, Math.max(1, now - lastScrollTime));
			const fast =
				!reducedMotion.matches &&
				Math.abs(delta) / sampleMs >= fastScrollPxPerMs;
			const direction = Math.sign(delta);
			if (direction !== 0 && direction !== snapDirection) {
				snapDirection = 0;
			}
			if (
				scrollY <= 0 ||
				scrollY >= compressionScrollPx ||
				reducedMotion.matches
			) {
				snapDirection = 0;
			} else if (fast) {
				snapDirection = direction;
			}
			lastScrollY = scrollY;
			lastScrollTime = now;
			const fastScroll = fast || snapDirection !== 0;
			// Keep the bypass through endpoint settling so a trailing fade cannot resume.
			if (fastScroll) {
				tabs.toggleAttribute("data-fast-scroll", true);
			}
			const scrollProgress = reducedMotion.matches
				? 1
				: snapDirection > 0
					? 1
					: snapDirection < 0
						? 0
						: Math.min(1, Math.max(0, scrollY / compressionScrollPx));
			const progress = 1 - (1 - scrollProgress) ** easeOutPower;
			if (progress === lastProgress) {
				return;
			}
			lastProgress = progress;
			tabs.toggleAttribute("data-fast-scroll", fastScroll);
			tabs.style.setProperty("--tabs-progress", String(progress));
			header?.style.setProperty("--tabs-progress", String(progress));
			tabs.toggleAttribute("data-compact", scrollProgress === 1);
			tabs.toggleAttribute("data-expanded", scrollProgress === 0);
			tabs.toggleAttribute("data-dark", progress >= 0.5);
		}

		/** Batches scroll and motion-preference changes into one animation frame. */
		function scheduleUpdate(): void {
			if (frame === undefined) {
				frame = window.requestAnimationFrame(update);
			}
		}

		/** Resamples restored scroll positions without treating them as flings. */
		function restoreScroll(): void {
			if (frame !== undefined) {
				window.cancelAnimationFrame(frame);
			}
			frame = window.requestAnimationFrame(() => {
				// History restoration is a new starting position, not a fling.
				snapDirection = 0;
				lastScrollY = window.scrollY;
				lastScrollTime = performance.now();
				update();
			});
		}

		window.addEventListener("scroll", scheduleUpdate, { passive: true });
		window.addEventListener("pageshow", restoreScroll);
		reducedMotion.addEventListener("change", scheduleUpdate);
		update();
		scheduleUpdate();

		return () => {
			window.removeEventListener("scroll", scheduleUpdate);
			window.removeEventListener("pageshow", restoreScroll);
			reducedMotion.removeEventListener("change", scheduleUpdate);
			if (frame !== undefined) {
				window.cancelAnimationFrame(frame);
			}
		};
	}

	let stopObservingTabs: (() => void) | undefined;
	let categoryEntryScroll: number | undefined;

	/** Stops the outgoing page's fallback driver before its DOM is replaced. */
	function disposeCategoryTabs(): void {
		stopObservingTabs?.();
		stopObservingTabs = undefined;
	}

	/** Resets the current page and selects its native or fallback scroll driver. */
	function initializePageTabs(): void {
		disposeCategoryTabs();
		const header = document.querySelector<HTMLElement>("[data-site-header]");
		header?.removeAttribute("data-tabs-driver");
		header?.style.removeProperty("--tabs-progress");
		const tabs = document.querySelector<HTMLElement>("[data-category-tabs]");
		document.body.toggleAttribute(
			"data-compact-category-entry",
			!!tabs && !!history.state?.categoryTabsCompactEntry,
		);
		if (tabs && header) {
			tabs.style.removeProperty("--tabs-progress");
			if (
				typeof CSS.registerProperty === "function" &&
				CSS.supports(
					"(animation-timeline: scroll(root block)) and (animation-range: 0px 40px) and (width: calc(1px * pow(0.5, 3)))",
				)
			) {
				header.dataset["tabsDriver"] = "css";
				return;
			}
			header.dataset["tabsDriver"] = "js";
			stopObservingTabs = observeCategoryTabs(tabs);
		}
	}

	initializePageTabs();
	document.addEventListener("astro:page-load", initializePageTabs);
	document.addEventListener("astro:before-swap", (event) => {
		disposeCategoryTabs();
		categoryEntryScroll = undefined;
		const tabs = document.querySelector<HTMLElement>("[data-category-tabs]");
		const nextTabs = event.newDocument.querySelector<HTMLElement>(
			"[data-category-tabs]",
		);
		if (!nextTabs) {
			return;
		}
		const distance = compressionScrollPx;
		if (event.navigationType === "traverse") {
			if (
				history.state?.categoryTabsCompactEntry ||
				history.state?.scrollY >= distance
			) {
				categoryEntryScroll = history.state.scrollY;
			}
		} else if (
			tabs &&
			event.sourceElement?.closest("[data-category-tabs] a") &&
			Number.parseFloat(
				getComputedStyle(tabs).getPropertyValue("--tabs-progress"),
			) >= 1
		) {
			categoryEntryScroll = distance;
		}
		if (categoryEntryScroll !== undefined && categoryEntryScroll >= distance) {
			event.newDocument
				.querySelector<HTMLElement>("[data-site-header]")
				?.style.setProperty("--tabs-progress", "1");
			nextTabs.style.setProperty("--tabs-progress", "1");
			nextTabs.toggleAttribute("data-dark", true);
			nextTabs.toggleAttribute("data-fast-scroll", true);
		}
	});
	document.addEventListener("astro:after-swap", () => {
		document.body.toggleAttribute(
			"data-compact-category-entry",
			categoryEntryScroll !== undefined,
		);
		if (categoryEntryScroll !== undefined) {
			window.scrollTo({
				top: categoryEntryScroll,
				left: 0,
				behavior: "instant",
			});
			history.replaceState(
				{
					...history.state,
					categoryTabsCompactEntry: true,
					scrollY: window.scrollY,
				},
				"",
			);
		}
		categoryEntryScroll = undefined;
	});
}
