import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { useStores } from "../../stores";
import type { Show } from "../../utils/fetch-shows";
import type { TagMap } from "../../utils/fetch-tags";
import ShowCard from "./ShowCard";
import styles from "./ShowsPane.module.css";

type Props = {
	shows: Show[];
	showIds: number[];
	tags: TagMap;
	initialOffset?: number;
	initialLoading?: boolean;
};

/**
 * Listing snapshots keyed by Astro's history.state.index, so Back/Forward can
 * restore each visit's loaded cards, tags, pagination offset and loading state.
 * Module memory survives ClientRouter swaps even though the island unmounts.
 * A full refresh clears this map; IndexedDB caches catalog data separately.
 * Astro owns the saved scroll coordinates, which are not stored here.
 */
const visits = new Map<number, Props>();

if (typeof document !== "undefined") {
	document.addEventListener("astro:before-swap", (event) => {
		if (event.navigationType !== "traverse") {
			return;
		}
		// During history traversal, history.state already identifies the destination entry.
		const visit = visits.get(history.state?.index);
		const island = event.newDocument.querySelector(
			'astro-island[component-export="ShowsPane"]',
		);
		if (!visit || !island) {
			return;
		}

		// This root is mounted synchronously below, so Astro must not hydrate it again.
		island.removeAttribute("ssr");
		const swap = event.swap;
		event.swap = () => {
			swap();
			const root = createRoot(island);
			island.addEventListener("astro:unmount", () => root.unmount(), {
				once: true,
			});
			// Astro restores history scroll immediately after swap returns; cards must exist first.
			flushSync(() => root.render(<ShowsPane {...visit} />));
		};
	});
}

export default function ShowsPane({
	shows,
	showIds,
	tags,
	initialOffset = shows.length,
	initialLoading = showIds.length > shows.length,
}: Props) {
	const stores = useStores();

	const [visible, setVisible] = useState(shows);
	const [visibleTags, setVisibleTags] = useState(tags);
	const [offset, setOffset] = useState(initialOffset);
	const [loading, setLoading] = useState(initialLoading);
	const [failed, setFailed] = useState(false);

	const cancelLoading = useRef<(() => void) | undefined>(undefined);
	const sentinel = useRef<HTMLDivElement>(null);
	const hasMore = offset < showIds.length;
	useEffect(() => {
		// Capture this mount's entry: Back changes history.state before before-swap fires.
		const entry = history.state?.index;
		if (typeof entry !== "number") return;
		const saveVisit = () => {
			visits.set(entry, {
				showIds,
				shows: visible,
				tags: visibleTags,
				initialOffset: offset,
				initialLoading: loading,
			});
		};
		// Save the outgoing history entry before the router unmounts this listing.
		document.addEventListener("astro:before-swap", saveVisit);
		return () => document.removeEventListener("astro:before-swap", saveVisit);
	}, [showIds, visible, visibleTags, offset, loading]);

	// Initial loading and Retry share the same initialization and error handling.
	const retryLoading = useCallback(() => {
		// Ignore results from an older attempt without cancelling shared store initialization.
		cancelLoading.current?.();
		let active = true;
		cancelLoading.current = () => {
			active = false;
		};

		setLoading(true);
		setFailed(false);

		// Concurrent calls share one initialization promise; failures clear it so Retry can try again.
		void stores.initialize().then(
			() => {
				if (active) {
					setVisibleTags(stores.tagStore.getMap());
					setLoading(false);
				}
			},
			() => {
				if (active) {
					setLoading(false);
					setFailed(true);
				}
			},
		);
	}, [stores]);

	useEffect(() => {
		if (showIds.length <= shows.length) return;
		retryLoading();
		// Read the current cleanup so unmount also ignores results from a later Retry.
		return () => cancelLoading.current?.();
	}, [retryLoading, showIds.length, shows.length]);

	useEffect(() => {
		if (loading || failed || !hasMore || !sentinel.current) {
			return;
		}

		// IntersectionObserver loads more when the bottom sentinel nears the viewport.
		// It may notify us again before React renders, so append only once per batch.
		let appended = false;
		const observer = new IntersectionObserver(
			(entries) => {
				if (appended || !entries.some((entry) => entry.isIntersecting)) {
					return;
				}
				appended = true;
				const next = stores.showStore.getPage(showIds, offset, 20);
				setVisible((current) => {
					const ids = new Set(current.map((show) => show.id));
					return [...current, ...next.filter((show) => !ids.has(show.id))];
				});
				setOffset(Math.min(offset + 20, showIds.length));
			},
			{ rootMargin: "0px 0px 400px 0px" },
		);

		observer.observe(sentinel.current);
		return () => observer.disconnect();
	}, [stores, showIds, offset, loading, failed, hasMore]);

	if (showIds.length === 0) return <p>No shows found.</p>;

	return (
		<>
			<div className={styles["show-container-grid"]}>
				{visible.map((show) => (
					<ShowCard key={show.id} show={show} tags={visibleTags} />
				))}
			</div>
			{loading && (
				<p role="status" className={styles["loading"]}>
					Loading shows...
				</p>
			)}
			{failed && (
				<p role="alert" className={styles["status"]}>
					Could not load more shows.{" "}
					<button
						type="button"
						aria-label="Retry loading shows"
						onClick={retryLoading}
					>
						Retry
					</button>
				</p>
			)}
			{hasMore && (
				<div ref={sentinel} className={styles["sentinel"]} aria-hidden="true" />
			)}
		</>
	);
}
