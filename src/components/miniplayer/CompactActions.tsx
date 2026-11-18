import type { ReactElement } from "react";
import styles from "./Miniplayer.module.css";

type Props = {
	hidden: boolean;
	onExpand: () => void;
};

// Both controls delegate presentation changes to the parent hook.
export function MobileExpand({
	onExpand,
}: {
	onExpand: () => void;
}): ReactElement {
	return (
		<button
			type="button"
			className={styles["mobile-expand"]}
			data-player-drag-handle
			onClick={onExpand}
			aria-label="Expand player"
		>
			expand <span aria-hidden="true">↑</span>
		</button>
	);
}

export function DesktopActions({
	base,
	onFavorite,
	hidden,
	onExpand,
}: Props & { base: string; onFavorite: () => void }): ReactElement {
	return (
		<div className={styles["desktop-actions"]} hidden={hidden}>
			<button type="button" aria-label="Favorite show" onClick={onFavorite}>
				<svg
					className={styles["bookmark-icon"]}
					viewBox="0 0 24 24"
					fill="none"
					aria-hidden="true"
				>
					<use href={`${base}/assets/icons/bookmark.svg#bookmark`} />
				</svg>
			</button>
			<button type="button" aria-label="Expand player" onClick={onExpand}>
				<span aria-hidden="true">{"\u26F6\uFE0E"}</span>
			</button>
		</div>
	);
}
