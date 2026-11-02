import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { ShowStore } from "../../../src/stores/shows/show-store";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

test("fetches versions under the site base and revalidates cached responses", async () => {
	const versions = { shows: { id: 4 } };
	const fetchMock = mock.fn(async () => Response.json(versions));
	globalThis.fetch = fetchMock as unknown as typeof fetch;
	const store = new ShowStore();
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
	await assert.rejects(new ShowStore().fetchVersions("/archive/"), /404/);
});
