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
		type: "user",
		title: "Favorites",
		createdAt,
		updatedAt: createdAt,
		shows: [
			{
				showId: 42,
				addedAt: createdAt,
				updatedAt: createdAt,
				note: "Listen again",
			},
		],
	};
}

function likedPlaylist(): Playlist {
	return {
		...playlist({ playlistId: "liked-id" }),
		type: "liked",
		title: "Liked Shows",
		shows: [],
	};
}

function setup() {
	const database = createIndexedDB();
	const objectStore = database.getObjectStore("playlists");
	const records = [playlist(), likedPlaylist()];
	const ensure = mock.method(
		database,
		"ensureLikedPlaylist",
		async ({ fallback }: { fallback: Playlist & { type: "liked" } }) => {
			if (!records.some((item) => item.type === "liked")) {
				records.push(fallback);
			}
		},
	);
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
		ensure,
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
		assert.deepEqual(store.getSnapshot(), [playlist(), likedPlaylist()]);
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
	assert.throws(() => Array.prototype.pop.call(loaded.shows), TypeError);
	assert.ok(records[0]);
	records[0] = { ...records[0], shows: [] };
	assert.deepEqual(store.get({ playlistId: "playlist-a" }), playlist());
	assert.deepEqual(store.getAll(), [playlist(), likedPlaylist()]);
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
		likedPlaylist(),
		playlist({ playlistId: "b" }),
		playlist({ playlistId: "a" }),
	);
	await store.initialize();
	assert.deepEqual(
		store.getAll().map((item) => item.id),
		["c", "liked-id", "b", "a"],
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
	assert.deepEqual(store.getAll(), [playlist(), likedPlaylist()]);
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
	assert.equal(created.type, "user");
	assert.equal(new Date(created.createdAt).toISOString(), created.createdAt);
	assert.equal(created.createdAt, created.updatedAt);
	assert.deepEqual(created.shows, []);
	assert.equal(write.mock.calls[0]?.arguments[0], created);
	assert.equal(store.get({ playlistId: created.id }), created);
	assert.ok(Object.isFrozen(created));
	assert.ok(Object.isFrozen(created.shows));
	assert.equal(store.getAll().length, 3);
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
	assert.deepEqual(before, [playlist(), likedPlaylist()]);
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
	assert.deepEqual(store.getAll(), [likedPlaylist()]);
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
	loading.resolve([playlist(), likedPlaylist()]);
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
	assert.equal(store.getAll().length, 3);
});

test("entry edits retain insertion order and timestamps without needing a catalog", async () => {
	const { store, write } = setup();
	await store.addShow({ playlistId: "playlist-a", showId: 99 });
	const added = store.get({ playlistId: "playlist-a" });
	assert.ok(added);
	assert.deepEqual(
		added.shows.map((entry) => entry.showId),
		[42, 99],
	);
	const newEntry = added.shows[1];
	assert.ok(newEntry);
	assert.equal(new Date(newEntry.addedAt).toISOString(), newEntry.addedAt);
	assert.equal(newEntry.updatedAt, newEntry.addedAt);
	assert.equal(added.createdAt, playlist().createdAt);
	assert.deepEqual(added.shows[0], playlist().shows[0]);
	await store.setNote({
		playlistId: "playlist-a",
		showId: 99,
		note: "  Keep whitespace\n ",
	});
	const noted = store.get({ playlistId: "playlist-a" });
	assert.ok(noted);
	assert.equal(noted.shows[1]?.note, "  Keep whitespace\n ");
	assert.equal(noted.shows[1]?.addedAt, newEntry.addedAt);
	assert.equal(new Date(noted.updatedAt).toISOString(), noted.updatedAt);
	assert.equal(added.shows[1]?.note, undefined);
	await store.setNote({
		playlistId: "playlist-a",
		showId: 99,
		note: undefined,
	});
	const cleared = store.get({ playlistId: "playlist-a" });
	assert.ok(cleared?.shows[1]);
	assert.equal(Object.hasOwn(cleared.shows[1], "note"), false);
	await store.removeShow({ playlistId: "playlist-a", showId: 42 });
	const remaining = store.get({ playlistId: "playlist-a" });
	assert.deepEqual(
		remaining?.shows.map((entry) => entry.showId),
		[99],
	);
	assert.equal(remaining?.shows[0]?.addedAt, newEntry.addedAt);
	assert.equal(write.mock.callCount(), 4);
	assert.equal(write.mock.calls[3]?.arguments[0], remaining);
});

