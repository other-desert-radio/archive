import type { ReactElement } from "react";
import type { Show } from "../../utils/fetch-shows";
import styles from "./ShowExploreCard.module.css";

type Props = {
	show: Show;
};

export default function ShowExploreCard({ show }: Props): ReactElement {
	return (
		<div className={styles["show-explore-card"]}>
			<img
				src={show.image_large}
				alt={show.title}
				className="image-border-primary"
				loading="lazy"
			/>
		</div>
	);
}
