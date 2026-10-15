import type { ReactElement } from "react";
import type { Show } from "../../utils/fetch-shows";
import type { TagMap } from "../../utils/fetch-tags";
import { hydrateTags } from "../../utils/hydrate-tags";
import TagView from "../TagView";
import styles from "./Miniplayer.module.css";

type ShowProps = {
	show: Show;
	base: string;
	onNavigate?: () => void;
};

type TagsProps = ShowProps & {
	tags: TagMap;
};

// The caller supplies the catalog; this section resolves the show's tag IDs.
export function FullscreenTags({
	show,
	base,
	tags,
	onNavigate,
}: TagsProps): ReactElement {
	return (
		<div className={`tag-container ${styles["fullscreen-tags"]}`}>
			{hydrateTags(show, tags).map((tag) => (
				<a
					key={tag.id}
					data-astro-reload
					href={`${base}/tags/${tag.id}`}
					aria-label={`Explore ${tag.title}`}
					onClick={onNavigate}
				>
					<TagView tag={tag} size="large" />
				</a>
			))}
		</div>
	);
}

// Render all DJ links/portraits; shows without DJs have no DJ section.
export function FullscreenDJs({
	show,
	base,
	onNavigate,
}: ShowProps): ReactElement | null {
	if (show.djs.length === 0) {
		return null;
	}
	return (
		<div className={styles["fullscreen-dj-list"]}>
			{show.djs.map((dj) => (
				<a
					key={dj.id}
					data-astro-reload
					href={`${base}/djs/${dj.id}`}
					aria-label={`View ${dj.title}`}
					onClick={onNavigate}
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
export function FullscreenHeart({ base }: { base: string }): ReactElement {
	return (
		<button
			type="button"
			aria-label="Favorite show"
			className={styles["fullscreen-heart-button"]}
		>
			<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
				<use href={`${base}/assets/icons/heart.svg#heart`} />
			</svg>
		</button>
	);
}