test("duplicate, invalid and missing entries reject without saving or notifying", async () => {
	const { store, write } = setup();
	await store.initialize();
	const snapshot = store.getSnapshot();
	const listener = mock.fn();
	store.subscribe({ listener });
	await assert.rejects(
		store.addShow({ playlistId: "playlist-a", showId: 42 }),
		/already in playlist/,
	);
	for (const showId of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
		await assert.rejects(
			store.addShow({ playlistId: "playlist-a", showId }),
			/Invalid show ID/,
		);
	}
	await assert.rejects(
		store.addShow({ playlistId: "missing", showId: 99 }),
		/Playlist not found/,
	);
	await assert.rejects(
		store.removeShow({ playlistId: "missing", showId: 99 }),
		/Playlist not found/,
	);
	await assert.rejects(
		store.setNote({ playlistId: "missing", showId: 99, note: "x" }),
		/Playlist not found/,
	);
	await assert.rejects(
		store.removeShow({ playlistId: "playlist-a", showId: 99 }),
		/Show not in playlist/,
	);
	await assert.rejects(
		store.setNote({ playlistId: "playlist-a", showId: 99, note: "x" }),
		/Show not in playlist/,
	);
	await store.setNote({
		playlistId: "playlist-a",
		showId: 42,
		note: "Listen again",
	});
	assert.equal(store.getSnapshot(), snapshot);
	assert.equal(write.mock.callCount(), 0);
	assert.equal(listener.mock.callCount(), 0);
});

test("concurrent entry edits publish after commit and retain earlier edits", async () => {
	const { store, write } = setup();
	await store.initialize();
	const snapshot = store.getSnapshot();
	const listener = mock.fn();
	store.subscribe({ listener });
	const commit = Promise.withResolvers<void>();
	const started = Promise.withResolvers<void>();
	write.mock.mockImplementationOnce(async () => {
		started.resolve();
		await commit.promise;
	});
	const adding = store.addShow({ playlistId: "playlist-a", showId: 99 });
	const noting = store.setNote({
		playlistId: "playlist-a",
		showId: 99,
		note: "New note",
	});
	const removing = store.removeShow({ playlistId: "playlist-a", showId: 42 });
	await started.promise;
	assert.equal(write.mock.callCount(), 1);
	assert.equal(store.getSnapshot(), snapshot);
	assert.equal(listener.mock.callCount(), 0);
	commit.resolve();
	await Promise.all([adding, noting, removing]);
	const final = store.get({ playlistId: "playlist-a" });
	assert.equal(final?.shows.length, 1);
	assert.equal(final?.shows[0]?.showId, 99);
	assert.equal(final?.shows[0]?.note, "New note");
	assert.deepEqual(snapshot, [playlist(), likedPlaylist()]);
	assert.equal(listener.mock.callCount(), 3);
	assert.ok(Object.isFrozen(final?.shows[0]));
});

test("failed entry saves preserve snapshots and the queue recovers", async () => {
	const { store, write } = setup();
	await store.initialize();
	const snapshot = store.getSnapshot();
	const listener = mock.fn();
	store.subscribe({ listener });
	write.mock.mockImplementationOnce(async () => {
		throw new Error("Save failed");
	});
	await assert.rejects(
		store.addShow({ playlistId: "playlist-a", showId: 99 }),
		/Save failed/,
	);
	write.mock.mockImplementationOnce(async () => {
		throw new Error("Save failed");
	});
	await assert.rejects(
		store.removeShow({ playlistId: "playlist-a", showId: 42 }),
		/Save failed/,
	);
	write.mock.mockImplementationOnce(async () => {
		throw new Error("Save failed");
	});
	await assert.rejects(
		store.setNote({ playlistId: "playlist-a", showId: 42, note: undefined }),
		/Save failed/,
	);
	assert.equal(store.getSnapshot(), snapshot);
	assert.equal(listener.mock.callCount(), 0);
	await store.addShow({ playlistId: "playlist-a", showId: 0 });
	assert.equal(store.get({ playlistId: "playlist-a" })?.shows[1]?.showId, 0);
});

test("initialization creates a UUID default before reading and publishes only after commit", async () => {
	const { store, records, ensure, read } = setup();
	records.length = 0;
	const commit = Promise.withResolvers<void>();
	const started = Promise.withResolvers<void>();
	ensure.mock.mockImplementationOnce(async ({ fallback }) => {
		started.resolve();
		await commit.promise;
		records.push(fallback);
	});
	const listener = mock.fn();
	store.subscribe({ listener });
	const loading = store.initialize();
	assert.equal(store.initialize(), loading);
	await started.promise;
	assert.equal(read.mock.callCount(), 0);
	assert.equal(listener.mock.callCount(), 0);
	assert.deepEqual(store.getAll(), []);
	commit.resolve();
	await loading;
	assert.equal(ensure.mock.callCount(), 1);
	assert.equal(listener.mock.callCount(), 1);
	const liked = store.getAll()[0];
	assert.ok(liked);
	assert.match(
		liked.id,
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
	);
	assert.equal(liked.type, "liked");
	assert.equal(liked.title, "Liked Shows");
	assert.deepEqual(liked.shows, []);
	assert.equal(new Date(liked.createdAt).toISOString(), liked.createdAt);
	assert.equal(liked.updatedAt, liked.createdAt);
	await store.initialize();
	assert.equal(ensure.mock.callCount(), 1);
});

