import { useCallback, useEffect, useRef, useState } from "react";
import { useStores } from "../../stores";
import type { Show } from "../../utils/fetch-shows";
import type { TagMap } from "../../utils/fetch-tags";
import { getBasePath } from "../../utils/get-base-path";
import ShowCard from "./ShowCard";
import styles from "./ShowsPane.module.css";

type Props = {
	shows: Show[];
	showIds: number[];
	tags: TagMap;
	base: string;
};

export default function ShowsPane({ base, shows, showIds, tags }: Props) {
	const detailBase = getBasePath(base);
	const stores = useStores();

	const [visible, setVisible] = useState(shows);
	const [visibleTags, setVisibleTags] = useState(tags);
	const [offset, setOffset] = useState(shows.length);
	const [loading, setLoading] = useState(showIds.length > shows.length);
	const [failed, setFailed] = useState(false);

	const cancelLoading = useRef<(() => void) | undefined>(undefined);
	const sentinel = useRef<HTMLDivElement>(null);
	const hasMore = offset < showIds.length;

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
					setVisibleTags(
						new Map(stores.tagStore.getAll().map((tag) => [tag.id, tag])),
					);
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
					<ShowCard
						key={show.id}
						show={show}
						base={detailBase}
						tags={visibleTags}
					/>
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
