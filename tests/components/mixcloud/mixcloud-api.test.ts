import assert from "node:assert/strict";
import test from "node:test";
import { createMixcloudApiLoader } from "../../../src/components/mixcloud";

function fixture() {
	let api: unknown;
	let appended = 0;
	let loaded = () => {};
	let failed = () => {};
	const load = createMixcloudApiLoader({
		readApi: () => api,
		appendScript: (onLoad, onError) => {
			appended++;
			loaded = onLoad;
			failed = onError;
		},
	});
	return {
		load,
		setApi: (value: unknown) => {
			api = value;
		},
		loaded: () => loaded(),
		failed: () => failed(),
		appended: () => appended,
	};
}

test("concurrent callers share one script and resolved API", async () => {
	const f = fixture();
	const first = f.load();
	assert.equal(f.load(), first);
	assert.equal(f.appended(), 1);
	f.setApi({ PlayerWidget: () => "widget" });
	f.loaded();
	const api = await first;
	assert.equal(await f.load(), api);
	assert.equal(f.appended(), 1);
});

test("an already available API requires no script", async () => {
	const f = fixture();
	f.setApi({ PlayerWidget: () => "widget" });
	await f.load();
	assert.equal(f.appended(), 0);
});

test("network failure rejects and a subsequent call can retry", async () => {
	const f = fixture();
	const first = f.load();
	f.failed();
	await assert.rejects(first, /Could not load/);
	const retry = f.load();
	assert.equal(f.appended(), 2);
	f.setApi({ PlayerWidget: () => "widget" });
	f.loaded();
	await retry;
});

test("a loaded script without a valid factory rejects", async () => {
	const f = fixture();
	const first = f.load();
	f.setApi({ PlayerWidget: "invalid" });
	f.loaded();
	await assert.rejects(first, /unavailable/);
});
