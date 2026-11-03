import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ShowsPane from "../../../src/components/shows/ShowsPane";
import fixture from "../../res/shows.json";
import tags from "../../res/tags.json";

test("empty listings show an empty message without a loading status", () => {
	const html = renderToStaticMarkup(
		<ShowsPane
			base="/archive"
			shows={[]}
			showIds={[]}
			tags={new Map(tags.data.map((tag) => [tag.id, tag]))}
		/>,
	);
	assert.ok(html.includes("No shows found."));
	assert.ok(!html.includes("Loading shows..."));
});

test("short listings render all cards without a loading status or sentinel", () => {
	const html = renderToStaticMarkup(
		<ShowsPane
			base="/archive"
			shows={fixture.data}
			showIds={fixture.data.map((show) => show.id)}
			tags={new Map(tags.data.map((tag) => [tag.id, tag]))}
		/>,
	);
	assert.equal((html.match(/<article\b/g) ?? []).length, fixture.data.length);
	assert.ok(!html.includes("Loading shows..."));
	assert.ok(!html.includes("sentinel"));
});
