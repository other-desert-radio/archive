import type { TagMap } from "../../utils/fetch-tags";
import styles from "./ExplorePane.module.css";
import { ExploreTagView } from "./ExploreTagView";

type Props = {
	tags: TagMap;
};

export default function ExplorePane({ tags }: Props) {
	return (
		<>
			<p data-explore-empty hidden={tags.size > 0}>
				No tags found.
			</p>
			<div className={styles["tags-container"]} data-explore-tags>
				{Array.from(tags.values()).map((tag) => (
					<ExploreTagView key={tag.id} tag={tag} />
				))}
			</div>
		</>
	);
}
