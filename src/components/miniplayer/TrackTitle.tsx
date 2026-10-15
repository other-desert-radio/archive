import type { ReactElement } from "react";
import type { Show } from "../../utils/fetch-shows";
import styles from "./Miniplayer.module.css";

type Props = {
	show: Show;
	base: string;
	hidden?: boolean;
};

export default function TrackTitle({
	show,
	base,
	hidden = false,
}: Props): ReactElement {
	return (
		<div className={styles["title"]} hidden={hidden}>
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
