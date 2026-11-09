import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import TagBar from "../src/components/tag-bar/TagBar";

const entries = [60, 20, 15, 5].map((percent, id) => ({
	tag: { id, title: `Tag ${id}`, color: "#abcdef" },
	percent,
}));

test("renders every tag over two normalized rows with accessible links", () => {
	const html = renderToStaticMarkup(
		<TagBar entries={entries} base="/archive/" rows={2} />,
	);
	assert.equal((html.match(/data-tag-segment/g) ?? []).length, 4);
	assert.match(html, /width:75%/);
	assert.match(html, /width:25%/);
	assert.match(html, /href="\/archive\/tags\/3"/);
	assert.match(html, /aria-label="Explore Tag 3"/);
	assert.match(html, /title="Tag 3"/);
});

test("omits empty bars and gives unweighted tags equal space", () => {
	assert.equal(renderToStaticMarkup(<TagBar entries={[]} base="/" />), "");
	const html = renderToStaticMarkup(
		<TagBar
			entries={entries.map((entry) => ({ ...entry, percent: 0 }))}
			base="/"
			rows={2}
		/>,
	);
	assert.equal((html.match(/width:50%/g) ?? []).length, 4);
});
