import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createIndexedDB } from "../../../src/database/indexed-db";
import { PlaybackStore } from "../../../src/stores/playback/playback-store";
import type { PlaybackRecord } from "../../../src/stores/playback/types";

function record(positionInSeconds = 12): PlaybackRecord {
	return { showId: 42, inProgress: true, positionInSeconds, history: [] };
}

function setup() {
	const database = createIndexedDB();
	const objectStore = database.getObjectStore("playback");
	const read = mock.method(objectStore, "getAll", async () => [record()]);
	mock.method(database, "getObjectStore", () => objectStore);
	const write = mock.method(database, "transaction", async () => {});
	return { store: new PlaybackStore(database), read, write };
}

test("construction is SSR safe and reads are empty before initialization", () => {
	const store = new PlaybackStore(createIndexedDB());
	assert.equal(store.get(42), undefined);
	assert.deepEqual(store.getAll(), []);
});

test("initialization shares reads, notifies subscribers, and isolates returned records", async () => {
	const { store, read, write } = setup();
	const notify = mock.fn();
	const unsubscribe = store.subscribe(notify);
	await Promise.all([store.initialize(), store.initialize()]);
	assert.equal(read.mock.callCount(), 1);
	assert.equal(notify.mock.callCount(), 1);
	const loaded = store.get(42);
	assert.ok(loaded);
	loaded.history.push({
		startedAt: 1,
		startPosition: 0,
		endPosition: 12,
		playedSeconds: 12,
	});
	assert.deepEqual(store.get(42), record());
	store.getAll().pop();
	assert.equal(store.getAll().length, 1);
	unsubscribe();
	store.set(record(20));
	assert.equal(notify.mock.callCount(), 1);
	assert.equal(write.mock.callCount(), 0);
});

test("failed initialization can retry without replacing local updates", async () => {
	const { store, read } = setup();
	read.mock.mockImplementationOnce(async () => {
		throw new Error("Read failed");
	});
	await assert.rejects(store.initialize(), /Read failed/);
	store.set(record(20));
	await store.flush();
	await store.initialize();
	assert.equal(store.get(42)?.positionInSeconds, 20);
});

test("writes are serialized and updates during a pending save are not lost", async () => {
	const { store, write } = setup();
	await store.initialize();
	const commit = Promise.withResolvers<void>();
	const started = Promise.withResolvers<void>();
	write.mock.mockImplementationOnce(() => {
		started.resolve();
		return commit.promise;
	});
	const original = record(20);
	store.set(original);
	original.positionInSeconds = 999;
	const first = store.flush();
	await started.promise;
	store.set(record(30));
	const second = store.flush();
	assert.equal(write.mock.callCount(), 1);
	commit.resolve();
	await Promise.all([first, second]);
	assert.deepEqual(
		write.mock.calls.map((call) => call.arguments[0]),
		[
			[{ store: "playback", action: "set", value: record(20) }],
			[{ store: "playback", action: "set", value: record(30) }],
		],
	);
	await store.flush();
	assert.equal(write.mock.callCount(), 2);
});

test("failed saves preserve memory and retry pending records on the next flush", async () => {
	const { store, write } = setup();
	write.mock.mockImplementationOnce(async () => {
		throw new Error("Write failed");
	});
	store.set(record(25));
	await assert.rejects(store.flush(), /Write failed/);
	assert.deepEqual(store.get(42), record(25));
	await store.flush();
	assert.equal(write.mock.callCount(), 2);
});
