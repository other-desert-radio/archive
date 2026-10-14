import type { ReactElement } from "react";
import styles from "./Miniplayer.module.css";

type Props = {
	base: string;
	onClose: () => void;
};

// Presentational only: the parent owns closing and scroll-lock cleanup.
export default function FullscreenNav({ base, onClose }: Props): ReactElement {
	return (
		<div className={styles["fullscreen-header"]}>
			<span>OTHER DESERT RADIO</span>
			<button
				type="button"
				className={styles["close-button"]}
				aria-label="Close player"
				onClick={onClose}
			>
				<img src={`${base}/assets/icons/close.svg`} alt="" aria-hidden="true" />
			</button>
		</div>
	);
}
