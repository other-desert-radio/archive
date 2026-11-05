import type { Ref } from "react";
import styles from "./FavoriteModal.module.css";

export default function FavoriteModal({
	ref,
}: {
	ref: Ref<HTMLDialogElement>;
}) {
	return (
		<dialog ref={ref} className={styles["modal"]} aria-label="Favorite show">
			<p>Favorites</p>
			<form method="dialog">
				<button type="submit" aria-label="Close favorites">
					Close
				</button>
			</form>
		</dialog>
	);
}
