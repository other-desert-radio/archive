import type { ReactElement } from "react";
import type { Show } from "../../utils/fetch-shows";
import type { TagMap } from "../../utils/fetch-tags";
import { hydrateTags } from "../../utils/hydrate-tags";
import TagView from "../TagView";
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
					href={`${base}/tags/${tag.id}`}
					aria-label={`Explore ${tag.title}`}
				>
					<TagView tag={tag} size="large" />
				</a>
			))}
		</div>
	);
}

// Render all DJ links/portraits; shows without DJs have no DJ section.
export function FullscreenDJs({ show, base }: ShowProps): ReactElement | null {
	if (show.djs.length === 0) {
		return null;
	}
	return (
		<div className={styles["fullscreen-dj-list"]}>
			{show.djs.map((dj) => (
				<a
					key={dj.id}
					href={`${base}/djs/${dj.id}`}
					aria-label={`View ${dj.title}`}
					className={styles["fullscreen-dj"]}
				>
					{dj.image_small && <img src={`${base}/${dj.image_small}`} alt="" />}
					<span>{dj.title}</span>
				</a>
			))}
		</div>
	);
}

// Presentational only: favorites behavior is outside this task's scope.
export function FullscreenHeart(): ReactElement {
	return (
		<button
			type="button"
			aria-label="Favorite show"
			className={styles["fullscreen-heart-button"]}
		>
			<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
				<path
					d="M32 57S5 41 5 22C5 5 25 2 32 16C39 2 59 5 59 22C59 41 32 57 32 57Z"
					stroke="currentColor"
					strokeWidth="4"
					strokeLinejoin="round"
				/>
			</svg>
		</button>
	);
}
