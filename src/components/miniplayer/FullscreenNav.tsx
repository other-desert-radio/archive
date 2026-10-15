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
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					aria-hidden="true"
				>
					<use href={`${base}/assets/icons/close.svg#close`} />
				</svg>
			</button>
		</div>
	);
}
