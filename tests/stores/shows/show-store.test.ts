import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createIndexedDB } from "../../../src/database/indexed-db";
import { ShowStore } from "../../../src/stores/shows/show-store";
import { VersionsStore } from "../../../src/stores/versions/versions-store";

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
