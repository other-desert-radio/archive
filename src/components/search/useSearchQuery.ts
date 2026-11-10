import { useCallback, useEffect, useState } from "react";

// Keep each page's query across client navigation; a full reload starts fresh.
const queries = new Map<string, string>();

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
