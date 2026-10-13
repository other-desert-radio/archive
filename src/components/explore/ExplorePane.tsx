import type { TagMap } from "../../utils/fetch-tags";
import styles from "./ExplorePane.module.css";
import { ExploreTagView } from "./ExploreTagView";

type Props = {
	tags: TagMap;
};

export default function ExplorePane({ tags }: Props) {
	if (tags.size === 0) {
		return <p>No tags found.</p>;
	}

	return (
		<div className={styles["tags-container"]}>
			{Array.from(tags.values()).map((tag) => (
				<ExploreTagView key={tag.id} tag={tag} />
			))}
		</div>
	);
}
