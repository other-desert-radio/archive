import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ShowCard from "../src/components/shows/ShowCard";
import { formatDate } from "../src/utils/format-date";

test("formats a show date in UTC", () => {
	assert.equal(formatDate("2026-05-25T00:00:00.000Z"), "May 25, 2026");
});

test("renders normalized detail links, large show artwork, and small DJ artwork", () => {
	const markup = renderToStaticMarkup(
		<ShowCard
			base="/archive-site/"
			show={{
				id: 1,
				title: "Test Show",
				date: "2026-05-25T00:00:00.000Z",
				duration: 3600,
				image_small: "https://cdn.example.com/show-small.jpg",
				image_large: "images/shows/1_large.jpg",
				djs: [
					{
						id: 2,
						title: "Test DJ",
						image_small: "images/djs/2.jpg",
						image_large: "images/djs/2_large.jpg",
					},
				],
				tagIds: [],
				url: "https://www.mixcloud.com/example/test-show/",
			}}
			tags={new Map()}
		/>,
	);

	assert.match(markup, /href="\/archive-site\/shows\/1"/);
	assert.match(markup, /href="\/archive-site\/djs\/2"/);
	assert.match(
		markup,
		/<img[^>]+src="images\/shows\/1_large.jpg"[^>]+alt="Test Show"/,
	);
	assert.match(
		markup,
		/<img[^>]+src="\/archive-site\/images\/djs\/2.jpg"[^>]+alt="Test DJ"/,
	);
	const artwork = (markup.match(/<img\b[^>]*>/g) ?? []).filter(
		(image) => !image.includes('alt=""'),
	);
	assert.equal(artwork.length, 2);
	for (const image of artwork) {
		assert.match(image, /loading="lazy"/);
		assert.match(image, /decoding="async"/);
	}
	assert.doesNotMatch(markup, /show-small\.jpg|2_large\.jpg/);
	assert.doesNotMatch(markup, /\/archive-site\/\//);
});
