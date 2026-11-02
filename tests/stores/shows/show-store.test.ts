import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { createIndexedDB } from "../../../src/database/indexed-db";
import { ShowStore } from "../../../src/stores/shows/show-store";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

test("fetches versions under the site base and revalidates cached responses", async () => {
	const versions = { shows: { id: 4 } };
	const fetchMock = mock.fn(async () => Response.json(versions));
	globalThis.fetch = fetchMock as unknown as typeof fetch;
	const store = new ShowStore(createIndexedDB());
	for (const base of ["/archive", "/archive/"]) {
		assert.deepEqual(await store.fetchVersions(base), versions);
	}
	assert.deepEqual(
		fetchMock.mock.calls.map((call) => call.arguments),
		[
			["/archive/resources/data_versions.json", { cache: "no-cache" }],
			["/archive/resources/data_versions.json", { cache: "no-cache" }],
		],
	);
});

test("rejects unsuccessful HTTP responses", async () => {
	globalThis.fetch = mock.fn(
		async () => new Response(null, { status: 404 }),
	) as unknown as typeof fetch;
	await assert.rejects(
		new ShowStore(createIndexedDB()).fetchVersions("/archive/"),
		/404/,
	);
});

test("construction does not fetch or open browser storage", () => {
	const fetchMock = mock.fn(async () => Response.json({}));
	globalThis.fetch = fetchMock as unknown as typeof fetch;
	new ShowStore(createIndexedDB());
	assert.equal(fetchMock.mock.callCount(), 0);
});

test("get delegates numeric IDs to the shows object store", async () => {
	const database = createIndexedDB();
	const objectStore = database.getObjectStore("shows");
	const read = mock.method(objectStore, "get", async () => undefined);
	mock.method(database, "getObjectStore", () => objectStore);
	const store = new ShowStore(database);
	assert.equal(await store.get(42), undefined);
	assert.deepEqual(
		read.mock.calls.map((call) => call.arguments),
		[[42]],
	);
});
