import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
	FullscreenDJs,
	FullscreenHeart,
	FullscreenTags,
} from "../../src/components/miniplayer/FullscreenDetails";
import type { TagMap } from "../../src/utils/fetch-tags";
import fixtureShows from "../res/shows.json";

const show = fixtureShows.data[0];
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
			base="/archive"
			tags={tags}
		/>,
	);
	assert.ok(html.includes('href="/archive/tags/4"'));
	assert.ok(html.includes('href="/archive/tags/3"'));
	assert.ok(html.includes('aria-label="Explore Pop"'));
	assert.ok(html.includes("background-color:#ccbbaa"));
	assert.ok(html.includes("background-color:#336699"));
	assert.ok(
		html.indexOf('href="/archive/tags/4"') <
			html.indexOf('href="/archive/tags/3"'),
	);
	assert.ok(html.includes('class="tag tag-large"'));
});

test("fullscreen DJs render every name and portrait with archive links", () => {
	const html = renderToStaticMarkup(
		<FullscreenDJs
			show={{
				...show,
				djs: [
					{
						id: 12,
						title: "First DJ",
						image_small: "first.jpg",
						image_large: "",
					},
					{
						id: 13,
						title: "Second DJ",
						image_small: "second.jpg",
						image_large: "",
					},
				],
			}}
			base="/archive"
		/>,
	);
	assert.ok(html.includes('href="/archive/djs/12"'));
	assert.ok(html.includes('href="/archive/djs/13"'));
	assert.ok(html.includes('src="/archive/first.jpg"'));
	assert.ok(html.includes('src="/archive/second.jpg"'));
	assert.ok(html.includes('aria-label="View First DJ"'));
	assert.ok(html.includes("Second DJ</span>"));
});

test("fullscreen DJs omit absent DJs and missing portraits", () => {
	assert.equal(
		renderToStaticMarkup(<FullscreenDJs show={{ ...show, djs: [] }} base="" />),
		"",
	);
	const html = renderToStaticMarkup(
		<FullscreenDJs
			show={{
				...show,
				djs: [{ id: 12, title: "DJ", image_small: "", image_large: "" }],
			}}
			base=""
		/>,
	);
	assert.ok(html.includes('href="/djs/12"'));
	assert.equal(html.includes("<img"), false);
});

test("fullscreen heart renders a labeled outline button", () => {
	const html = renderToStaticMarkup(<FullscreenHeart base="/archive" />);
	assert.ok(html.includes('aria-label="Favorite show"'));
	assert.ok(html.includes('fill="none"'));
	assert.ok(html.includes('href="/archive/assets/icons/heart.svg#heart"'));
});

test("shows without tags render no tag links", () => {
	const html = renderToStaticMarkup(
		<FullscreenTags show={{ ...show, tagIds: [] }} base="" tags={tags} />,
	);
	assert.equal(html.includes("<a "), false);
});
