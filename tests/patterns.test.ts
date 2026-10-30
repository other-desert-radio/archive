import assert from "node:assert/strict";
import test from "node:test";
import { isMatching } from "ts-pattern";
import {
	AssetReferencePattern,
	HttpUrlPattern,
	IsoDatePattern,
} from "../src/utils/patterns";

test("matches supported ISO date values", () => {
	assert.equal(isMatching(IsoDatePattern, "2026-05-25"), true);
	assert.equal(isMatching(IsoDatePattern, "2026-05-25T00:00:00.000Z"), true);
	assert.equal(isMatching(IsoDatePattern, "May 25, 2026"), false);
	assert.equal(isMatching(IsoDatePattern, "2026/05/25"), false);
});

test("matches HTTP(S) URLs only", () => {
	assert.equal(
		isMatching(HttpUrlPattern, "https://www.mixcloud.com/show"),
		true,
	);
	assert.equal(isMatching(HttpUrlPattern, "http://example.com"), true);
	assert.equal(isMatching(HttpUrlPattern, "ftp://example.com/show"), false);
	assert.equal(isMatching(HttpUrlPattern, "not a URL"), false);
});

test("matches absolute and relative asset references without whitespace", () => {
	assert.equal(isMatching(AssetReferencePattern, "images/shows/1.jpg"), true);
	assert.equal(isMatching(AssetReferencePattern, "/archive/image.webp"), true);
	assert.equal(
		isMatching(AssetReferencePattern, "https://cdn.example.com/image.jpg"),
		true,
	);
	assert.equal(
		isMatching(AssetReferencePattern, "image with spaces.jpg"),
		false,
	);
});
