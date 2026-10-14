import type { ReactElement } from "react";
import type { Show } from "../../utils/fetch-shows";
import type { TagMap } from "../../utils/fetch-tags";
import { hydrateTags } from "../../utils/hydrate-tags";
import styles from "./Miniplayer.module.css";

type ShowProps = {
	show: Show;
	base: string;
};

type TagsProps = ShowProps & {
	tags: TagMap;
};

// The caller supplies the catalog; this section resolves the show's tag IDs.
export function FullscreenTags({ show, base, tags }: TagsProps): ReactElement {
	return (
		<div className={`tag-container ${styles["fullscreen-tags"]}`}>
			{hydrateTags(show, tags).map((tag) => (
				<a
					key={tag.id}
					className="tag tag-large"
					href={`${base}/tags/${tag.id}`}
					aria-label={`Explore ${tag.title}`}
					style={{ backgroundColor: tag.color }}
				>
					{tag.title}
				</a>
			))}
		</div>
	);
}

// Render all DJ links/portraits; shows without DJs have no DJ section.
export function FullscreenDJs(_props: ShowProps): ReactElement | null {
	throw new Error("Not implemented");
}

// Presentational only: favorites behavior is outside this task's scope.
export function FullscreenHeart(): ReactElement {
	throw new Error("Not implemented");
}
