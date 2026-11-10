import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ExplorePane from "../src/components/explore/ExplorePane";

const tags = new Map([
	[3, { id: 3, title: "Ambient", color: "#ffffff" }],
	[1, { id: 1, title: "Jazz", color: "#ffffff" }],
	[2, { id: 2, title: "Dark Ambient", color: "#ffffff" }],
]);

test("Explore renders all tag links statically in supplied order", () => {
	const html = renderToStaticMarkup(<ExplorePane tags={tags} />);
	assert.equal((html.match(/aria-label="Explore /g) ?? []).length, tags.size);
	assert.ok(html.indexOf("Explore Ambient") < html.indexOf("Explore Jazz"));
	assert.ok(
		html.indexOf("Explore Jazz") < html.indexOf("Explore Dark Ambient"),
	);
	assert.match(html, /data-explore-empty[^>]*hidden/);
	assert.doesNotMatch(html, /<input/);
});

test("Explore shows an empty message for an empty catalog", () => {
	const html = renderToStaticMarkup(<ExplorePane tags={new Map()} />);
	assert.match(html, /No tags found/);
	assert.doesNotMatch(html, /hidden|aria-label="Explore /);
});
