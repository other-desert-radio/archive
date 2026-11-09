import assert from "node:assert/strict";
import { test } from "node:test";
import { resolvePlaylistShows } from "../src/pages/playlists/usePlaylistShows";
import fixture from "./res/shows.json";

test("resolves newest entries first, joins playback, and preserves unavailable shows and notes", () => {
	const show = fixture.data[0];
	assert.ok(show);
	const entries = Object.freeze([
		Object.freeze({
			showId: show.id,
			addedAt: "2026-11-01T00:00:00Z",
			updatedAt: "2026-11-01T00:00:00Z",
			note: "Keep this",
		}),
		Object.freeze({
			showId: -1,
			addedAt: "2026-11-02T00:00:00Z",
			updatedAt: "2026-11-02T00:00:00Z",
		}),
	]);
	const record = {
		showId: show.id,
		positionInSeconds: 42,
		inProgress: true,
		history: [],
	};
	const result = resolvePlaylistShows({
		entries,
		showStore: { get: (id) => (id === show.id ? show : undefined) },
		records: [record],
	});
	assert.deepEqual(
		result.map(({ entry }) => entry.showId),
		[-1, show.id],
	);
	assert.equal(result[0]?.show, undefined);
	assert.equal(result[0]?.record, undefined);
	assert.equal(result[1]?.show, show);
	assert.equal(result[1]?.record, record);
	assert.equal(result[1]?.entry.note, "Keep this");
	assert.equal(entries[0]?.showId, show.id);
});

test("an empty playlist needs no catalog lookups", () => {
	assert.deepEqual(
		resolvePlaylistShows({
			entries: [],
			records: [],
			showStore: {
				get: () => {
					throw new Error("Unexpected lookup");
				},
			},
		}),
		[],
	);
});
