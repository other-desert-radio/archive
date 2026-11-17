import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { createIndexedDB } from "../../../src/database/indexed-db";
import { ShowDetailStore } from "../../../src/stores/show-details/show-detail-store";
import type {
	ShowDetail,
	ShowDetailsExport,
} from "../../../src/stores/show-details/types";
import { VersionsStore } from "../../../src/stores/versions/versions-store";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

const cached: ShowDetail[] = [
	{
		id: 1,
		description: "<p>Cached</p>",
		tracklist: [{ chapter: "Intro", start_time: 0 }],
	},
	{ id: 2, description: "Deleted" },
];
const exported: ShowDetailsExport = {
	version: 4,
	updatedAt: "2026-11-02T19:09:00.560Z",
	data: [{ id: 1 }],
};

function setup(data = cached, revision: number | undefined = 3) {
	const database = createIndexedDB();
	const versions = new VersionsStore(database);
	const initialize = mock.method(versions, "initialize", async () => {});
	const published = mock.method(versions, "getPublished", () => 4);
	const committed = mock.method(versions, "getCached", () => revision);
	const refresh = mock.method(versions, "refreshCached", async () => {});
	const objectStore = database.getObjectStore("show_details");
	const read = mock.method(objectStore, "getAll", async () => data);
	mock.method(database, "getObjectStore", () => objectStore);
	const write = mock.method(database, "transaction", async () => {});
	return {
		store: new ShowDetailStore(database, versions),
		versions,
		initialize,
		published,
		committed,
		refresh,
		read,
		write,
	};
}

test("construction and lookups do not open browser storage", () => {
	const database = createIndexedDB();
	const store = new ShowDetailStore(database, new VersionsStore(database));
	assert.equal(store.get(1), undefined);
});

test("concurrent initialization shares cache reads and one request; replacement waits for commit", async () => {
	const { store, read, write, refresh } = setup();
	const commit = Promise.withResolvers<void>();
	const started = Promise.withResolvers<void>();
	write.mock.mockImplementation(() => {
		started.resolve();
		return commit.promise;
	});
	const fetchMock = mock.fn(async () => Response.json(exported));
	globalThis.fetch = fetchMock as unknown as typeof fetch;
	const snapshots: (ShowDetail | undefined)[] = [];
	const unsubscribe = store.subscribe(() => snapshots.push(store.get(1)));
	const loading = store.initialize("/archive/");
	assert.equal(loading, store.initialize("/archive/"));
	await started.promise;
	assert.deepEqual(store.get(1), cached[0]);
	assert.equal(refresh.mock.callCount(), 0);
	assert.deepEqual(snapshots, [cached[0]]);
	commit.resolve();
	await loading;
	assert.deepEqual(store.get(1), { id: 1 });
	assert.equal(store.get(2), undefined);
	assert.deepEqual(snapshots, [cached[0], { id: 1 }]);
	assert.equal(refresh.mock.callCount(), 1);
	await store.initialize("/archive/");
	assert.equal(read.mock.callCount(), 1);
	assert.equal(fetchMock.mock.callCount(), 1);
	assert.deepEqual(write.mock.calls[0]?.arguments[0], [
		{ store: "show_details", action: "clear" },
		{ store: "show_details", action: "set", value: { id: 1 } },
		{
			store: "metadata",
			action: "set",
			value: { key: "show_details", revision: 4 },
		},
	]);
	unsubscribe();
	await store.saveDetails({ ...exported, data: [] });
	assert.equal(snapshots.length, 2);
	assert.equal(store.get(1), undefined);
});

test("warm matching revision loads cached records without downloading details", async () => {
	const { store } = setup(cached, 4);
	const fetchMock = mock.fn(async () => {
		throw new Error("Unexpected download");
	});
	globalThis.fetch = fetchMock as unknown as typeof fetch;
	await store.initialize("/archive/");
	assert.deepEqual(store.get(1), cached[0]);
	assert.equal(fetchMock.mock.callCount(), 0);
});

test("cold initialization distinguishes unloaded records from a loaded empty record", async () => {
	const { store } = setup([], undefined);
	assert.equal(store.get(1), undefined);
	globalThis.fetch = mock.fn(async () =>
		Response.json(exported),
	) as unknown as typeof fetch;
	await store.initialize("/archive/");
	assert.deepEqual(store.get(1), { id: 1 });
});

