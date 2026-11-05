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
	const write = mock.method(
		objectStore,
		"set",
		async (_playlist: Playlist) => {},
	);
	const remove = mock.method(
		objectStore,
		"delete",
		async (_playlistId: string) => {},
	);
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
		write,
		remove,
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

test("create initializes storage, trims titles, and returns the frozen committed playlist", async () => {
	const { store, read, write } = setup();
	const created = await store.create({ title: "  Favorites  " });
	assert.equal(read.mock.callCount(), 1);
	assert.match(
		created.id,
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
	);
	assert.equal(created.title, "Favorites");
	assert.equal(new Date(created.createdAt).toISOString(), created.createdAt);
	assert.equal(created.createdAt, created.updatedAt);
	assert.deepEqual(created.shows, []);
	assert.equal(write.mock.calls[0]?.arguments[0], created);
	assert.equal(store.get({ playlistId: created.id }), created);
	assert.ok(Object.isFrozen(created));
	assert.ok(Object.isFrozen(created.shows));
	assert.equal(store.getAll().length, 2);
});

test("lifecycle edits publish only after storage commits and preserve old snapshots", async () => {
	const { store, write, remove } = setup();
	await store.initialize();
	const before = store.getSnapshot();
	const commit = Promise.withResolvers<void>();
	const started = Promise.withResolvers<void>();
	write.mock.mockImplementationOnce(async () => {
		started.resolve();
		await commit.promise;
	});
	const listener = mock.fn();
	store.subscribe({ listener });
	const renaming = store.rename({
		playlistId: "playlist-a",
		title: "  Renamed  ",
	});
	await started.promise;
	assert.equal(store.getSnapshot(), before);
	assert.equal(listener.mock.callCount(), 0);
	commit.resolve();
	await renaming;
	const updated = store.get({ playlistId: "playlist-a" });
	assert.ok(updated);
	assert.equal(updated.title, "Renamed");
	assert.equal(updated.createdAt, playlist().createdAt);
	assert.deepEqual(updated.shows, playlist().shows);
	assert.equal(new Date(updated.updatedAt).toISOString(), updated.updatedAt);
	assert.deepEqual(before, [playlist()]);
	assert.equal(listener.mock.callCount(), 1);
	const deletion = Promise.withResolvers<void>();
	const deleting = Promise.withResolvers<void>();
	remove.mock.mockImplementationOnce(async () => {
		deleting.resolve();
		await deletion.promise;
	});
	const pending = store.delete({ playlistId: "playlist-a" });
	await deleting.promise;
	assert.equal(store.get({ playlistId: "playlist-a" }), updated);
	deletion.resolve();
	await pending;
	assert.equal(store.get({ playlistId: "playlist-a" }), undefined);
	assert.deepEqual(store.getAll(), []);
	assert.equal(listener.mock.callCount(), 2);
});

test("invalid lifecycle edits reject and unchanged titles do not save or notify", async () => {
	const { store, write, remove } = setup();
	await store.initialize();
	const before = store.getSnapshot();
	const listener = mock.fn();
	store.subscribe({ listener });
	await assert.rejects(store.create({ title: " \n " }), /blank/);
	await assert.rejects(
		store.rename({ playlistId: "playlist-a", title: " " }),
		/blank/,
	);
	await assert.rejects(
		store.rename({ playlistId: "missing", title: "Title" }),
		/not found/,
	);
	await assert.rejects(store.delete({ playlistId: "missing" }), /not found/);
	await store.rename({ playlistId: "playlist-a", title: " Favorites " });
	assert.equal(store.getSnapshot(), before);
	assert.equal(write.mock.callCount(), 0);
	assert.equal(remove.mock.callCount(), 0);
	assert.equal(listener.mock.callCount(), 0);
});

test("failed creates, renames and deletes preserve memory and allow later operations", async () => {
	const { store, write, remove } = setup();
	await store.initialize();
	const before = store.getSnapshot();
	const listener = mock.fn();
	store.subscribe({ listener });
	write.mock.mockImplementationOnce(async () => {
		throw new Error("Save failed");
	});
	await assert.rejects(store.create({ title: "New" }), /Save failed/);
	write.mock.mockImplementationOnce(async () => {
		throw new Error("Save failed");
	});
	await assert.rejects(
		store.rename({ playlistId: "playlist-a", title: "Changed" }),
		/Save failed/,
	);
	remove.mock.mockImplementationOnce(async () => {
		throw new Error("Delete failed");
	});
	await assert.rejects(
		store.delete({ playlistId: "playlist-a" }),
		/Delete failed/,
	);
	assert.equal(store.getSnapshot(), before);
	assert.equal(listener.mock.callCount(), 0);
	await store.rename({ playlistId: "playlist-a", title: "Recovered" });
	assert.equal(store.get({ playlistId: "playlist-a" })?.title, "Recovered");
});

test("queued edits await initialization and execute against the latest committed state", async () => {
	const { store, read, write, remove } = setup();
	const loading = Promise.withResolvers<Playlist[]>();
	read.mock.mockImplementationOnce(() => loading.promise);
	const first = store.rename({ playlistId: "playlist-a", title: "First" });
	const second = store.rename({ playlistId: "playlist-a", title: "Second" });
	const third = store.delete({ playlistId: "playlist-a" });
	assert.equal(write.mock.callCount(), 0);
	const commit = Promise.withResolvers<void>();
	const started = Promise.withResolvers<void>();
	write.mock.mockImplementationOnce(async () => {
		started.resolve();
		await commit.promise;
	});
	loading.resolve([playlist()]);
	await started.promise;
	assert.equal(write.mock.callCount(), 1);
	assert.equal(remove.mock.callCount(), 0);
	commit.resolve();
	await Promise.all([first, second, third]);
	assert.deepEqual(
		write.mock.calls.map((call) => call.arguments[0]?.title),
		["First", "Second"],
	);
	assert.equal(remove.mock.callCount(), 1);
	assert.equal(store.get({ playlistId: "playlist-a" }), undefined);
});

test("mutation initialization failure rejects and a later mutation retries loading", async () => {
	const { store, read, write } = setup();
	read.mock.mockImplementationOnce(async () => {
		throw new Error("Read failed");
	});
	await assert.rejects(store.create({ title: "New" }), /Read failed/);
	assert.equal(write.mock.callCount(), 0);
	await store.create({ title: "New" });
	assert.equal(read.mock.callCount(), 2);
	assert.equal(store.getAll().length, 2);
});
