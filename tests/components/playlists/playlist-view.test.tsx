import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import PlaylistView from "../../../src/components/playlists/PlaylistView";
import {
	createStores,
	type Playlist,
	StoresProvider,
} from "../../../src/stores";
import type { Show } from "../../../src/utils/fetch-shows";

const shows: Show[] = [1, 2, 3, 4, 5].map((id) => ({
	id,
	title: `Show ${id}`,
	date: "2026-01-01",
	duration: 60,
	image_small: `/small-${id}.jpg`,
	image_large: `/large-${id}.jpg`,
	djs: [],
	tagIds: [],
	url: `https://www.mixcloud.com/test/show-${id}/`,
}));
const playlist: Playlist = {
	id: "test",
	type: "user",
	title: "My playlist",
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: "2026-01-06T00:00:00Z",
	shows: [2, 5, 1, 6, 3, 4].map((showId) => ({
		showId,
		addedAt: `2026-01-0${showId}T00:00:00Z`,
		updatedAt: "2026-02-01T00:00:00Z",
	})),
};

function render(availableShows: readonly Show[]) {
	return renderToStaticMarkup(
		<StoresProvider stores={createStores()}>
			<PlaylistView playlist={playlist} shows={availableShows} />
		</StoresProvider>,
	);
}

test("playlist artwork shows the four newest available entries without mutating the playlist", () => {
	const original = [...playlist.shows];
	const html = render(shows);
	assert.deepEqual(
		[...html.matchAll(/src="\/large-(\d).jpg"/g)].map((match) =>
			Number(match[1]),
		),
		[5, 4, 3, 2],
	);
	assert.equal((html.match(/aria-label="Play Show /g) ?? []).length, 4);
	assert.ok(html.includes("View playlist My playlist"));
	assert.deepEqual(playlist.shows, original);
});

test("empty or partially available artwork keeps the playlist link", () => {
	assert.ok(render([]).includes("View playlist My playlist"));
	assert.equal((render([]).match(/aria-hidden="true"/g) ?? []).length, 4);
	assert.equal(
		(render(shows.slice(0, 1)).match(/<div[^>]*aria-hidden="true"/g) ?? [])
			.length,
		3,
	);
	assert.equal(
		(render(shows.slice(0, 1)).match(/aria-label="Play Show /g) ?? []).length,
		1,
	);
});
