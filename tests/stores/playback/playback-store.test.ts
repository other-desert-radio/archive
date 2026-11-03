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
			monotonic: () => elapsed,
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

test("sessions count only after more than ten seconds, including across pauses", async () => {
	const { store, advance } = setup();
	await store.progress(42, 10);
	advance(10_000);
	await store.progress(42, 20);
	assert.equal(
		store.get(42)?.history.filter((session) => session.playedSeconds > 10)
			.length,
		0,
	);
	await store.suspend();
	advance(86_400_000);
	await store.progress(42, 21);
	assert.equal(store.get(42)?.history[0]?.playedSeconds, 10);
	advance(1000);
	await store.progress(42, 22);
	assert.equal(store.get(42)?.history.length, 1);
	assert.equal(store.get(42)?.history[0]?.playedSeconds, 11);
});

test("buffering stops time and seek jumps do not add skipped audio", async () => {
	const { store, advance } = setup();
	await store.progress(42, 0);
	advance(2000);
	await store.suspend();
	advance(30_000);
	await store.progress(42, 500);
	advance(1000);
	await store.progress(42, 1);
	assert.equal(store.get(42)?.history[0]?.playedSeconds, 3);
	assert.equal(store.get(42)?.positionInSeconds, 1);
});

test("stationary progress does not accumulate time", async () => {
	const { store, advance } = setup();
	await store.progress(42, 12);
	advance(20_000);
	await store.progress(42, 12);
	advance(20_000);
	await store.progress(42, 13);
	assert.equal(store.get(42)?.history[0]?.playedSeconds, 0);
});

test("switch, clear, and completion end sessions; replay preserves history", async () => {
	const { store, advance } = setup();
	await store.progress(42, 10);
	advance(11_000);
	await store.progress(87, 0);
	assert.equal(store.get(42)?.history[0]?.endedAt, 1_011_000);
	assert.equal(store.get(42)?.inProgress, true);
	await store.end(false);
	assert.ok(store.get(87)?.history[0]?.endedAt);
	await store.progress(42, 0);
	advance(12_000);
	await store.progress(42, 12);
	await store.end(true);
	assert.equal(store.get(42)?.inProgress, false);
	assert.equal(
		store.get(42)?.history.filter((session) => session.playedSeconds > 10)
			.length,
		2,
	);
	await store.progress(42, 0);
	assert.equal(store.get(42)?.inProgress, true);
	assert.equal(store.get(42)?.history.length, 3);
});

test("reload closes open sessions at the saved checkpoint and creates a separate session", async () => {
	const { store, read } = setup();
	read.mock.mockImplementation(async () => [
		{
			...record(180),
			history: [
				{
					startedAt: 1000,
					updatedAt: 20_000,
					startPosition: 10,
					endPosition: 180,
					playedSeconds: 15,
				},
			],
		},
	]);
	await store.initialize();
	assert.equal(store.get(42)?.history[0]?.endedAt, 20_000);
	await store.progress(42, 0);
	assert.equal(store.get(42)?.history.length, 2);
	assert.equal(store.get(42)?.history[1]?.startPosition, 0);
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
	await store.suspend();
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
