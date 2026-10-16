import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import TagView from "../src/components/TagView";

test("renders a tag title with its configured background color", () => {
	const markup = renderToStaticMarkup(
		<TagView
			size="normal"
			tag={{ id: 1, title: "Electronic", color: "#c2c5c5" }}
		/>,
	);

	assert.equal(
		markup,
		'<a href="/tags/1" aria-label="Explore Electronic" class="tag" style="background-color:#c2c5c5">Electronic</a>',
	);
});

test("adds the large class while preserving the title and color", () => {
	const markup = renderToStaticMarkup(
		<TagView
			size="large"
			tag={{ id: 1, title: "Electronic", color: "#c2c5c5" }}
		/>,
	);
	assert.equal(
		markup,
		'<a href="/tags/1" aria-label="Explore Electronic" class="tag tag-large" style="background-color:#c2c5c5">Electronic</a>',
	);
});
