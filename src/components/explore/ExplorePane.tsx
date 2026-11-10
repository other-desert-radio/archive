import { useMemo } from "react";
import type { TagMap } from "../../utils/fetch-tags";
import { filterSearch } from "../search/filterSearch";
import SearchBar from "../search/SearchBar";
import { useSearchQuery } from "../search/useSearchQuery";
import styles from "./ExplorePane.module.css";
import { ExploreTagView } from "./ExploreTagView";

type Props = {
	tags: TagMap;
	initialQuery?: string;
};

export default function ExplorePane({ tags, initialQuery }: Props) {
	const [query, setQuery] = useSearchQuery("explore", initialQuery);

	const matchingTags = useMemo(
		() => filterSearch(Array.from(tags.values()), query, (tag) => tag.title),
		[query, tags],
	);

	return (
		<>
			<SearchBar value={query} onChange={setQuery} />
			{matchingTags.length === 0 && <p>No tags found.</p>}
			<div className={styles["tags-container"]}>
				{matchingTags.map((tag) => (
					<ExploreTagView key={tag.id} tag={tag} />
				))}
			</div>
		</>
	);
}