test("cached details are published before the manifest is available, including offline failure", async () => {
	const { store, initialize, write } = setup();
	const manifest = Promise.withResolvers<void>();
	const started = Promise.withResolvers<void>();
	initialize.mock.mockImplementation(() => {
		started.resolve();
		return manifest.promise;
	});
	const loading = store.initialize("/archive/");
	await started.promise;
	assert.deepEqual(store.get(1), cached[0]);
	manifest.reject(new Error("Offline"));
	await assert.rejects(loading, /Offline/);
	assert.deepEqual(store.get(1), cached[0]);
	assert.equal(write.mock.callCount(), 0);
});

test("failed downloads and transactions preserve cache and allow initialization retry", async () => {
	const { store, write, refresh } = setup();
	globalThis.fetch = mock.fn(async () => {
		throw new Error("Offline");
	}) as unknown as typeof fetch;
	await assert.rejects(store.initialize("/archive/"), /Offline/);
	assert.deepEqual(store.get(1), cached[0]);
	assert.equal(write.mock.callCount(), 0);
	globalThis.fetch = mock.fn(async () =>
		Response.json(exported),
	) as unknown as typeof fetch;
	write.mock.mockImplementation(async () => {
		throw new Error("Write failed");
	});
	await assert.rejects(store.initialize("/archive/"), /Write failed/);
	assert.deepEqual(store.get(1), cached[0]);
	assert.equal(refresh.mock.callCount(), 0);
	write.mock.mockImplementation(async () => {});
	await store.initialize("/archive/");
	assert.deepEqual(store.get(1), { id: 1 });
});

test("revision mismatch reloads the manifest and retries once", async () => {
	const { store, initialize, published } = setup();
	initialize.mock.mockImplementation(async () => {
		published.mock.mockImplementation(() => 5);
	});
	const fetchMock = mock.fn(async () =>
		Response.json({ ...exported, version: 5 }),
	);
	globalThis.fetch = fetchMock as unknown as typeof fetch;
	assert.deepEqual(await store.fetchUpdatedDetails("/archive/"), {
		...exported,
		version: 5,
	});
	assert.equal(initialize.mock.callCount(), 1);
	assert.equal(fetchMock.mock.callCount(), 2);
});

test("persistent revision mismatch retains cache, stops after two downloads and permits retry", async () => {
	const { store, initialize, write } = setup();
	const fetchMock = mock.fn(async () =>
		Response.json({ ...exported, version: 5 }),
	);
	globalThis.fetch = fetchMock as unknown as typeof fetch;
	await assert.rejects(store.initialize("/archive/"), /expected 4, received 5/);
	assert.deepEqual(store.get(1), cached[0]);
	assert.equal(fetchMock.mock.callCount(), 2);
	assert.equal(initialize.mock.callCount(), 2);
	assert.equal(write.mock.callCount(), 0);
	globalThis.fetch = mock.fn(async () =>
		Response.json(exported),
	) as unknown as typeof fetch;
	await store.initialize("/archive/");
	assert.deepEqual(store.get(1), { id: 1 });
});

test("detail-only revisions check the independent dataset", async () => {
	const { store, published, committed } = setup();
	globalThis.fetch = mock.fn(async () =>
		Response.json(exported),
	) as unknown as typeof fetch;
	await store.initialize("/archive/");
	assert.deepEqual(
		published.mock.calls.map((call) => call.arguments),
		[["show_details"]],
	);
	assert.deepEqual(
		committed.mock.calls.map((call) => call.arguments),
		[["show_details"]],
	);
});

test("fetch uses the configured base and rejects HTTP, network, JSON and shape failures", async () => {
	const { store, write } = setup();
	for (const base of ["/archive", "/archive/"]) {
		const fetchMock = mock.fn(async () => Response.json(exported));
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		assert.deepEqual(await store.fetchDetails(base), exported);
		assert.deepEqual(fetchMock.mock.calls[0]?.arguments, [
			"/archive/resources/show_details.json",
			{ cache: "no-cache" },
		]);
	}
	for (const response of [
		new Response(null, { status: 404 }),
		new Response("invalid JSON"),
		Response.json({ version: 4, data: [] }),
	]) {
		globalThis.fetch = mock.fn(async () => response) as unknown as typeof fetch;
		await assert.rejects(store.fetchDetails("/archive/"));
	}
	globalThis.fetch = mock.fn(async () => {
		throw new Error("Offline");
	}) as unknown as typeof fetch;
	await assert.rejects(store.fetchDetails("/archive/"), /Offline/);
	assert.equal(write.mock.callCount(), 0);
});
