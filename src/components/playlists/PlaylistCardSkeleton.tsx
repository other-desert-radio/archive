import styles from "./PlaylistCard.module.css";

export default function PlaylistCardSkeleton({
	exiting = false,
}: {
	exiting?: boolean;
}) {
	return (
		<div
			className={`${styles["playlist-container"]} skeleton-fade ${exiting ? "skeleton-exit" : ""}`}
			aria-hidden="true"
		>
			<div className={styles["playlist-shows-grid"]}>
				{[0, 1, 2, 3].map((slot) => (
					<div key={slot} className={styles["placeholder"]} />
				))}
			</div>
			<span className={`${styles["playlist"]} ${styles["skeleton-title"]}`} />
		</div>
	);
}
