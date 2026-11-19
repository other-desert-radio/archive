import type { ReactElement, ReactNode } from "react";
import type { Show } from "../../utils/fetch-shows";
import styles from "./Miniplayer.module.css";

type Props = {
	children?: ReactNode;
	show: Show;
	base: string;
	hidden?: boolean;
	/** Disables interaction and hides the compact title from assistive technology while fullscreen. */
	inert?: boolean;
};

export default function TrackTitle({
	children,
	show,
	base,
	hidden = false,
	inert = false,
}: Props): ReactElement {
	return (
		<div className={styles["title"]} hidden={hidden} inert={inert}>
			{children}
			<span className={styles["desktop-title"]}>
				{show.djs.map((dj, index) => (
					<span key={dj.id}>
						{index > 0 && ", "}
						<a href={`${base}/djs/${dj.id}`} aria-label={`View ${dj.title}`}>
							{dj.title}
						</a>
					</span>
				))}
				{show.djs.length > 0 && (
					<span className={styles["divider"]} aria-hidden="true">
						|
					</span>
				)}
				<a href={`${base}/shows/${show.id}`} aria-label={`View ${show.title}`}>
					{show.title}
				</a>
			</span>
		</div>
	);
}
