import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createIndexedDB } from "../../../src/database/indexed-db";
import {
	type SearchEntry,
	SearchHistoryStore,
} from "../../../src/stores/search-history-store";

function setup() {
	const database = createIndexedDB();
	const data = new Map<string, SearchEntry[]>();
	const reads = new Map<string, () => Promise<SearchEntry[]>>();
	let failWrite = false;
	mock.method(database, "getObjectStore", (name: string) => ({
		get: async (query: string) =>
			data.get(name)?.find((entry) => entry.query === query),
		getAll: async () =>
			reads.get(name)?.() ?? structuredClone(data.get(name) ?? []),
		set: async (entry: SearchEntry) => {
			if (failWrite) {
				throw new Error("Storage failed");
			}
			data.set(name, [
				entry,
				...(data.get(name) ?? []).filter((item) => item.query !== entry.query),
			]);
		},
		delete: async (query: string) => {
			if (failWrite) {
				throw new Error("Storage failed");
			}
			data.set(
				name,
				(data.get(name) ?? []).filter((entry) => entry.query !== query),
			);
		},
	}));
	return {
		database,
		data,
		reads,
		store: new SearchHistoryStore(database),
		fail: (value: boolean) => {
			failWrite = value;
		},
	};
}

test("history trims, ignores blanks, deduplicates by case, sorts and persists by category", async () => {
	const { store, database } = setup();
	const clock = mock.method(Date, "now", () => 100);
	try {
		await store.save("shows", "  jazz  ");
		clock.mock.mockImplementation(() => 200);
		await store.save("shows", "Jazz");
		clock.mock.mockImplementation(() => 300);
		await store.save("shows", "jazz");
		await store.save("shows", "  ");
		await store.save("djs", "dj");
		assert.deepEqual(store.getSnapshot("shows"), [
			{ query: "jazz", date: 300 },
			{ query: "Jazz", date: 200 },
		]);
		assert.deepEqual(store.getSnapshot("explore"), []);
		const reloaded = new SearchHistoryStore(database);
		await reloaded.initialize("shows");
		assert.deepEqual(reloaded.getSnapshot("shows"), store.getSnapshot("shows"));
		await store.remove("shows", "jazz");
		assert.deepEqual(store.getSnapshot("shows"), [
			{ query: "Jazz", date: 200 },
		]);
		assert.equal(store.getSnapshot("djs").length, 1);
	} finally {
		clock.mock.restore();
	}
});

test("slow initialization cannot overwrite a save or resurrect a deletion", async () => {
	const { store, reads } = setup();
	const read = Promise.withResolvers<SearchEntry[]>();
	reads.set("search_shows", () => read.promise);
	const loading = store.initialize("shows");
	const remove = store.remove("shows", "old");
	const save = store.save("shows", "new");
	read.resolve([{ query: "old", date: 1 }]);
	await Promise.all([loading, remove, save]);
	assert.deepEqual(
		store.getSnapshot("shows").map((entry) => entry.query),
		["new"],
	);
});

test("storage failures preserve entries and allow retry, including failed loading", async () => {
	const { store, fail, reads } = setup();
	reads.set("search_shows", async () => {
		throw new Error("Read failed");
	});
	await assert.rejects(store.initialize("shows"), /Read failed/);
	reads.delete("search_shows");
	await store.save("shows", "keep");
	const snapshot = store.getSnapshot("shows");
	fail(true);
	await assert.rejects(store.remove("shows", "keep"), /Storage failed/);
	await assert.rejects(store.save("shows", "failed"), /Storage failed/);
	assert.equal(store.getSnapshot("shows"), snapshot);
	fail(false);
	await store.remove("shows", "keep");
	assert.deepEqual(store.getSnapshot("shows"), []);
});
