import type { Tag } from "../../utils/fetch-tags";
import { getBasePath } from "../../utils/get-base-path";
import styles from "./ExploreTagView.module.css";

export function ExploreTagView({ tag }: { tag: Tag }) {
	const base = getBasePath();

	return (
		<a
			href={`${base}/tags/${tag.id}`}
			aria-label={`Explore ${tag.title}`}
			className={styles["explore-tag"]}
			style={{ backgroundColor: tag.color }}
		>
			{tag.title}
		</a>
	);
}
