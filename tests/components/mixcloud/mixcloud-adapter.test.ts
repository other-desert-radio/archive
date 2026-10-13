import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import {
	MixcloudAdapter,
	type MixcloudWidget,
} from "../../../src/components/mixcloud";
import { AudioStore } from "../../../src/stores/audio";

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}

function fixture() {
	const store = new AudioStore();
	const ready = deferred<MixcloudWidget>();
	const calls: {
		key: string;
		autoplay: boolean;
		result: ReturnType<typeof deferred<void>>;
	}[] = [];
	let playbackCommands = 0;
	const event = { on: () => {}, off: () => {} };
	const widget: MixcloudWidget = {
		load: (key, autoplay) => {
			const result = deferred<void>();
			calls.push({ key, autoplay, result });
			return result.promise;
		},
		play: async () => {
			playbackCommands++;
		},
		pause: async () => {
			playbackCommands++;
		},
		events: { play: event, pause: event, error: event },
	};
	const select = (name: string) =>
		store.select({
			title: name,
			source: { kind: "mixcloud", cloudcastKey: `/dj/${name}/` },
		});
	return {
		store,
		ready,
		widget,
		calls,
		select,
		commands: () => playbackCommands,
	};
}

test("late mounting and readiness use the latest selection without confirming playback", async () => {
	const f = fixture();
	f.select("first");
	const adapter = new MixcloudAdapter(f.store, f.ready.promise);
	f.select("latest");
	f.store.pause();
	assert.equal(f.calls.length, 0);
	f.ready.resolve(f.widget);
	await setImmediate();
	assert.equal(f.calls.length, 1);
	assert.equal(f.calls[0]?.key, "/dj/latest/");
	assert.equal(f.calls[0]?.autoplay, false);
	f.calls[0]?.result.resolve();
	await setImmediate();
	assert.equal(f.store.getSnapshot().status, "loading");
	f.store.play();
	await setImmediate();
	assert.equal(f.calls.length, 1);
	assert.equal(f.commands(), 0);
	adapter.dispose();
});

test("serializes loads and skips superseded intermediate selections", async () => {
	const f = fixture();
	const adapter = new MixcloudAdapter(f.store, f.ready.promise);
	f.ready.resolve(f.widget);
	f.select("first");
	await setImmediate();
	f.select("middle");
	f.select("last");
	assert.equal(f.calls.length, 1);
	f.calls[0]?.result.resolve();
	await setImmediate();
	assert.deepEqual(
		f.calls.map((call) => call.key),
		["/dj/first/", "/dj/last/"],
	);
	f.calls[1]?.result.resolve();
	adapter.dispose();
});

test("current load errors report to the store and a newer request retries", async () => {
	const f = fixture();
	const adapter = new MixcloudAdapter(f.store, f.ready.promise);
	f.select("first");
	f.ready.resolve(f.widget);
	await setImmediate();
	f.calls[0]?.result.reject(new Error("load failed"));
	await setImmediate();
	assert.equal(f.store.getSnapshot().status, "error");
	f.store.play();
	assert.equal(f.calls.length, 2);
	f.calls[1]?.result.resolve();
	adapter.dispose();
});

test("a superseded load error cannot overwrite a newer selection", async () => {
	const f = fixture();
	const adapter = new MixcloudAdapter(f.store, f.ready.promise);
	f.select("first");
	f.ready.resolve(f.widget);
	await setImmediate();
	f.select("latest");
	f.calls[0]?.result.reject(new Error("old failure"));
	await setImmediate();
	assert.equal(f.store.getSnapshot().status, "loading");
	assert.equal(f.calls[1]?.key, "/dj/latest/");
	f.calls[1]?.result.resolve();
	adapter.dispose();
});

test("clear or SAMCast selection before readiness produces no Mixcloud load", async () => {
	for (const action of ["clear", "samcast"] as const) {
		const f = fixture();
		const adapter = new MixcloudAdapter(f.store, f.ready.promise);
		f.select("first");
		if (action === "clear") f.store.clear();
		else
			f.store.select({
				title: "Live",
				source: { kind: "samcast", streamUrl: "https://example.com/live" },
			});
		f.ready.resolve(f.widget);
		await setImmediate();
		assert.equal(f.calls.length, 0);
		adapter.dispose();
	}
});

test("disposal unsubscribes and ignores pending readiness or load errors", async () => {
	for (const phase of ["ready", "load"] as const) {
		const f = fixture();
		const adapter = new MixcloudAdapter(f.store, f.ready.promise);
		f.select("first");
		if (phase === "load") {
			f.ready.resolve(f.widget);
			await setImmediate();
		}
		adapter.dispose();
		adapter.dispose();
		if (phase === "ready") f.ready.resolve(f.widget);
		else f.calls[0]?.result.reject(new Error("after disposal"));
		f.select("next");
		await setImmediate();
		assert.equal(f.calls.length, phase === "load" ? 1 : 0);
		assert.equal(f.store.getSnapshot().status, "loading");
	}
});

test("readiness failure reports the current Mixcloud selection", async () => {
	const f = fixture();
	const adapter = new MixcloudAdapter(f.store, f.ready.promise);
	f.select("first");
	f.ready.reject(new Error("not ready"));
	await setImmediate();
	assert.equal(f.store.getSnapshot().status, "error");
	adapter.dispose();
});
