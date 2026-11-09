import styles from "./HistoryShowCard.module.css";

export default function HistoryShowCardSkeleton({
	exiting = false,
}: {
	exiting?: boolean;
}) {
	return (
		<div
			className={`${styles["card"]} skeleton-fade ${exiting ? "skeleton-exit" : ""}`}
			aria-hidden="true"
		>
			<div className={styles["skeleton-artwork"]} />
			<span className={`${styles["title"]} ${styles["skeleton-title"]}`}>
				&nbsp;
			</span>
		</div>
	);
}
