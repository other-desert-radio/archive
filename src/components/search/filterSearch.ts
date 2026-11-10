/** Callers select searchable text; filtering preserves item types and ordering. */
export function filterSearch<T>(
	_items: readonly T[],
	_query: string,
	_stringify: (item: T) => string,
): readonly T[] {
	throw new Error("Not implemented");
}
