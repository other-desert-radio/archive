import { spyOn } from "bun:test";
import assert from "node:assert/strict";
import { test } from "node:test";
import { saveShowToPlaylists } from "../src/components/playlists/save-show-to-playlists";
import { createIndexedDB } from "../src/database/indexed-db";
import { PlaylistStore } from "../src/stores/playlists/playlist-store";
import type { Playlist } from "../src/stores/playlists/types";

function setup() {
	const database = createIndexedDB();
	const objectStore = database.getObjectStore("playlists");
	const records: Playlist[] = ["a", "b", "c"].map((id) => ({
		id,
		type: "user",
		title: id,
		createdAt: "2026-11-05T00:00:00.000Z",
		updatedAt: "2026-11-05T00:00:00.000Z",
		shows:
			id === "b"
				? []
				: [
						{
							showId: 42,
							addedAt: "2026-11-05T00:00:00.000Z",
							updatedAt: "2026-11-05T00:00:00.000Z",
							note: `note ${id}`,
						},
					],
	}));
	spyOn(database, "ensureLikedPlaylist").mockImplementation(async () => {});
	spyOn(objectStore, "getAll").mockImplementation(async () => records);
	const write = spyOn(objectStore, "set").mockImplementation(
		async (_playlist: Playlist) => {},
	);
	spyOn(database, "getObjectStore").mockImplementation(() => objectStore);
	return { store: new PlaylistStore({ database }), write };
}

test("save adds and removes membership while preserving untouched notes and other shows", async () => {
	const { store } = setup();
	await store.addShow({ playlistId: "a", showId: 99 });
	await saveShowToPlaylists({
		playlistStore: store,
		showId: 42,
		playlistIds: ["a", "b"],
		note: undefined,
	});
	assert.equal(store.get({ playlistId: "a" })?.shows[0]?.note, "note a");
	assert.ok(
		store.get({ playlistId: "a" })?.shows.some((entry) => entry.showId === 99),
	);
	assert.equal(store.get({ playlistId: "b" })?.shows[0]?.showId, 42);
	assert.deepEqual(store.get({ playlistId: "c" })?.shows, []);
});

test("edited notes apply to all selected playlists and empty text clears them", async () => {
	const { store } = setup();
	for (const note of ["shared note", ""]) {
		await saveShowToPlaylists({
			playlistStore: store,
			showId: 42,
			playlistIds: ["a", "b"],
			note,
		});
		for (const playlistId of ["a", "b"]) {
			assert.equal(
				store.get({ playlistId })?.shows[0]?.note,
				note || undefined,
			);
		}
	}
});

test("a partial failure rejects and retry finishes without duplicating entries", async () => {
	const { store, write } = setup();
	write.mockResolvedValueOnce(undefined).mockImplementationOnce(async () => {
		throw new Error("disk full");
	});
	const args = {
		playlistStore: store,
		showId: 42,
		playlistIds: ["a", "b"],
		note: "new note",
	};
	await assert.rejects(saveShowToPlaylists(args), /disk full/);
	assert.equal(write.mock.calls.length, 2);
	assert.equal(store.get({ playlistId: "a" })?.shows[0]?.note, "new note");
	assert.deepEqual(store.get({ playlistId: "b" })?.shows, []);
	await saveShowToPlaylists(args);
	assert.equal(store.get({ playlistId: "b" })?.shows.length, 1);
	assert.equal(store.get({ playlistId: "a" })?.shows[0]?.note, "new note");
	assert.deepEqual(store.get({ playlistId: "c" })?.shows, []);
});

test("saving an edited note timestamps the existing show in the persisted playlist", async () => {
	const { store, write } = setup();
	await store.initialize();
	const before = store.get({ playlistId: "a" })?.shows[0];
	assert.ok(before);
	const now = "2026-11-06T12:00:00.000Z";
	const clock = spyOn(Date.prototype, "toISOString").mockImplementation(
		() => now,
	);
	try {
		await saveShowToPlaylists({
			playlistStore: store,
			showId: 42,
			playlistIds: ["a", "c"],
			note: "Edited after saving",
		});
		for (const playlistId of ["a", "c"]) {
			const persisted = write.mock.calls
				.map((call) => call[0])
				.find((playlist) => playlist?.id === playlistId);
			const entry = persisted?.shows.find((entry) => entry.showId === 42);
			assert.equal(entry?.note, "Edited after saving");
			assert.equal(entry?.updatedAt, now);
			assert.notEqual(entry?.updatedAt, before.updatedAt);
			assert.equal(entry?.addedAt, before.addedAt);
			assert.equal(persisted?.updatedAt, now);
			assert.deepEqual(store.get({ playlistId }), persisted);
		}
		assert.equal(before.note, "note a");
	} finally {
		clock.mockRestore();
	}
});
