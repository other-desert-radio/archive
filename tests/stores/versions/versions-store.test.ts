import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { createIndexedDB } from "../../../src/database/indexed-db";
import { VersionsStore } from "../../../src/stores/versions/versions-store";

const manifest = {
	shows: { id: 13, updatedAt: "2026-11-02T19:09:00.560Z" },
	djs: { id: 5, updatedAt: "2026-11-02T19:09:00.560Z" },
	tags: { id: 3, updatedAt: "2026-11-02T19:09:00.560Z" },
};
const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

function setup() {
	const database = createIndexedDB();
	const metadata = database.getObjectStore("metadata");
	const read = mock.method(metadata, "getAll", async () => [
		{ key: "shows", revision: 12 },
	]);
	const write = mock.method(metadata, "set", async () => {
		throw new Error("Unexpected write");
	});
	mock.method(database, "getObjectStore", () => metadata);
	return { store: new VersionsStore(database), read, write };
}

test("construction is inert and initialization shares one fetch without overwriting cached revisions", async () => {
	for (const base of ["/archive", "/archive/"]) {
		const fetchMock = mock.fn(async () => Response.json(manifest));
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		const { store, read, write } = setup();
		assert.equal(fetchMock.mock.callCount(), 0);
		assert.equal(read.mock.callCount(), 0);
		assert.equal(store.getPublished("shows"), undefined);
		const first = store.initialize(base);
		assert.equal(first, store.initialize(base));
		await first;
		await store.initialize(base);
		assert.deepEqual(
			fetchMock.mock.calls.map((call) => call.arguments),
			[["/archive/resources/data_versions.json", { cache: "no-cache" }]],
		);
		assert.equal(read.mock.callCount(), 1);
		assert.equal(write.mock.callCount(), 0);
		assert.equal(store.getPublished("shows"), 13);
		assert.equal(store.getCached("shows"), 12);
		assert.equal(store.getCached("djs"), undefined);
		assert.equal(store.getPublished("djs"), 5);
		assert.equal(store.getPublished("tags"), 3);
	}
});

test("failed HTTP and malformed manifests reject and permit retry", async () => {
	const { store } = setup();
	for (const response of [
		new Response(null, { status: 404 }),
		Response.json({ shows: { id: "bad" } }),
	]) {
		globalThis.fetch = mock.fn(async () => response) as unknown as typeof fetch;
		await assert.rejects(store.initialize("/archive/"));
		assert.equal(store.getPublished("shows"), undefined);
	}
	globalThis.fetch = mock.fn(async () =>
		Response.json(manifest),
	) as unknown as typeof fetch;
	await store.initialize("/archive/");
	assert.equal(store.getPublished("shows"), 13);
});

test("cached revisions refresh only from committed metadata and survive read failures", async () => {
	globalThis.fetch = mock.fn(async () =>
		Response.json(manifest),
	) as unknown as typeof fetch;
	const { store, read } = setup();
	await store.initialize("/archive/");
	read.mock.mockImplementation(async () => [{ key: "shows", revision: 13 }]);
	await store.refreshCached();
	assert.equal(store.getCached("shows"), 13);
	read.mock.mockImplementation(async () => {
		throw new Error("Storage unavailable");
	});
	await assert.rejects(store.refreshCached(), /Storage unavailable/);
	assert.equal(store.getCached("shows"), 13);
});
