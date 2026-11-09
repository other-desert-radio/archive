import type { Tag } from "../../utils/fetch-tags";
import { getBasePath } from "../../utils/get-base-path";
import styles from "./TagBar.module.css";

type Props = {
	entries: readonly { tag: Tag; percent: number }[];
	base: string;
	rows?: 1 | 2;
};

export default function TagBar({ entries, base, rows = 1 }: Props) {
	if (!entries.length) {
		return null;
	}
	const split = Math.ceil(entries.length / rows);
	const groups =
		rows === 2 ? [entries.slice(0, split), entries.slice(split)] : [entries];
	return (
		<nav className={styles["bar"]} aria-label="Tags">
			{groups
				.filter((group) => group.length > 0)
				.map((group) => {
					const total = group.reduce((sum, entry) => sum + entry.percent, 0);
					return (
						<div className={styles["row"]} key={group[0]?.tag.id}>
							{group.map(({ tag, percent }) => (
								<a
									key={tag.id}
									data-tag-segment
									className={styles["segment"]}
									href={`${getBasePath(base)}/tags/${tag.id}`}
									title={tag.title}
									aria-label={`Explore ${tag.title}`}
									style={{
										backgroundColor: tag.color,
										width: `${total ? (percent / total) * 100 : 100 / group.length}%`,
									}}
								>
									<span data-tag-label className={styles["label"]}>
										{tag.title}
									</span>
								</a>
							))}
						</div>
					);
				})}
		</nav>
	);
}
