import assert from "node:assert/strict";
import test from "node:test";
import { tagBreakdown } from "../src/utils/tag-breakdown";

const tags = [
	{ id: 1, title: "House", color: "red" },
	{ id: 2, title: "Jazz", color: "blue" },
	{ id: 3, title: "Ambient", color: "green" },
];

test("ranks known tags by show usage and keeps unused tags", () => {
	const result = tagBreakdown(tags, [
		{ tagIds: [2, 2, 99] },
		{ tagIds: [1, 2] },
	]);
	assert.deepEqual(
		result.map(({ tag }) => tag.id),
		[2, 1, 3],
	);
	assert.ok(Math.abs((result[0]?.percent ?? 0) - 200 / 3) < 0.001);
	assert.ok(
		Math.abs(result.reduce((sum, entry) => sum + entry.percent, 0) - 100) <
			0.001,
	);
});

test("handles DJs without tagged shows", () => {
	assert.deepEqual(
		tagBreakdown(tags, []).map(({ percent }) => percent),
		[0, 0, 0],
	);
	assert.deepEqual(tagBreakdown([], []), []);
});
