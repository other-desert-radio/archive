import type { ReactElement } from "react";
import type { Show } from "../../utils/fetch-shows";
import styles from "./SquareShowCard.module.css";

type Props = {
	show: Show;
	base: string;
	fromTag?: number;
};

export default function SquareShowCard({
	show,
	base,
	fromTag,
}: Props): ReactElement {
	const detailBase = base.replace(/\/$/, "");
	const query = fromTag === undefined ? "" : `?fromTag=${fromTag}`;
	return (
		<a
			className={styles["square-show-card"]}
			data-astro-reload
			href={`${detailBase}/shows/${show.id}${query}`}
			aria-label={`View ${show.title}`}
		>
			<img
				src={show.image_large}
				alt={show.title}
				className="image-border-primary"
				loading="lazy"
				decoding="async"
			/>
			<span className={`${styles["overlay"]} image-border-primary`}>
				<span className={styles["title"]}>{show.title}</span>
			</span>
		</a>
	);
}
