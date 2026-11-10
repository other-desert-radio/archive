import assert from "node:assert/strict";
import { test } from "node:test";
import { filterSearch } from "../src/components/search/filterSearch";

const items = Object.freeze([
	Object.freeze({ id: 1, title: "Desert Nights", note: "Jazz" }),
	Object.freeze({ id: 2, title: "Morning Jazz", note: "Desert" }),
	Object.freeze({ id: 3, title: "Desert Dawn", note: "Ambient" }),
]);
const stringify = (item: (typeof items)[number]) => item.title;

test("empty and whitespace queries return the original dataset", () => {
	for (const query of ["", " \t\n "]) {
		assert.equal(filterSearch(items, query, stringify), items);
	}
});

test("matching trims the query, ignores case, and finds substrings in order", () => {
	const results = filterSearch(items, "  sErT  ", stringify);
	assert.equal(results.length, 2);
	assert.equal(results[0], items[0]);
	assert.equal(results[1], items[2]);
});

test("search uses only caller-selected fields", () => {
	assert.deepEqual(filterSearch(items, "jazz", stringify), [items[1]]);
	assert.deepEqual(
		filterSearch(items, "jazz", (item) => item.note),
		[items[0]],
	);
});

test("unmatched queries and empty datasets return no results", () => {
	assert.deepEqual(filterSearch(items, "ocean", stringify), []);
	assert.deepEqual(filterSearch([], "desert", stringify), []);
});
