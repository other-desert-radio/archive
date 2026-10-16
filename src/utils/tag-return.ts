import type { Tag } from "./fetch-tags";
import { getBasePath } from "./get-base-path";

/** Resolve only known tag IDs, never an arbitrary return URL. */
export function getTagReturn(
	search: string,
	base: string,
	tags: readonly Pick<Tag, "id" | "title">[],
): { href: string; label: string } | undefined {
	const id = new URLSearchParams(search).get("fromTag");
	const tag = tags.find((candidate) => String(candidate.id) === id);
	if (!tag) {
		return undefined;
	}
	return {
		href: `${getBasePath(base)}/tags/${tag.id}`,
		label: tag.title.toUpperCase(),
	};
}
