import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ShowCard } from "../src/components/shows";
import { formatDate } from "../src/utils/format-date";
import fixture from "./res/shows.json";

test("saved playlist links follow DJ links and display hearts with titles", () => {
	const show = fixture.data[0];
	assert.ok(show);
	const render = (
		playlistSaves: Parameters<typeof ShowCard>[0]["playlistSaves"],
	) =>
		renderToStaticMarkup(
			<ShowCard
				show={{ ...show, tagIds: [] }}
				tags={new Map()}
				playlistSaves={playlistSaves}
			/>,
		);
	assert.doesNotMatch(render([]), /View playlist/);
	const html = render([
		{ playlistId: "liked", title: "Liked Shows" },
		{ playlistId: "empty", title: "Empty note" },
		{
			playlistId: "custom",
			title: "Favorites",
		},
	]);
	assert.equal((html.match(/aria-label="View playlist /g) ?? []).length, 3);
	assert.match(html, /href="\/playlists\/\?id=custom"/);
	assert.match(html, /<b>Favorites<\/b>/);
	assert.equal((html.match(/aria-hidden="true">♥/g) ?? []).length, 1);
	assert.equal(
		(html.match(/<button[^>]+aria-label="Save to Playlist"/g) ?? []).length,
		1,
	);
	assert.match(html, /<\/a><\/span><span>, <a/g);
	assert.doesNotMatch(html, /<a[^>]*>[^<]*<button/);
	assert.doesNotMatch(html, /saved in|playlist-note/);
	assert.ok(html.lastIndexOf("View Test DJ") < html.indexOf("View playlist"));
});

test("formats a show date in UTC", () => {
	assert.equal(formatDate("2026-05-25T00:00:00.000Z"), "May 25, 2026");
});

test("renders default-base detail links, large show artwork, and small DJ artwork", () => {
	const markup = renderToStaticMarkup(
		<ShowCard
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
			playlistSaves={[]}
		/>,
	);

	assert.match(markup, /href="\/shows\/1"/);
	assert.match(markup, /href="\/djs\/2"/);
	assert.match(
		markup,
		/<img[^>]+src="images\/shows\/1_large.jpg"[^>]+alt="Test Show"/,
	);
	assert.match(markup, /<img[^>]+src="\/images\/djs\/2.jpg"[^>]+alt="Test DJ"/);
	const artwork = (markup.match(/<img\b[^>]*>/g) ?? []).filter(
		(image) => !image.includes('alt=""'),
	);
	assert.equal(artwork.length, 2);
	for (const image of artwork) {
		assert.match(image, /loading="lazy"/);
		assert.match(image, /decoding="async"/);
	}
	assert.doesNotMatch(markup, /show-small\.jpg|2_large\.jpg/);
	assert.doesNotMatch(markup, /(?:href|src)="\/\//);
});
