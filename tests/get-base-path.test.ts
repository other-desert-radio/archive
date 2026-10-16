import assert from "node:assert/strict";
import test from "node:test";
import { getBasePath } from "../src/utils/get-base-path";

test("normalizes root hosting for URL suffixes", () => {
	assert.equal(getBasePath("/"), "");
	assert.equal(getBasePath(""), "");
});

test("normalizes a deployment subpath with or without a trailing slash", () => {
	assert.equal(getBasePath("/archive-site/"), "/archive-site");
	assert.equal(getBasePath("/archive-site"), "/archive-site");
});
