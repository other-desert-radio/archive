import type { ReactElement } from "react";
import type { Show } from "../../utils/fetch-shows";
import styles from "./ShowExploreCard.module.css";

type Props = {
	show: Show;
	base: string;
	fromTag?: number;
};

export default function ShowExploreCard({
	show,
	base,
	fromTag,
}: Props): ReactElement {
	const detailBase = base.replace(/\/$/, "");
	const query = fromTag === undefined ? "" : `?fromTag=${fromTag}`;
	return (
		<a
			className={styles["show-explore-card"]}
			href={`${detailBase}/shows/${show.id}${query}`}
			aria-label={`View ${show.title}`}
		>
			<img
				src={show.image_large}
				alt={show.title}
				className="image-border-primary"
				loading="lazy"
			/>
		</a>
	);
}
