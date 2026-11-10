import { useCallback, useEffect, useState } from "react";

// Keep queries during detail visits; choosing a category starts a fresh search.
const queries = new Map<string, string>();

if (typeof document !== "undefined") {
	document.addEventListener("astro:before-preparation", (event) => {
		if (event.sourceElement?.closest("[data-category-tabs] a")) {
			queries.clear();
		}
	});
}

export function useSearchQuery(key: string, initialQuery?: string) {
	const [query, setQuery] = useState(initialQuery ?? "");
	useEffect(() => {
		setQuery(initialQuery ?? queries.get(key) ?? "");
	}, [key, initialQuery]);
	const changeQuery = useCallback(
		(value: string) => {
			queries.set(key, value);
			setQuery(value);
		},
		[key],
	);
	return [query, changeQuery] as const;
}
