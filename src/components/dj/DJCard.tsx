import type { DJ } from "../../utils/fetch-djs";
import type { TagMap } from "../../utils/fetch-tags";
import TagContainer from "../TagContainer";
import styles from "./DJCard.module.css";

type Props = {
	dj: DJ;
	base: string;
	tags: TagMap;
};

export default function DJCard({ dj, base, tags }: Props) {
	const tagSlice = dj.tagIds.slice(0, 8);

	return (
		<article className={styles["dj-card"]}>
			<a
				href={`${base}/djs/${dj.id}`}
				aria-label={`View ${dj.title}`}
				className={styles["artwork"]}
			>
				<img
					className={`${styles["image"]} image-border-primary`}
					src={`${base}/${dj.image_small}`}
					alt={dj.title}
					loading="lazy"
					decoding="async"
				/>
			</a>

			<div className={styles["trailing-content"]}>
				<h2 className={styles["dj-title"]}>
					<a href={`${base}/djs/${dj.id}`} aria-label={`View ${dj.title}`}>
						{dj.title}
					</a>
				</h2>
				<TagContainer tagIds={tagSlice} tags={tags} size="normal" />
			</div>
		</article>
	);
}
