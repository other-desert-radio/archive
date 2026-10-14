import type { ReactElement } from "react";
import styles from "./Miniplayer.module.css";

type Props = {
	hidden: boolean;
	onExpand: (trigger: HTMLButtonElement) => void;
};

// Both controls delegate presentation changes to the parent hook.
export function MobileExpand({ hidden, onExpand }: Props): ReactElement {
	return (
		<button
			type="button"
			className={styles["mobile-expand"]}
			hidden={hidden}
			onClick={(event) => onExpand(event.currentTarget)}
			aria-label="Expand player"
		>
			expand <span aria-hidden="true">↑</span>
		</button>
	);
}

export function DesktopActions({ hidden, onExpand }: Props): ReactElement {
	return (
		<div className={styles["desktop-actions"]} hidden={hidden}>
			<button type="button" aria-label="Favorite show">
				<span className={styles["heart-icon"]} aria-hidden="true">
					{"\u2661\uFE0E"}
				</span>
			</button>
			<button
				type="button"
				aria-label="Expand player"
				onClick={(event) => onExpand(event.currentTarget)}
			>
				<span aria-hidden="true">{"\u26F6\uFE0E"}</span>
			</button>
		</div>
	);
}
