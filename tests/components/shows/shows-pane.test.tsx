import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ShowsPane from "../../../src/components/shows/ShowsPane";
import { getPlaylistSavesByShowId } from "../../../src/components/shows/utils/getPlaylistSavesByShowId";
import fixture from "../../res/shows.json";
import tags from "../../res/tags.json";

test("playlist lookup groups compact saves by show, preserving playlist order without passing notes", () => {
	const timestamps = {
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-01T00:00:00Z",
	};
	const entry = {
		addedAt: timestamps.createdAt,
		updatedAt: timestamps.updatedAt,
	};
	const saves = getPlaylistSavesByShowId([
		{
			...timestamps,
			id: "liked",
			title: "Liked Shows",
			type: "liked",
			shows: [{ ...entry, showId: 1 }],
		},
		{
			...timestamps,
			id: "custom",
			title: "Favorites",
			type: "user",
			shows: [
				{ ...entry, showId: 1, note: "First line\nSecond line" },
				{ ...entry, showId: 2, note: "Another show" },
			],
		},
	]);
	assert.deepEqual(saves.get(1), [
		{ playlistId: "liked", title: "Liked Shows" },
		{
			playlistId: "custom",
			title: "Favorites",
		},
	]);
	assert.deepEqual(saves.get(2), [
		{ playlistId: "custom", title: "Favorites" },
	]);
	assert.equal(saves.has(3), false);
	assert.equal(getPlaylistSavesByShowId([]).size, 0);
});

test("empty listings show an empty message without a loading status", () => {
	const html = renderToStaticMarkup(
		<ShowsPane
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
			shows={fixture.data}
			showIds={fixture.data.map((show) => show.id)}
			tags={new Map(tags.data.map((tag) => [tag.id, tag]))}
		/>,
	);
	assert.equal((html.match(/<article\b/g) ?? []).length, fixture.data.length);
	assert.ok(!html.includes("Loading shows..."));
	assert.ok(!html.includes("sentinel"));
});
