/** Callers select searchable text; filtering preserves item types and ordering. */
export function filterSearch<T>(
	items: readonly T[],
	query: string,
	stringify: (item: T) => string,
): readonly T[] {
	const normalizedQuery = query.trim().toLowerCase();
	/**
	 * return all if no saerch item
	 */
	if (!normalizedQuery) {
		return items;
	}
	return items.filter((item) =>
		stringify(item).toLowerCase().includes(normalizedQuery),
	);
}
