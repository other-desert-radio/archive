import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FullscreenTags } from "../../src/components/miniplayer/FullscreenDetails";
import type { TagMap } from "../../src/utils/fetch-tags";
import fixtureShows from "../res/shows.json";

const show = fixtureShows[0];
if (!show) {
	throw new Error("Expected a show fixture.");
}

const tags: TagMap = new Map([
	[3, { id: 3, title: "Folk", color: "#336699" }],
	[4, { id: 4, title: "Pop", color: "#ccbbaa" }],
]);

test("fullscreen tags preserve show order, catalog colors and archive destinations", () => {
	const html = renderToStaticMarkup(
		<FullscreenTags
			show={{ ...show, tagIds: [4, 3] }}
			base="/archive-site"
			tags={tags}
		/>,
	);
	assert.ok(html.includes('href="/archive-site/tags/4"'));
	assert.ok(html.includes('href="/archive-site/tags/3"'));
	assert.ok(html.includes('aria-label="Explore Pop"'));
	assert.ok(html.includes("background-color:#ccbbaa"));
	assert.ok(html.includes("background-color:#336699"));
	assert.ok(html.indexOf(">Pop</a>") < html.indexOf(">Folk</a>"));
});

test("shows without tags render no tag links", () => {
	const html = renderToStaticMarkup(
		<FullscreenTags show={{ ...show, tagIds: [] }} base="" tags={tags} />,
	);
	assert.equal(html.includes("<a "), false);
});
