import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { createIndexedDB } from "../../../src/database/indexed-db";
import { TagStore } from "../../../src/stores/tags/tag-store";
import { VersionsStore } from "../../../src/stores/versions/versions-store";
import fixtureTags from "../../res/tags.json";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

test("construction does not open browser storage", () => {
	const database = createIndexedDB();
	new TagStore(database, new VersionsStore(database));
});

test("lookups use memory without opening storage before initialization", () => {
	const database = createIndexedDB();
	const store = new TagStore(database, new VersionsStore(database));
	assert.equal(store.get(42), undefined);
	assert.deepEqual(store.getAll(), []);
	assert.equal(store.getMap().size, 0);
	assert.equal(store.getMap(), store.getMap());
});

test("fetches the tags export and its revision under the configured base", async () => {
	const exported = {
		version: 4,
		updatedAt: "2026-11-02T19:09:00.560Z",
		data: [],
	};
	const fetchMock = mock.fn(async () => Response.json(exported));
	globalThis.fetch = fetchMock as unknown as typeof fetch;
	const database = createIndexedDB();
	const store = new TagStore(database, new VersionsStore(database));
	for (const base of ["/archive", "/archive/"]) {
		assert.deepEqual(await store.fetchTags(base), exported);
	}
	assert.deepEqual(
		fetchMock.mock.calls.map((call) => call.arguments),
		[
			["/archive/resources/tags.json", { cache: "no-cache" }],
			["/archive/resources/tags.json", { cache: "no-cache" }],
		],
	);
});

test("tag fetch propagates HTTP, network, and JSON failures without database writes", async () => {
	const database = createIndexedDB();
	const writes = mock.method(database, "transaction", async () => {});
	const store = new TagStore(database, new VersionsStore(database));
	globalThis.fetch = mock.fn(
		async () => new Response(null, { status: 404 }),
	) as unknown as typeof fetch;
	await assert.rejects(store.fetchTags("/archive/"), /404/);
	globalThis.fetch = mock.fn(async () => {
		throw new Error("Offline");
	}) as unknown as typeof fetch;
	await assert.rejects(store.fetchTags("/archive/"), /Offline/);
	globalThis.fetch = mock.fn(
		async () => new Response("invalid JSON"),
	) as unknown as typeof fetch;
	await assert.rejects(store.fetchTags("/archive/"), SyntaxError);
	assert.equal(writes.mock.callCount(), 0);
});

test("matching revisions skip downloads and uninitialized versions reject", async () => {
	const database = createIndexedDB();
	const versions = new VersionsStore(database);
	const store = new TagStore(database, versions);
	const fetchMock = mock.fn(async () => {
		throw new Error("Unexpected fetch");
	});
	globalThis.fetch = fetchMock as unknown as typeof fetch;
	await assert.rejects(
		store.fetchUpdatedTags("/archive/"),
		/Initialize versions/,
	);
	mock.method(versions, "getPublished", () => 4);
	mock.method(versions, "getCached", () => 4);
	assert.equal(await store.fetchUpdatedTags("/archive/"), undefined);
	assert.equal(fetchMock.mock.callCount(), 0);
});

test("missing, older, and newer cached revisions fetch the published export", async () => {
	const exported = {
		version: 4,
		updatedAt: "2026-11-02T19:09:00.560Z",
		data: [],
	};
	for (const cached of [undefined, 3, 5]) {
		const database = createIndexedDB();
		const versions = new VersionsStore(database);
		mock.method(versions, "getPublished", () => 4);
		mock.method(versions, "getCached", () => cached);
		const fetchMock = mock.fn(async () => Response.json(exported));
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		const store = new TagStore(database, versions);
		assert.deepEqual(await store.fetchUpdatedTags("/archive/"), exported);
		assert.equal(fetchMock.mock.callCount(), 1);
	}
});

test("a manifest/export mismatch rejects without changing cached revisions or writing", async () => {
	const database = createIndexedDB();
	const writes = mock.method(database, "transaction", async () => {});
	const versions = new VersionsStore(database);
	mock.method(versions, "getPublished", () => 4);
	mock.method(versions, "getCached", () => 3);
	globalThis.fetch = mock.fn(async () =>
		Response.json({ version: 5, data: [] }),
	) as unknown as typeof fetch;
	const store = new TagStore(database, versions);
	await assert.rejects(
		store.fetchUpdatedTags("/archive/"),
		/expected 4, received 5/,
	);
	assert.equal(versions.getCached("tags"), 3);
	assert.equal(writes.mock.callCount(), 0);
});

test("saves the complete catalog and revision in one batch, including empty catalogs", async () => {
	for (const data of [fixtureTags.data, []]) {
		const database = createIndexedDB();
		const versions = new VersionsStore(database);
		const writes = mock.method(database, "transaction", async () => {});
		const refresh = mock.method(versions, "refreshCached", async () => {});
		const store = new TagStore(database, versions);
		await store.saveTags({
			version: 4,
			updatedAt: "2026-11-02T19:09:00.560Z",
			data,
		});
		assert.deepEqual(
			writes.mock.calls.map((call) => call.arguments),
			[
				[
					[
						{ store: "tags", action: "clear" },
						...data.map((tag) => ({
							store: "tags",
							action: "set",
							value: tag,
						})),
						{
							store: "metadata",
							action: "set",
							value: { key: "tags", revision: 4 },
						},
					],
				],
			],
		);
		assert.equal(refresh.mock.callCount(), 1);
	}
});

