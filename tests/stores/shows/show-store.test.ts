import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { createIndexedDB } from "../../../src/database/indexed-db";
import { ShowStore } from "../../../src/stores/shows/show-store";
import { VersionsStore } from "../../../src/stores/versions/versions-store";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

test("construction does not open browser storage", () => {
	const database = createIndexedDB();
	new ShowStore(database, new VersionsStore(database));
});

test("get delegates numeric IDs to the shows object store", async () => {
	const database = createIndexedDB();
	const versions = new VersionsStore(database);
	const objectStore = database.getObjectStore("shows");
	const read = mock.method(objectStore, "get", async () => undefined);
	mock.method(database, "getObjectStore", () => objectStore);
	const store = new ShowStore(database, versions);
	assert.equal(await store.get(42), undefined);
	assert.deepEqual(
		read.mock.calls.map((call) => call.arguments),
		[[42]],
	);
});

test("fetches the shows export and its revision under the configured base", async () => {
	const exported = {
		version: 4,
		updatedAt: "2026-11-02T19:09:00.560Z",
		data: [],
	};
	const fetchMock = mock.fn(async () => Response.json(exported));
	globalThis.fetch = fetchMock as unknown as typeof fetch;
	const database = createIndexedDB();
	const store = new ShowStore(database, new VersionsStore(database));
	for (const base of ["/archive", "/archive/"]) {
		assert.deepEqual(await store.fetchShows(base), exported);
	}
	assert.deepEqual(
		fetchMock.mock.calls.map((call) => call.arguments),
		[
			["/archive/resources/shows.json", { cache: "no-cache" }],
			["/archive/resources/shows.json", { cache: "no-cache" }],
		],
	);
});

test("show fetch propagates HTTP, network, and JSON failures without database writes", async () => {
	const database = createIndexedDB();
	const writes = mock.method(database, "transaction", async () => {});
	const store = new ShowStore(database, new VersionsStore(database));
	globalThis.fetch = mock.fn(
		async () => new Response(null, { status: 404 }),
	) as unknown as typeof fetch;
	await assert.rejects(store.fetchShows("/archive/"), /404/);
	globalThis.fetch = mock.fn(async () => {
		throw new Error("Offline");
	}) as unknown as typeof fetch;
	await assert.rejects(store.fetchShows("/archive/"), /Offline/);
	globalThis.fetch = mock.fn(
		async () => new Response("invalid JSON"),
	) as unknown as typeof fetch;
	await assert.rejects(store.fetchShows("/archive/"), SyntaxError);
	assert.equal(writes.mock.callCount(), 0);
});
