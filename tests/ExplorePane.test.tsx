import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ExplorePane from "../src/components/explore/ExplorePane";

const tags = new Map([
	[3, { id: 3, title: "Ambient", color: "#ffffff" }],
	[1, { id: 1, title: "Jazz", color: "#ffffff" }],
	[2, { id: 2, title: "Dark Ambient", color: "#ffffff" }],
]);

test("Explore searches tag titles and keeps the supplied order", () => {
	const html = renderToStaticMarkup(
		<ExplorePane tags={tags} initialQuery="  aMbIeNt  " />,
	);
	assert.match(html, /aria-label="Explore Ambient"/);
	assert.match(html, /aria-label="Explore Dark Ambient"/);
	assert.doesNotMatch(html, /aria-label="Explore Jazz"/);
	assert.ok(
		html.indexOf("Explore Ambient") < html.indexOf("Explore Dark Ambient"),
	);
});

test("Explore renders all tags for a whitespace query", () => {
	const html = renderToStaticMarkup(
		<ExplorePane tags={tags} initialQuery="  " />,
	);
	assert.equal((html.match(/aria-label="Explore /g) ?? []).length, tags.size);
});

test("Explore shows an empty message for no matches or an empty catalog", () => {
	for (const suppliedTags of [tags, new Map()]) {
		const html = renderToStaticMarkup(
			<ExplorePane tags={suppliedTags} initialQuery="no-matching-tag" />,
		);
		assert.match(html, /No tags found/);
		assert.doesNotMatch(html, /aria-label="Explore /);
	}
});
