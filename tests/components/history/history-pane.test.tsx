import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import HistoryPane, {
	recentlyPlayed,
} from "../../../src/components/history/HistoryPane";
import { createStores, StoresProvider } from "../../../src/stores";
import type { PlaybackRecord } from "../../../src/stores/playback/types";

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
