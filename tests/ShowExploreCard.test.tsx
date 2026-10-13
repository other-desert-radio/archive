import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ShowExploreCard from "../src/components/explore/ShowExploreCard";

test("links large show artwork to the show detail page with an accessible label", () => {
	const markup = renderToStaticMarkup(
		<ShowExploreCard
			base="/archive-site/"
			show={{
				id: 1,
				title: "Test Show",
				date: "2026-05-25",
				duration: 3600,
				image_small: "https://cdn.example.com/small.jpg",
				image_large: "https://cdn.example.com/large.jpg",
				djs: [],
				tagIds: [],
				url: "https://www.mixcloud.com/example/test-show/",
			}}
		/>,
	);
	assert.ok(markup.includes('src="https://cdn.example.com/large.jpg"'));
	assert.ok(markup.includes('alt="Test Show"'));
	assert.ok(markup.includes('href="/archive-site/shows/1"'));
	assert.ok(markup.includes('aria-label="View Test Show"'));
});
