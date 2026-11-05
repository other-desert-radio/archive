import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createIndexedDB } from "../../../src/database/indexed-db";
import { PlaylistStore } from "../../../src/stores/playlists/playlist-store";
import type { Playlist } from "../../../src/stores/playlists/types";

function playlist({
	playlistId = "playlist-a",
	createdAt = "2026-11-05T12:00:00.000Z",
}: {
	playlistId?: string;
	createdAt?: string;
} = {}): Playlist {
	return {
		id: playlistId,
		title: "Favorites",
		createdAt,
		updatedAt: createdAt,
		shows: [{ showId: 42, addedAt: createdAt, note: "Listen again" }],
	};
}

function setup() {
	const database = createIndexedDB();
	const objectStore = database.getObjectStore("playlists");
	const records = [playlist()];
	const read = mock.method(objectStore, "getAll", async () => records);
	const getObjectStore = mock.method(
		database,
		"getObjectStore",
		() => objectStore,
	);
	return {
		store: new PlaylistStore({ database }),
		read,
		records,
		getObjectStore,
	};
}

test("construction is SSR safe and reads are empty before initialization", () => {
	const store = new PlaylistStore({ database: createIndexedDB() });
	assert.equal(store.get({ playlistId: "missing" }), undefined);
	assert.deepEqual(store.getAll(), []);
	assert.deepEqual(store.getSnapshot(), []);
	assert.equal(store.getSnapshot(), store.getSnapshot());
});

test("initialization shares one read and publishes a stable snapshot before notification", async () => {
	const { store, read, getObjectStore } = setup();
	assert.deepEqual(getObjectStore.mock.calls[0]?.arguments, ["playlists"]);
	const empty = store.getSnapshot();
	const listener = mock.fn(() => {
		assert.deepEqual(store.getSnapshot(), [playlist()]);
	});
	store.subscribe({ listener });
	const loading = store.initialize();
	assert.equal(loading, store.initialize());
	await loading;
	assert.equal(read.mock.callCount(), 1);
	assert.equal(listener.mock.callCount(), 1);
	assert.notEqual(store.getSnapshot(), empty);
	const loaded = store.getSnapshot();
	await store.initialize();
	assert.equal(store.getSnapshot(), loaded);
	assert.equal(read.mock.callCount(), 1);
	assert.equal(listener.mock.callCount(), 1);
});

test("retrieval shares frozen records and isolates storage results", async () => {
	const { store, records } = setup();
	await store.initialize();
	const loaded = store.get({ playlistId: "playlist-a" });
	assert.ok(loaded);
	assert.equal(Reflect.set(loaded, "title", "Changed"), false);
	const entry = loaded.shows[0];
	assert.ok(entry);
	assert.equal(Reflect.set(entry, "note", "Changed"), false);
	const all = store.getAll();
	assert.ok(all[0]);
	assert.equal(all, store.getAll());
	assert.equal(all, store.getSnapshot());
	assert.equal(all[0], loaded);
	assert.equal(store.get({ playlistId: "playlist-a" }), loaded);
	assert.throws(() => Array.prototype.pop.call(all[0].shows), TypeError);
	assert.ok(records[0]);
	records[0] = { ...records[0], shows: [] };
	assert.deepEqual(store.get({ playlistId: "playlist-a" }), playlist());
	assert.deepEqual(store.getAll(), [playlist()]);
	assert.equal(store.get({ playlistId: "missing" }), undefined);
	const snapshot = store.getSnapshot();
	assert.ok(Object.isFrozen(snapshot));
	assert.ok(Object.isFrozen(snapshot[0]));
	assert.ok(Object.isFrozen(snapshot[0]?.shows));
	assert.ok(Object.isFrozen(snapshot[0]?.shows[0]));
});

test("retrieval preserves storage order and unavailable show references", async () => {
	const { store, records } = setup();
	records.splice(
		0,
		records.length,
		playlist({ playlistId: "c", createdAt: "2026-11-06T12:00:00.000Z" }),
		playlist({ playlistId: "b" }),
		playlist({ playlistId: "a" }),
	);
	await store.initialize();
	assert.deepEqual(
		store.getAll().map((item) => item.id),
		["c", "b", "a"],
	);
	assert.equal(store.getSnapshot(), store.getAll());
	assert.equal(store.get({ playlistId: "a" })?.shows[0]?.showId, 42);
});

test("failed initialization can retry and unsubscribed listeners are not notified", async () => {
	const { store, read } = setup();
	read.mock.mockImplementationOnce(async () => {
		throw new Error("Read failed");
	});
	const listener = mock.fn();
	const unsubscribe = store.subscribe({ listener });
	const empty = store.getSnapshot();
	await assert.rejects(store.initialize(), /Read failed/);
	assert.equal(store.getSnapshot(), empty);
	assert.deepEqual(store.getAll(), []);
	assert.equal(listener.mock.callCount(), 0);
	unsubscribe();
	await store.initialize();
	assert.equal(read.mock.callCount(), 2);
	assert.equal(listener.mock.callCount(), 0);
	assert.deepEqual(store.getAll(), [playlist()]);
});
