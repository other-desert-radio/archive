import assert from "node:assert/strict";
import test from "node:test";
import { getTagReturn } from "../src/utils/tag-return";

const tags = [{ id: 21, title: "Experimental" }];

test("returns to the known tag with a normalized base path", () => {
	assert.deepEqual(getTagReturn("?fromTag=21", "/archive/", tags), {
		href: "/archive/tags/21",
		label: "EXPERIMENTAL",
	});
	assert.equal(getTagReturn("?fromTag=21", "/", tags)?.href, "/tags/21");
});

test("keeps the default destination for absent, malformed, or unknown tags", () => {
	for (const search of [
		"",
		"?fromTag=",
		"?fromTag=999",
		"?fromTag=21abc",
		"?fromTag=https://example.com",
	]) {
		assert.equal(getTagReturn(search, "/archive", tags), undefined);
	}
});