test("failed default creation leaves initialization unpublished and can retry", async () => {
	const { store, records, ensure, read } = setup();
	records.length = 0;
	ensure.mock.mockImplementationOnce(async () => {
		throw new Error("Storage full");
	});
	const listener = mock.fn();
	store.subscribe({ listener });
	const snapshot = store.getSnapshot();
	await assert.rejects(store.initialize(), /Storage full/);
	assert.equal(store.getSnapshot(), snapshot);
	assert.equal(read.mock.callCount(), 0);
	assert.equal(listener.mock.callCount(), 0);
	await store.initialize();
	assert.equal(ensure.mock.callCount(), 2);
	assert.equal(store.getAll().length, 1);
	assert.equal(store.getAll()[0]?.type, "liked");
});

test("liked playlists cannot be renamed or deleted and rejection does not block later edits", async () => {
	const { store, write, remove } = setup();
	await store.initialize();
	const snapshot = store.getSnapshot();
	await assert.rejects(
		store.rename({ playlistId: "liked-id", title: "New name" }),
		/cannot be renamed/,
	);
	await assert.rejects(
		store.delete({ playlistId: "liked-id" }),
		/cannot be deleted/,
	);
	assert.equal(store.getSnapshot(), snapshot);
	assert.equal(write.mock.callCount(), 0);
	assert.equal(remove.mock.callCount(), 0);
	await store.addShow({ playlistId: "liked-id", showId: 99 });
	await store.setNote({ playlistId: "liked-id", showId: 99, note: "Favorite" });
	assert.equal(
		store.get({ playlistId: "liked-id" })?.shows[0]?.note,
		"Favorite",
	);
	await store.removeShow({ playlistId: "liked-id", showId: 99 });
	assert.deepEqual(store.get({ playlistId: "liked-id" })?.shows, []);
});

test("mutations preserve playlist order for callers to choose presentation", async () => {
	const { store, records } = setup();
	records.push(playlist({ playlistId: "user-b" }));
	await store.initialize();
	assert.deepEqual(store.get({ playlistId: "liked-id" }), likedPlaylist());
	const created = await store.create({ title: "Liked Shows" });
	assert.equal(created.type, "user");
	await store.rename({ playlistId: "playlist-a", title: "Renamed" });
	await store.addShow({ playlistId: "liked-id", showId: 99 });
	assert.deepEqual(
		store.getAll().map((item) => item.id),
		["playlist-a", "liked-id", "user-b", created.id],
	);
	await store.delete({ playlistId: "playlist-a" });
	assert.deepEqual(
		store.getAll().map((item) => item.id),
		["liked-id", "user-b", created.id],
	);
});

test("note changes timestamp the entry, including clearing, while unchanged notes do not write", async () => {
	const { store, write } = setup();
	let now = "2026-11-06T12:00:00.000Z";
	const clock = mock.method(Date.prototype, "toISOString", () => now);
	try {
		await store.setNote({
			playlistId: "playlist-a",
			showId: 42,
			note: "Changed",
		});
		const changed = store.get({ playlistId: "playlist-a" })?.shows[0];
		assert.equal(changed?.updatedAt, now);
		assert.equal(changed?.addedAt, playlist().shows[0]?.addedAt);
		assert.equal(write.mock.calls[0]?.arguments[0]?.shows[0]?.updatedAt, now);
		now = "2026-11-07T12:00:00.000Z";
		await store.setNote({
			playlistId: "playlist-a",
			showId: 42,
			note: "Changed",
		});
		assert.equal(store.get({ playlistId: "playlist-a" })?.shows[0], changed);
		assert.equal(write.mock.callCount(), 1);
		await store.setNote({
			playlistId: "playlist-a",
			showId: 42,
			note: undefined,
		});
		assert.equal(
			store.get({ playlistId: "playlist-a" })?.shows[0]?.updatedAt,
			now,
		);
		assert.equal(
			store.get({ playlistId: "playlist-a" })?.shows[0]?.note,
			undefined,
		);
		assert.equal(changed?.updatedAt, "2026-11-06T12:00:00.000Z");
	} finally {
		clock.mock.restore();
	}
});
