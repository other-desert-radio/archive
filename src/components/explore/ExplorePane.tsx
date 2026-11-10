import { useState } from "react";
import type { TagMap } from "../../utils/fetch-tags";
import SearchBar from "../search/SearchBar";
import styles from "./ExplorePane.module.css";
import { ExploreTagView } from "./ExploreTagView";

type Props = {
	tags: TagMap;
};

export default function ExplorePane({ tags }: Props) {
	const [query, setQuery] = useState("");
	return (
		<>
			<SearchBar value={query} onChange={setQuery} />
			{tags.size === 0 && <p>No tags found.</p>}
			<div className={styles["tags-container"]}>
				{Array.from(tags.values()).map((tag) => (
					<ExploreTagView key={tag.id} tag={tag} />
				))}
			</div>
		</>
	);
}
