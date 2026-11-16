import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SquareShowCard } from "../src/components/shows";

test("links large show artwork to the show detail page with an accessible label", () => {
	const markup = renderToStaticMarkup(
		<SquareShowCard
			mode="details"
			tags={[{ id: 1, title: "Ambient", color: "#ff0000" }]}
			base="/archive/"
			fromTag={7}
			show={{
				id: 1,
				title: "Test Show",
				duration: 3600,
				image_large: "https://cdn.example.com/large.jpg",
			}}
		/>,
	);
	assert.ok(markup.includes('src="https://cdn.example.com/large.jpg"'));
	assert.match(markup, /background-color:#ff0000[^>]*>Ambient/);
	assert.ok(markup.indexOf("Test Show</span>") < markup.indexOf("Ambient"));
	assert.doesNotMatch(markup, /<button|data-show-playback/);
	assert.match(markup, />Test Show<\/span>/);
	assert.match(markup, /loading="lazy"/);
	assert.match(markup, /decoding="async"/);
	assert.ok(markup.includes('alt="Test Show"'));
	assert.ok(markup.includes('href="/archive/shows/1?fromTag=7"'));
	assert.ok(markup.includes('aria-label="View Test Show"'));
});
