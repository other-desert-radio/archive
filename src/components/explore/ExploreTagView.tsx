import type { Tag } from "../../utils/fetch-tags";
import styles from "./ExploreTagView.module.css";

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
