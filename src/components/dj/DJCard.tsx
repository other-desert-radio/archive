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
	return (
		<a
			data-astro-reload
			href={`${base}/djs/${dj.id}`}
			className={styles["dj-card"]}
			aria-label={`View ${dj.title}`}
		>
			<img
				className={`${styles["image"]} image-border-primary`}
				src={`${base}/${dj.image_small}`}
				alt={dj.title}
				loading="lazy"
				decoding="async"
			/>

			<div className={styles["trailing-content"]}>
				<h2 className={styles["dj-title"]}>{dj.title}</h2>
				<TagContainer tagIds={dj.tagIds} tags={tags} size="normal" />
			</div>
		</a>
	);
}
