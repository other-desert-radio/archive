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

test("playlist search preserves matching entries, notes, playback, and newest-first order", () => {
	const template = fixture.data[0];
	assert.ok(template);
	const catalog = new Map([
		[1, { ...template, id: 1, title: "Desert Night" }],
		[2, { ...template, id: 2, title: "Desert Dawn" }],
		[3, { ...template, id: 3, title: "Jazz" }],
	]);
	const entries = Object.freeze(
		[1, 2, 3, -1].map((showId, index) =>
			Object.freeze({
				showId,
				addedAt: `2026-11-0${index + 1}T00:00:00Z`,
				updatedAt: "2026-11-04T00:00:00Z",
				note: "Keep these notes",
			}),
		),
	);
	const record = {
		showId: 2,
		positionInSeconds: 42,
		inProgress: true,
		history: [],
	};
	const input = {
		entries,
		records: [record],
		showStore: { get: (id: number) => catalog.get(id) },
	};
	const matches = resolvePlaylistShows({ ...input, query: "  dEsErT  " });
	assert.deepEqual(
		matches.map(({ entry }) => entry.showId),
		[2, 1],
	);
	assert.equal(matches[0]?.entry, entries[1]);
	assert.equal(matches[0]?.record, record);
	assert.equal(matches[0]?.show, catalog.get(2));
	assert.equal(matches[0]?.entry.note, "Keep these notes");
	assert.deepEqual(resolvePlaylistShows({ ...input, query: "no-match" }), []);
	assert.deepEqual(
		resolvePlaylistShows({ ...input, query: "  " }).map(
			({ entry }) => entry.showId,
		),
		[-1, 3, 2, 1],
	);
	assert.deepEqual(
		entries.map(({ showId }) => showId),
		[1, 2, 3, -1],
	);
});

test("playlist search matches user notes even when the show is unavailable", () => {
	const template = fixture.data[0];
	assert.ok(template);
	const show = { ...template, id: 1, title: "Jazz" };
	const entries = [
		{
			showId: 1,
			addedAt: "2026-11-01T00:00:00Z",
			updatedAt: "2026-11-01T00:00:00Z",
			note: "Road trip favorite",
		},
		{
			showId: -1,
			addedAt: "2026-11-02T00:00:00Z",
			updatedAt: "2026-11-02T00:00:00Z",
			note: "Another road trip",
		},
		{
			showId: -2,
			addedAt: "2026-11-03T00:00:00Z",
			updatedAt: "2026-11-03T00:00:00Z",
		},
	];
	const matches = resolvePlaylistShows({
		entries,
		records: [],
		showStore: { get: (id) => (id === 1 ? show : undefined) },
		query: "  ROAD TRIP  ",
	});
	assert.deepEqual(
		matches.map(({ entry }) => entry.showId),
		[-1, 1],
	);
	assert.equal(matches[0]?.entry, entries[1]);
	assert.equal(matches[1]?.entry, entries[0]);
});
