import type { Tag } from "./fetch-tags";

export function tagBreakdown(
	tags: readonly Tag[],
	shows: readonly { tagIds: number[] }[],
) {
	const counts = new Map<number, number>();
	for (const show of shows) {
		for (const id of new Set(show.tagIds)) {
			counts.set(id, (counts.get(id) ?? 0) + 1);
		}
	}
	const entries = tags.map((tag) => ({ tag, count: counts.get(tag.id) ?? 0 }));
	const total = entries.reduce((sum, entry) => sum + entry.count, 0);
	return entries
		.map(({ tag, count }) => ({
			tag,
			percent: total ? (count / total) * 100 : 0,
		}))
		.sort((a, b) => b.percent - a.percent);
}
