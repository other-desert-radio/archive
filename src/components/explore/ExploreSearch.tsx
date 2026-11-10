import { useEffect } from "react";
import { filterSearch } from "../search/filterSearch";
import SearchBar from "../search/SearchBar";
import { useSearchQuery } from "../search/useSearchQuery";

/** Search the rendered links without sending the tag catalog again as island props. */
export default function ExploreSearch() {
	const [query, setQuery] = useSearchQuery("explore");
	useEffect(() => {
		const links = Array.from(
			document.querySelectorAll<HTMLAnchorElement>("[data-explore-tags] a"),
		);
		const matches = new Set(
			filterSearch(links, query, (link) => link.textContent ?? ""),
		);
		for (const link of links) {
			link.hidden = !matches.has(link);
		}
		const empty = document.querySelector<HTMLElement>("[data-explore-empty]");
		if (empty) {
			empty.hidden = matches.size > 0;
		}
	}, [query]);
	return <SearchBar value={query} onChange={setQuery} />;
}
