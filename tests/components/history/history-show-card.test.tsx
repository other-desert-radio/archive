import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import HistoryShowCard from "../../../src/components/history/HistoryShowCard";

test("history card shows playable artwork and title without date, DJs or tags", () => {
	const html = renderToStaticMarkup(
		<HistoryShowCard
			show={{
				id: 1,
				title: "Recent Show",
				url: "https://www.mixcloud.com/dj/show/",
				date: "2026-09-07T00:00:00.000Z",
				duration: 60,
				image_small: "small.jpg",
				image_large: "large.jpg",
				djs: [{ id: 2, title: "Hidden DJ" }],
				tagIds: [3],
			}}
		/>,
	);
	assert.match(html, /href="\/shows\/1"/);
	assert.match(html, /aria-label="Play Recent Show"/);
	assert.match(html, /src="large.jpg"/);
	assert.doesNotMatch(html, /<time|Hidden DJ|\/djs\/|\/tags\//);
});
