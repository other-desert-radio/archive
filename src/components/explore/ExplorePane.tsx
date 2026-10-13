import type { Tag, TagMap } from "../../utils/fetch-tags";
import styles from "./ExplorePane.module.css";

type Props = {
	tags: TagMap;
};

export function ExploreTagView({ tag }: { tag: Tag }) {
	return (
		<div
			className={styles["explore-tag"]}
			style={{ backgroundColor: tag.color }}
		>
			{tag.title}
		</div>
	);
}

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
