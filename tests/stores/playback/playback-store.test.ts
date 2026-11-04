import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createIndexedDB } from "../../../src/database/indexed-db";
import { PlaybackStore } from "../../../src/stores/playback/playback-store";
import type { PlaybackRecord } from "../../../src/stores/playback/types";

function record(positionInSeconds = 12): PlaybackRecord {
	return { showId: 42, inProgress: true, positionInSeconds, history: [] };
}

function setup() {
	let elapsed = 0;
	const database = createIndexedDB();
	const objectStore = database.getObjectStore("playback");
	const read = mock.method(objectStore, "getAll", async () => [record()]);
	mock.method(database, "getObjectStore", () => objectStore);
	const write = mock.method(database, "transaction", async () => {});
	return {
		store: new PlaybackStore(database, {
			now: () => 1_000_000 + elapsed,
		}),
		read,
		write,
		advance: (milliseconds: number) => {
			elapsed += milliseconds;
		},
	};
}

test("construction is SSR safe and reads are empty before initialization", () => {
	const store = new PlaybackStore(createIndexedDB());
	assert.equal(store.get(42), undefined);
	assert.deepEqual(store.getAll(), []);
});

test("React snapshots stay stable between updates and publish before notification", async () => {
	const { store } = setup();
	const empty = store.getSnapshot();
	assert.deepEqual(empty, []);
	assert.equal(store.getSnapshot(), empty);
	await store.initialize();
	const loaded = store.getSnapshot();
	assert.notEqual(loaded, empty);
	assert.deepEqual(loaded, [record()]);
	assert.equal(store.getSnapshot(), loaded);
	store.subscribe(() => {
		assert.deepEqual(store.getSnapshot(), [record(20)]);
	});
	store.set(record(20));
	assert.notEqual(store.getSnapshot(), loaded);
	assert.equal(store.getSnapshot(), store.getSnapshot());
	assert.deepEqual(loaded, [record()]);
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
		updatedAt: 1,
		startPosition: 0,
		endPosition: 12,
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

test("only completion counts a listen, from any starting position", async () => {
	for (const start of [0, 120, 3599]) {
		const { store, advance } = setup();
		await store.progress(42, start);
		advance(60_000);
		await store.progress(42, 3600);
		assert.equal(
			store
				.get(42)
				?.history.filter((session) => session.completedAt !== undefined).length,
			0,
		);
		await store.complete(42);
		assert.equal(store.get(42)?.inProgress, false);
		assert.equal(store.get(42)?.history[0]?.completedAt, 1_060_000);
		assert.equal(store.get(42)?.history[0]?.startPosition, start);
		assert.equal(store.get(42)?.history[0]?.endPosition, 3600);
	}
});

test("interruptions and switching away preserve the same unfinished session", async () => {
	const { store, advance } = setup();
	await store.progress(42, 10);
	const original = store.get(42)?.history[0];
	await store.flush();
	advance(86_400_000);
	await store.progress(87, 0);
	await store.flush();
	await store.progress(42, 0);
	await store.progress(42, 500);
	assert.equal(store.get(42)?.history.length, 1);
	assert.equal(store.get(42)?.history[0]?.startedAt, original?.startedAt);
	assert.equal(store.get(42)?.history[0]?.startPosition, 10);
	assert.equal(store.get(42)?.history[0]?.completedAt, undefined);
	assert.equal(store.get(42)?.inProgress, true);
});

test("duplicate completion counts once; replay creates another session", async () => {
	const { store, advance } = setup();
	await store.complete(99);
	assert.equal(store.get(99), undefined);
	await store.progress(42, 3599);
	await store.complete(42);
	const completed = store.get(42);
	advance(1000);
	await store.complete(42);
	assert.deepEqual(store.get(42), completed);
	await store.progress(42, 0);
	assert.equal(store.get(42)?.history.length, 2);
	assert.equal(store.get(42)?.inProgress, true);
	assert.equal(store.get(42)?.history[1]?.completedAt, undefined);
	await store.complete(42);
	assert.equal(
		store
			.get(42)
			?.history.filter((session) => session.completedAt !== undefined).length,
		2,
	);
});

test("reload leaves unfinished sessions open and resume reuses the same entry", async () => {
	const { store, read, write } = setup();
	const cached = {
		...record(180),
		history: [
			{
				startedAt: 1000,
				updatedAt: 20_000,
				startPosition: 10,
				endPosition: 180,
			},
		],
	};
	read.mock.mockImplementation(async () => [structuredClone(cached)]);
	await store.initialize();
	assert.deepEqual(store.get(42), cached);
	assert.equal(write.mock.callCount(), 0);
	await store.progress(42, 181);
	assert.equal(store.get(42)?.history.length, 1);
	assert.equal(store.get(42)?.history[0]?.startedAt, 1000);
	assert.equal(store.get(42)?.history[0]?.startPosition, 10);
	assert.equal(store.get(42)?.history[0]?.completedAt, undefined);
});

test("new-session logging happens once per listen, not on resume", async () => {
	const { store } = setup();
	const log = mock.method(console, "log", () => {});
	try {
		await store.progress(42, 0);
		await store.flush();
		await store.progress(42, 12);
		assert.equal(log.mock.callCount(), 1);
		await store.complete(42);
		await store.progress(42, 0);
		assert.equal(log.mock.callCount(), 2);
	} finally {
		log.mock.restore();
	}
});

test("five-second checkpoints and boundaries persist; failed checkpoints can retry", async () => {
	const { store, advance, write } = setup();
	await store.progress(42, 0);
	advance(4000);
	await store.progress(42, 4);
	assert.equal(write.mock.callCount(), 1);
	write.mock.mockImplementationOnce(async () => {
		throw new Error("Disk full");
	});
	advance(1000);
	await assert.rejects(store.progress(42, 5), /Disk full/);
	assert.equal(store.get(42)?.positionInSeconds, 5);
	await store.flush();
	assert.equal(write.mock.callCount(), 3);
});

test("invalid progress rejects without creating records", async () => {
	const { store } = setup();
	for (const [id, position] of [
		[NaN, 0],
		[42, Infinity],
		[42, -1],
		[1.5, 0],
	] as const) {
		await assert.rejects(
			store.progress(id, position),
			/Invalid playback progress/,
		);
	}
	assert.deepEqual(store.getAll(), []);
});
