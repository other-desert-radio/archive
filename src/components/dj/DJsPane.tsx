import { useState } from "react";
import type { DJ } from "../../utils/fetch-djs";
import type { TagMap } from "../../utils/fetch-tags";
import { getBasePath } from "../../utils/get-base-path";
import SearchBar from "../search/SearchBar";
import DJCard from "./DJCard";
import styles from "./DJsPane.module.css";

type Props = {
	base: string;
	djs: DJ[];
	tags: TagMap;
};

export default function DJsPane({ base, djs, tags }: Props) {
	const [query, setQuery] = useState("");
	const detailBase = getBasePath(base);

	return (
		<>
			<SearchBar value={query} onChange={setQuery} />
			{djs.length === 0 && <p>No DJs found.</p>}
			<div className={styles["djs-container-grid"]}>
				{djs.map((dj) => (
					<DJCard key={dj.id} base={detailBase} dj={dj} tags={tags} />
				))}
			</div>
		</>
	);
}
