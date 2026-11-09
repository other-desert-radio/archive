import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import HistoryPane, {
	historyPlaylists,
	recentlyPlayed,
} from "../../../src/components/history/HistoryPane";
import { createStores, StoresProvider } from "../../../src/stores";
import type { PlaybackRecord } from "../../../src/stores/playback/types";
import type { Playlist } from "../../../src/stores/playlists/types";

test("history puts Liked Shows first without changing user order or the snapshot", () => {
	const playlists: readonly Playlist[] = Object.freeze(
		["user", "liked", "user"].map((type, index) => ({
			id: String(index),
			type: type === "liked" ? "liked" : "user",
			title: "Playlist",
			createdAt: "2026-01-01T00:00:00Z",
			updatedAt: "2026-01-01T00:00:00Z",
			shows: [],
		})),
	);
	assert.deepEqual(
		historyPlaylists(playlists).map(({ id }) => id),
		["1", "0", "2"],
	);
	assert.deepEqual(
		playlists.map(({ id }) => id),
		["0", "1", "2"],
	);
	assert.deepEqual(historyPlaylists([]), []);
	assert.deepEqual(
		historyPlaylists(playlists.slice(1, 2)),
		playlists.slice(1, 2),
	);
});

test("history waits for catalog initialization before looking up shows", () => {
	const stores = createStores();
	const getShow = mock.method(stores.showStore, "get");
	const initialize = mock.method(stores, "initialize");
	const html = renderToStaticMarkup(
		<StoresProvider stores={stores}>
			<HistoryPane />
		</StoresProvider>,
	);
	assert.ok(html.includes('role="status"'));
	assert.ok(html.includes("Loading shows..."));
	assert.ok(html.includes("Loading playlists..."));
	assert.ok(!html.includes("missing show id"));
	assert.equal(getShow.mock.callCount(), 0);
	assert.equal(initialize.mock.callCount(), 0);
});

test("recently played includes completed shows, newest first, with at most ten", () => {
	const records: PlaybackRecord[] = [2, 7, 1, 12, 4, 6, 11, 3, 9, 5, 10, 8].map(
		(showId) => ({
			showId,
			inProgress: showId !== 7,
			positionInSeconds: 10,
			history: [
				{
					startedAt: 1,
					updatedAt: showId * 100,
					startPosition: 0,
					endPosition: 10,
				},
			],
		}),
	);
	const originalOrder = records.map((record) => record.showId);
	assert.deepEqual(
		recentlyPlayed(records).map((record) => record.showId),
		[12, 11, 10, 9, 8, 7, 6, 5, 4, 3],
	);
	assert.deepEqual(
		records.map((record) => record.showId),
		originalOrder,
	);
	assert.deepEqual(recentlyPlayed([]), []);
	assert.deepEqual(
		recentlyPlayed([
			{ showId: 8, inProgress: false, positionInSeconds: 0, history: [] },
		]),
		[],
	);
	assert.equal(recentlyPlayed(records.slice(0, 2)).length, 2);
});
