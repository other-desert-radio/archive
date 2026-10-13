import type { ReactElement } from "react";
import type { Show } from "../../utils/fetch-shows";
import styles from "./ShowExploreCard.module.css";

type Props = {
	show: Show;
	base: string;
};

export default function ShowExploreCard({ show, base }: Props): ReactElement {
	const detailBase = base.replace(/\/$/, "");
	return (
		<a
			className={styles["show-explore-card"]}
			href={`${detailBase}/shows/${show.id}`}
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
