import type { Tag } from "../utils/fetch-tags";
import { getBasePath } from "../utils/get-base-path";

type Props = {
	tag: Tag;
	size: "normal" | "large";
};

export default function TagView({ tag, size }: Props) {
	const base = getBasePath();

	return (
		<a
			href={`${base}/tags/${tag.id}`}
			aria-label={`Explore ${tag.title}`}
			className={size === "large" ? "tag tag-large" : "tag"}
			style={{ backgroundColor: tag.color }}
		>
			{tag.title}
		</a>
	);
}
