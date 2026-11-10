import { useMemo } from "react";
import type { DJ } from "../../utils/fetch-djs";
import type { TagMap } from "../../utils/fetch-tags";
import { getBasePath } from "../../utils/get-base-path";
import { filterSearch } from "../search/filterSearch";
import SearchBar from "../search/SearchBar";
import { useSearchQuery } from "../search/useSearchQuery";
import DJCard from "./DJCard";
import styles from "./DJsPane.module.css";

type Props = {
	base: string;
	djs: DJ[];
	tags: TagMap;
	initialQuery?: string;
};

export default function DJsPane({ base, djs, tags, initialQuery }: Props) {
	const [query, setQuery] = useSearchQuery("djs", initialQuery);
	const detailBase = getBasePath(base);

	const matchingDJs = useMemo(
		() => filterSearch(djs, query, (dj) => dj.title),
		[djs, query],
	);

	return (
		<>
			<SearchBar value={query} onChange={setQuery} />
			{matchingDJs.length === 0 && <p>No DJs found.</p>}
			<div className={styles["djs-container-grid"]}>
				{matchingDJs.map((dj) => (
					<DJCard key={dj.id} base={detailBase} dj={dj} tags={tags} />
				))}
			</div>
		</>
	);
}
