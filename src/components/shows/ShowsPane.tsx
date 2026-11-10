import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { useInitialization } from "../../hooks/useInitialization";
import { useStores } from "../../stores";
import type { PlaybackRecord } from "../../stores/playback/types";
import type { PlaylistSave } from "../../stores/playlists/types";
import type { Show } from "../../utils/fetch-shows";
import type { TagMap } from "../../utils/fetch-tags";
import LoadingState from "../LoadingState";
import { usePlaylists } from "../playlists/usePlaylists";
import { filterSearch } from "../search/filterSearch";
import SearchBar from "../search/SearchBar";
import ShowCard from "./ShowCard";
import styles from "./ShowsPane.module.css";
import { getPlaylistSavesByShowId } from "./utils/getPlaylistSavesByShowId";

type Props = {
	shows: Show[];
	showIds: number[];
	tags: TagMap;
	initialOffset?: number;
	initialLoading?: boolean;
	initialQuery?: string;
};

/**
 * Listing snapshots keyed by Astro's history.state.index, so Back/Forward can
 * restore each visit's loaded cards, tags, pagination offset and loading state.
 * Module memory survives ClientRouter swaps even though the island unmounts.
 * A full refresh clears this map; IndexedDB caches catalog data separately.
 * Astro owns the saved scroll coordinates, which are not stored here.
 */
const visits = new Map<number, Props>();
const emptyRecords: readonly PlaybackRecord[] = [];
const emptyPlaylistSaves: readonly PlaylistSave[] = [];

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
	initialQuery = "",
}: Props) {
	const stores = useStores();
	const [query, setQuery] = useState(initialQuery);
	const { playlists, status: playlistStatus } = usePlaylists();
	const playlistSavesByShowId = useMemo(
		() => getPlaylistSavesByShowId(playlistStatus === "ready" ? playlists : []),
		[playlists, playlistStatus],
	);
	const { playbackStore } = stores;
	const subscribe = useCallback(
		(notify: () => void) => playbackStore.subscribe(notify),
		[playbackStore],
	);
	const records = useSyncExternalStore(
		subscribe,
		playbackStore.getSnapshot,
		() => emptyRecords,
	);
	// Index the snapshot for fast lookups; playbackStore.get() bypasses it and breaks hydration.
	const recordsByShowId = useMemo(
		() => new Map(records.map((record) => [record.showId, record])),
		[records],
	);

	const [visibleTags, setVisibleTags] = useState(tags);
	const [offset, setOffset] = useState(initialOffset);
	const { status, retry: retryLoading } = useInitialization(
		stores,
		initialLoading ? "loading" : "ready",
	);

	const matchingShows = useMemo(() => {
		if (status !== "ready") {
			return query === initialQuery ? shows : [];
		}
		const allShows = stores.showStore.getPage(showIds, 0, showIds.length);

		return filterSearch(allShows, query, (show) => {
			return `${show.title} ${show.djs.map((dj) => dj.title)} ${show.date}`;
		});
	}, [stores, showIds, query, status, initialQuery, shows]);

	const searching = query.trim().length > 0;
	const visible = matchingShows.slice(0, offset);
	const needsCatalog = searching || showIds.length > shows.length;
	const loading = needsCatalog && status === "loading";
	const failed = needsCatalog && status === "error";
	const sentinel = useRef<HTMLDivElement>(null);
	const resultCount =
		status === "ready" ? matchingShows.length : showIds.length;
	const hasMore = offset < resultCount;
	function changeQuery(nextQuery: string) {
		setQuery(nextQuery);
		setOffset(20);
	}
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
				initialQuery: query,
			});
		};
		// Save the outgoing history entry before the router unmounts this listing.
		document.addEventListener("astro:before-swap", saveVisit);
		return () => document.removeEventListener("astro:before-swap", saveVisit);
	}, [showIds, visible, visibleTags, offset, loading, query]);

	useEffect(() => {
		if (needsCatalog && status === "ready") {
			setVisibleTags(stores.tagStore.getMap());
		}
	}, [stores, needsCatalog, status]);

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
				setOffset(Math.min(offset + 20, resultCount));
			},
			{ rootMargin: "0px 0px 400px 0px" },
		);

		observer.observe(sentinel.current);
		return () => {
			appended = true;
			observer.disconnect();
		};
	}, [offset, loading, failed, hasMore, resultCount]);

	return (
		<>
			<SearchBar value={query} onChange={changeQuery} />
			{!loading && !failed && resultCount === 0 && <p>No shows found.</p>}
			<div className={styles["show-container-grid"]}>
				{visible.map((show) => (
					<ShowCard
						key={show.id}
						show={show}
						tags={visibleTags}
						playlistSaves={
							playlistSavesByShowId.get(show.id) ?? emptyPlaylistSaves
						}
						record={recordsByShowId.get(show.id)}
					/>
				))}
			</div>
			{needsCatalog && (
				<LoadingState
					status={status}
					loading="Loading shows..."
					className={
						status === "loading" ? styles["loading"] : styles["status"]
					}
					error={
						<>
							Could not load more shows.{" "}
							<button
								type="button"
								aria-label="Retry loading shows"
								onClick={retryLoading}
							>
								Retry
							</button>
						</>
					}
				/>
			)}
			{hasMore && (
				<div ref={sentinel} className={styles["sentinel"]} aria-hidden="true" />
			)}
		</>
	);
}
