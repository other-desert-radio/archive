import type { ReactElement } from "react";
import styles from "./Miniplayer.module.css";

type Props = {
	hidden: boolean;
	onExpand: () => void;
};

// Both controls delegate presentation changes to the parent hook.
export function MobileExpand({ hidden, onExpand }: Props): ReactElement {
	return (
		<button
			type="button"
			className={styles["mobile-expand"]}
			hidden={hidden}
			onClick={onExpand}
			aria-label="Expand player"
		>
			expand <span aria-hidden="true">↑</span>
		</button>
	);
}

export function DesktopActions({
	base,
	hidden,
	onExpand,
}: Props & { base: string }): ReactElement {
	return (
		<div className={styles["desktop-actions"]} hidden={hidden}>
			<button type="button" aria-label="Favorite show">
				<svg
					className={styles["heart-icon"]}
					viewBox="0 0 64 64"
					fill="none"
					aria-hidden="true"
				>
					<use href={`${base}/assets/icons/heart.svg#heart`} />
				</svg>
			</button>
			<button type="button" aria-label="Expand player" onClick={onExpand}>
				<span aria-hidden="true">{"\u26F6\uFE0E"}</span>
			</button>
		</div>
	);
}