test("cached revisions refresh only after the database transaction commits", async () => {
	const database = createIndexedDB();
	const versions = new VersionsStore(database);
	const commit = Promise.withResolvers<void>();
	mock.method(database, "transaction", () => commit.promise);
	const refresh = mock.method(versions, "refreshCached", async () => {});
	const store = new TagStore(database, versions);
	const save = store.saveTags({
		version: 4,
		updatedAt: "2026-11-02T19:09:00.560Z",
		data: [],
	});
	assert.equal(refresh.mock.callCount(), 0);
	commit.resolve();
	await save;
	assert.equal(refresh.mock.callCount(), 1);
});

test("a failed catalog transaction rejects without refreshing cached revisions", async () => {
	const database = createIndexedDB();
	const versions = new VersionsStore(database);
	mock.method(database, "transaction", async () => {
		throw new Error("Write failed");
	});
	const refresh = mock.method(versions, "refreshCached", async () => {});
	const store = new TagStore(database, versions);
	await assert.rejects(
		store.saveTags({
			version: 4,
			updatedAt: "2026-11-02T19:09:00.560Z",
			data: [],
		}),
		/Write failed/,
	);
	assert.equal(refresh.mock.callCount(), 0);
});

function setupInitialization(cachedRevision: number | undefined) {
	const database = createIndexedDB();
	const versions = new VersionsStore(database);
	mock.method(versions, "getPublished", () => 4);
	mock.method(versions, "getCached", () => cachedRevision);
	mock.method(versions, "refreshCached", async () => {});
	const objectStore = database.getObjectStore("tags");
	const read = mock.method(objectStore, "getAll", async () => fixtureTags.data);
	mock.method(database, "getObjectStore", () => objectStore);
	const write = mock.method(database, "transaction", async () => {});
	return { store: new TagStore(database, versions), read, write };
}

test("matching revisions load cached tags once and serve synchronous memory lookups", async () => {
	const fetchMock = mock.fn(async () => {
		throw new Error("Unexpected fetch");
	});
	globalThis.fetch = fetchMock as unknown as typeof fetch;
	const { store, read, write } = setupInitialization(4);
	const emptyMap = store.getMap();
	await store.initialize("/archive/");
	assert.deepEqual(store.getAll(), fixtureTags.data);
	const tags = store.getMap();
	assert.notEqual(tags, emptyMap);
	assert.equal(store.getMap(), tags);
	assert.deepEqual([...tags.values()], fixtureTags.data);
	for (const tag of fixtureTags.data) {
		assert.deepEqual(store.get(tag.id), tag);
		assert.equal(tags.get(tag.id), store.get(tag.id));
	}
	store.getAll().pop();
	assert.equal(store.getAll().length, fixtureTags.data.length);
	assert.equal(read.mock.callCount(), 1);
	assert.equal(write.mock.callCount(), 0);
	assert.equal(fetchMock.mock.callCount(), 0);
});

test("updated catalog replaces memory only after the save commits", async () => {
	const updated = {
		version: 4,
		updatedAt: "2026-11-02T19:09:00.560Z",
		data: [],
	};
	globalThis.fetch = mock.fn(async () =>
		Response.json(updated),
	) as unknown as typeof fetch;
	const { store, write } = setupInitialization(3);
	const commit = Promise.withResolvers<void>();
	const started = Promise.withResolvers<void>();
	write.mock.mockImplementation(() => {
		started.resolve();
		return commit.promise;
	});
	const loading = store.initialize("/archive/");
	await started.promise;
	assert.deepEqual(store.getAll(), fixtureTags.data);
	commit.resolve();
	await loading;
	assert.deepEqual(store.getAll(), []);
	assert.equal(write.mock.callCount(), 1);
});

test("failed downloads and writes retain cached tags in memory and allow retry", async () => {
	const { store, write } = setupInitialization(3);
	globalThis.fetch = mock.fn(async () => {
		throw new Error("Offline");
	}) as unknown as typeof fetch;
	await assert.rejects(store.initialize("/archive/"), /Offline/);
	assert.deepEqual(store.getAll(), fixtureTags.data);
	assert.equal(write.mock.callCount(), 0);
	globalThis.fetch = mock.fn(async () =>
		Response.json({ version: 4, data: [] }),
	) as unknown as typeof fetch;
	write.mock.mockImplementation(async () => {
		throw new Error("Write failed");
	});
	await assert.rejects(store.initialize("/archive/"), /Write failed/);
	assert.deepEqual(store.getAll(), fixtureTags.data);
	write.mock.mockImplementation(async () => {});
	await store.initialize("/archive/");
	assert.deepEqual(store.getAll(), []);
});
