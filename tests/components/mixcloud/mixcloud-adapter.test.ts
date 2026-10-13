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
	const playbackCommands: string[] = [];
	const event = { on: () => {}, off: () => {} };
	const widget: MixcloudWidget = {
		load: (key, autoplay) => {
			const result = deferred<void>();
			calls.push({ key, autoplay, result });
			return result.promise;
		},
		play: async () => {
			playbackCommands.push("play");
		},
		pause: async () => {
			playbackCommands.push("pause");
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
	assert.deepEqual(f.commands(), ["pause", "play"]);
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

test("selection plays after loading but does not confirm playback", async () => {
	const f = fixture();
	const adapter = new MixcloudAdapter(f.store, f.ready.promise);
	f.ready.resolve(f.widget);
	f.select("first");
	await setImmediate();
	assert.deepEqual(f.commands(), []);
	f.calls[0]?.result.resolve();
	await setImmediate();
	assert.deepEqual(f.commands(), ["play"]);
	assert.equal(f.store.getSnapshot().status, "loading");
	adapter.dispose();
});

test("pause during loading replaces the original play intent", async () => {
	const f = fixture();
	const adapter = new MixcloudAdapter(f.store, f.ready.promise);
	f.select("first");
	f.ready.resolve(f.widget);
	await setImmediate();
	f.store.pause();
	f.calls[0]?.result.resolve();
	await setImmediate();
	assert.ok(f.commands().includes("pause"));
	assert.equal(f.commands().includes("play"), false);
	assert.equal(f.calls.length, 1);
	adapter.dispose();
});

test("clear and source changes pause immediately and after pending play settles", async () => {
	for (const action of ["clear", "samcast"] as const) {
		const f = fixture();
		const playing = deferred<void>();
		f.widget.play = () => playing.promise;
		const adapter = new MixcloudAdapter(f.store, f.ready.promise);
		f.select("first");
		f.ready.resolve(f.widget);
		await setImmediate();
		f.calls[0]?.result.resolve();
		await setImmediate();
		if (action === "clear") {
			f.store.clear();
		} else {
			f.store.select({
				title: "Live",
				source: { kind: "samcast", streamUrl: "https://example.com/live" },
			});
		}
		assert.deepEqual(f.commands(), ["pause"]);
		playing.resolve();
		await setImmediate();
		assert.deepEqual(f.commands(), ["pause", "pause"]);
		assert.equal(f.calls.length, 1);
		assert.equal(
			f.store.getSnapshot().status,
			action === "clear" ? "idle" : "loading",
		);
		adapter.dispose();
	}
});

test("pause reverses pending play and resume reuses the loaded show", async () => {
	const f = fixture();
	const playing = deferred<void>();
	let plays = 0;
	f.widget.play = () => {
		plays++;
		return plays === 1 ? playing.promise : Promise.resolve();
	};
	const adapter = new MixcloudAdapter(f.store, f.ready.promise);
	f.select("first");
	f.ready.resolve(f.widget);
	await setImmediate();
	f.calls[0]?.result.resolve();
	await setImmediate();
	f.store.pause();
	assert.deepEqual(f.commands(), ["pause"]);
	playing.resolve();
	await setImmediate();
	assert.deepEqual(f.commands(), ["pause", "pause"]);
	f.store.play();
	await setImmediate();
	assert.equal(plays, 2);
	assert.equal(f.calls.length, 1);
	adapter.dispose();
});

test("failed playback can retry without reloading the show", async () => {
	const f = fixture();
	f.widget.play = async () => {
		throw new Error("autoplay blocked");
	};
	const adapter = new MixcloudAdapter(f.store, f.ready.promise);
	f.select("first");
	f.ready.resolve(f.widget);
	await setImmediate();
	f.calls[0]?.result.resolve();
	await setImmediate();
	assert.equal(f.store.getSnapshot().status, "error");
	let retries = 0;
	f.widget.play = async () => {
		retries++;
	};
	f.store.play();
	await setImmediate();
	assert.equal(retries, 1);
	assert.equal(f.calls.length, 1);
	assert.equal(f.store.getSnapshot().status, "loading");
	adapter.dispose();
});

test("disposal pauses immediately and after pending play settles", async () => {
	const f = fixture();
	const playing = deferred<void>();
	f.widget.play = () => playing.promise;
	const adapter = new MixcloudAdapter(f.store, f.ready.promise);
	f.select("first");
	f.ready.resolve(f.widget);
	await setImmediate();
	f.calls[0]?.result.resolve();
	await setImmediate();
	adapter.dispose();
	assert.deepEqual(f.commands(), ["pause"]);
	playing.resolve();
	await setImmediate();
	assert.deepEqual(f.commands(), ["pause", "pause"]);
});

test("uses the initial selection and latest requests across readiness and pending loads", async () => {
	const f = fixture();
	f.select("initial");
	const adapter = new MixcloudAdapter(f.store, f.ready.promise);
	f.ready.resolve(f.widget);
	await setImmediate();
	assert.equal(f.calls[0]?.key, "/dj/initial/");
	f.select("latest");
	f.store.pause();
	f.calls[0]?.result.resolve();
	await setImmediate();
	assert.equal(f.calls[1]?.key, "/dj/latest/");
	f.calls[1]?.result.resolve();
	await setImmediate();
	assert.equal(f.commands().includes("play"), false);
	assert.ok(f.commands().includes("pause"));
	adapter.dispose();
});
