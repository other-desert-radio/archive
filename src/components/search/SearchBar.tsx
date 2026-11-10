import {
	type ReactElement,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import type {
	SearchCategory,
	SearchEntry,
} from "../../stores/search-history-store";
import { useSearchHistoryStore } from "../../stores/stores-context";
import styles from "./SearchBar.module.css";

type Props = {
	value: string;
	onChange: (value: string) => void;
	historyCategory?: SearchCategory;
};

const emptyHistory: readonly SearchEntry[] = [];
function Cross() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			aria-hidden="true"
		>
			<path d="m6 6 12 12M6 18 18 6" />
		</svg>
	);
}

export default function SearchBar({
	value,
	onChange,
	historyCategory,
}: Props): ReactElement {
	const store = useSearchHistoryStore();
	const entries = useSyncExternalStore(
		store.subscribe,
		() => (historyCategory ? store.getSnapshot(historyCategory) : emptyHistory),
		() => emptyHistory,
	);
	const [open, setOpen] = useState(false);
	const [error, setError] = useState("");
	const root = useRef<HTMLElement>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const composing = useRef(false);
	const popupId = useId();

	const cancelTimer = useCallback(() => {
		clearTimeout(timer.current);
		timer.current = undefined;
	}, []);

	function report(operation: Promise<void>) {
		void operation.then(
			() => setError(""),
			() => setError("Search history could not be updated. Please try again."),
		);
	}

	function finalize(query: string) {
		cancelTimer();
		if (historyCategory) {
			report(store.save(historyCategory, query));
		}
	}

	useEffect(() => {
		if (historyCategory) {
			void store
				.initialize(historyCategory)
				.catch(() =>
					setError("Search history could not be loaded. Please try again."),
				);
		}
	}, [store, historyCategory]);

	useEffect(() => {
		function dismiss(event: PointerEvent) {
			if (
				event.target instanceof Node &&
				!root.current?.contains(event.target)
			) {
				setOpen(false);
			}
		}
		function leave() {
			cancelTimer();
			setOpen(false);
		}
		document.addEventListener("pointerdown", dismiss);
		document.addEventListener("astro:before-preparation", leave);
		window.addEventListener("pagehide", leave);
		return () => {
			cancelTimer();
			document.removeEventListener("pointerdown", dismiss);
			document.removeEventListener("astro:before-preparation", leave);
			window.removeEventListener("pagehide", leave);
		};
	}, [cancelTimer]);

	return (
		<search
			ref={root}
			className={styles["search"]}
			onFocus={() => setOpen(true)}
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget)) {
					cancelTimer();
					setOpen(false);
				}
			}}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					setOpen(false);
				}
			}}
		>
			<input
				type="search"
				aria-label="Search"
				placeholder="SEARCH..."
				value={value}
				aria-controls={open && entries.length > 0 ? popupId : undefined}
				onClick={() => setOpen(true)}
				onCompositionStart={() => {
					composing.current = true;
					cancelTimer();
				}}
				onCompositionEnd={(event) => {
					composing.current = false;
					const query = event.currentTarget.value;
					cancelTimer();
					if (historyCategory && query.trim()) {
						timer.current = setTimeout(() => finalize(query), 3000);
					}
				}}
				onChange={(event) => {
					const query = event.currentTarget.value;
					cancelTimer();
					if (query.trim() && historyCategory && !composing.current) {
						timer.current = setTimeout(() => finalize(query), 3000);
					}
					onChange(query);
				}}
				onKeyDown={(event) => {
					if (
						event.key === "Enter" &&
						!event.nativeEvent.isComposing &&
						!composing.current
					) {
						event.preventDefault();
						finalize(value);
					}
				}}
			/>
			{value !== "" && (
				<button
					type="button"
					aria-label="Clear search"
					className={styles["clear"]}
					onClick={() => {
						finalize(value);
						root.current
							?.querySelector("input")
							?.focus({ preventScroll: true });
						onChange("");
					}}
				>
					<Cross />
				</button>
			)}
			{historyCategory && open && entries.length > 0 && (
				<ul
					id={popupId}
					aria-label="Previous searches"
					className={styles["history"]}
				>
					{entries.map((entry) => (
						<li key={entry.query} className={styles["entry"]}>
							<button
								type="button"
								aria-label={`Search for ${entry.query}`}
								className={styles["query"]}
								onClick={() => {
									finalize(entry.query);
									onChange(entry.query);
									root.current?.querySelector("input")?.focus();
									setOpen(false);
								}}
							>
								{entry.query}
							</button>
							<button
								type="button"
								aria-label={`Remove search ${entry.query}`}
								className={styles["remove"]}
								onClick={() => {
									cancelTimer();
									root.current
										?.querySelector("input")
										?.focus({ preventScroll: true });
									report(store.remove(historyCategory, entry.query));
								}}
							>
								<Cross />
							</button>
						</li>
					))}
				</ul>
			)}
			{error && <p role="alert">{error}</p>}
		</search>
	);
}
