import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { setImmediate } from "node:timers/promises";
import {
	MixcloudAdapter,
	type MixcloudWidget,
} from "../../../src/components/mixcloud";
import { createIndexedDB } from "../../../src/database/indexed-db";
import { AudioStore } from "../../../src/stores/audio";
import { PlaybackStore } from "../../../src/stores/playback/playback-store";
import fixtureShows from "../../res/shows.json";

const fixtureShow = fixtureShows.data[0];
if (!fixtureShow) {
	throw new Error("Expected a show fixture.");
}
const show = fixtureShow;

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
	let elapsed = 0;
	const database = createIndexedDB();
	const objectStore = database.getObjectStore("playback");
	mock.method(objectStore, "getAll", async () => []);
	mock.method(database, "getObjectStore", () => objectStore);
	const writes = mock.method(database, "transaction", async () => {});
	const playback = new PlaybackStore(database, {
		now: () => 100000 + elapsed,
	});
	const ready = deferred<MixcloudWidget>();
	const calls: {
		key: string;
		autoplay: boolean;
		result: ReturnType<typeof deferred<void>>;
	}[] = [];
	const playbackCommands: string[] = [];
	const event = () => {
		const listeners = new Set<(position: number, duration: number) => void>();
		return {
			on: (listener: (position: number, duration: number) => void) => {
				listeners.add(listener);
			},
			off: (listener: (position: number, duration: number) => void) => {
				listeners.delete(listener);
			},
			emit: (position = 0, duration = 3600) => {
				for (const listener of listeners) {
					listener(position, duration);
				}
			},
			listeners,
		};
	};
	const events = {
		play: event(),
		pause: event(),
		error: event(),
		progress: event(),
		buffering: event(),
		ended: event(),
	};
	const seeks: number[] = [];
	const widget: MixcloudWidget = {
		seek: async (position) => {
			seeks.push(position);
			return true;
		},
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
		events,
	};
	const select = (name: string, id = show.id) =>
		store.select({
			show: { ...show, id, title: name },
			source: { kind: "mixcloud", cloudcastKey: `/dj/${name}/` },
		});
	return {
		store,
		playback,
		writes,
		seeks,
		advance: (ms: number) => {
			elapsed += ms;
		},
		events,
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
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
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
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
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
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
	f.select("first");
	f.ready.resolve(f.widget);
	await setImmediate();
	f.calls[0]?.result.reject(new Error("load failed"));
	await setImmediate();
	assert.equal(f.store.getSnapshot().status, "error");
	f.store.play();
	await setImmediate();
	assert.equal(f.calls.length, 2);
	f.calls[1]?.result.resolve();
	adapter.dispose();
});

test("a superseded load error cannot overwrite a newer selection", async () => {
	const f = fixture();
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
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
		const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
		f.select("first");
		if (action === "clear") f.store.clear();
		else
			f.store.select({
				show: { ...show, title: "Live" },
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
		const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
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
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
	f.select("first");
	f.ready.reject(new Error("not ready"));
	await setImmediate();
	assert.equal(f.store.getSnapshot().status, "error");
	adapter.dispose();
});

test("selection plays after loading but does not confirm playback", async () => {
	const f = fixture();
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
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
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
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
		const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
		f.select("first");
		f.ready.resolve(f.widget);
		await setImmediate();
		f.calls[0]?.result.resolve();
		await setImmediate();
		if (action === "clear") {
			f.store.clear();
		} else {
			f.store.select({
				show: { ...show, title: "Live" },
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
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
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
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
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
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
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
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
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

test("widget controls confirm playback and recover from widget errors without new requests", async () => {
	const f = fixture();
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
	f.select("first");
	f.ready.resolve(f.widget);
	await setImmediate();
	f.events.play.emit();
	assert.equal(f.store.getSnapshot().status, "loading");
	f.calls[0]?.result.resolve();
	await setImmediate();
	const request = f.store.getRequestSnapshot();
	f.events.play.emit();
	assert.equal(f.store.getSnapshot().status, "playing");
	f.events.pause.emit();
	assert.equal(f.store.getSnapshot().status, "paused");
	f.events.error.emit();
	assert.equal(f.store.getSnapshot().status, "error");
	f.events.play.emit();
	assert.equal(f.store.getSnapshot().status, "playing");
	assert.equal(f.store.getRequestSnapshot(), request);
	adapter.dispose();
});

test("events from the old show or an in-flight load cannot confirm a newer selection", async () => {
	const f = fixture();
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
	f.select("first");
	f.ready.resolve(f.widget);
	await setImmediate();
	f.calls[0]?.result.resolve();
	await setImmediate();
	f.select("next");
	for (const event of Object.values(f.events)) {
		event.emit();
	}
	assert.equal(f.store.getSnapshot().status, "loading");
	await setImmediate();
	for (const event of Object.values(f.events)) {
		event.emit();
	}
	assert.equal(f.store.getSnapshot().status, "loading");
	f.calls[1]?.result.resolve();
	await setImmediate();
	f.events.play.emit();
	assert.equal(f.store.getSnapshot().status, "playing");
	f.store.clear();
	for (const event of Object.values(f.events)) {
		event.emit();
	}
	assert.equal(f.store.getSnapshot().status, "idle");
	adapter.dispose();
});

test("disposal removes exact listeners and queued callbacks cannot update state", async () => {
	const f = fixture();
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
	f.select("first");
	f.ready.resolve(f.widget);
	await setImmediate();
	f.calls[0]?.result.resolve();
	await setImmediate();
	const callbacks = Object.values(f.events).flatMap((event) => [
		...event.listeners,
	]);
	assert.equal(callbacks.length, 6);
	adapter.dispose();
	adapter.dispose();
	for (const event of Object.values(f.events)) {
		assert.equal(event.listeners.size, 0);
	}
	for (const callback of callbacks) {
		callback(0, 3600);
	}
	assert.equal(f.store.getSnapshot().status, "loading");
});

test("selection waits for local storage before loading the widget", async () => {
	const f = fixture();
	const storage = deferred<void>();
	mock.method(f.playback, "initialize", () => storage.promise);
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
	f.select("first");
	f.ready.resolve(f.widget);
	await setImmediate();
	assert.equal(f.calls.length, 0);
	storage.resolve();
	await setImmediate();
	assert.equal(f.calls.length, 1);
	adapter.dispose();
});

test("resumes unfinished records on confirmed play; completed records start at zero", async () => {
	for (const inProgress of [true, false]) {
		const f = fixture();
		f.playback.set({
			showId: show.id,
			inProgress,
			positionInSeconds: 120,
			history: [],
		});
		const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
		f.select("resume");
		f.ready.resolve(f.widget);
		await setImmediate();
		assert.deepEqual(f.seeks, []);
		f.widget.seek = async (position) => {
			assert.deepEqual(f.commands(), ["play"]);
			f.seeks.push(position);
			return true;
		};
		f.calls[0]?.result.resolve();
		await setImmediate();
		assert.deepEqual(f.seeks, []);
		f.events.play.emit();
		await setImmediate();
		assert.deepEqual(f.seeks, inProgress ? [120] : []);
		assert.deepEqual(f.commands(), ["play"]);
		adapter.dispose();
	}
});

test("progress preserves an unfinished listen across buffering and pauses until completion", async () => {
	const f = fixture();
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
	f.select("tracked");
	f.ready.resolve(f.widget);
	await setImmediate();
	f.calls[0]?.result.resolve();
	await setImmediate();
	f.events.play.emit();
	f.events.progress.emit(10);
	assert.equal(f.playback.get(show.id)?.history.length, 1);
	f.events.progress.emit(11);
	f.advance(11_000);
	f.events.progress.emit(22);
	f.events.buffering.emit();
	f.advance(60_000);
	f.events.progress.emit(23);
	assert.equal(f.playback.get(show.id)?.history[0]?.completedAt, undefined);
	f.events.pause.emit();
	f.advance(60_000);
	f.events.progress.emit(24);
	assert.equal(f.playback.get(show.id)?.positionInSeconds, 23);
	f.events.play.emit();
	f.events.progress.emit(25);
	f.advance(1000);
	f.events.progress.emit(26);
	assert.equal(f.playback.get(show.id)?.history.length, 1);
	assert.equal(f.playback.get(show.id)?.history[0]?.startPosition, 10);
	assert.equal(f.playback.get(show.id)?.history[0]?.completedAt, undefined);
	f.events.ended.emit();
	const completed = f.playback.get(show.id);
	assert.equal(completed?.inProgress, false);
	assert.equal(completed?.history[0]?.completedAt, 232000);
	f.events.ended.emit();
	f.events.progress.emit(27);
	assert.deepEqual(f.playback.get(show.id), completed);
	f.store.play();
	await setImmediate();
	assert.deepEqual(f.seeks, [0]);
	f.events.play.emit();
	f.events.progress.emit(0);
	f.events.progress.emit(1);
	assert.equal(f.playback.get(show.id)?.history.length, 2);
	adapter.dispose();
});

test("superseded events cannot add history and clear preserves the unfinished session", async () => {
	const f = fixture();
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
	f.select("first");
	f.ready.resolve(f.widget);
	await setImmediate();
	f.calls[0]?.result.resolve();
	await setImmediate();
	f.events.play.emit();
	f.events.progress.emit(0);
	f.events.progress.emit(1);
	f.store.clear();
	assert.equal(f.playback.get(show.id)?.history[0]?.completedAt, undefined);
	assert.equal(f.playback.get(show.id)?.inProgress, true);
	f.events.progress.emit(100);
	assert.equal(f.playback.get(show.id)?.positionInSeconds, 1);
	adapter.dispose();
});

test("switching away or clearing and reselecting resumes the same unfinished listen", async () => {
	for (const action of ["switch", "clear"] as const) {
		const f = fixture();
		let adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
		f.select("first");
		f.ready.resolve(f.widget);
		await setImmediate();
		f.calls[0]?.result.resolve();
		await setImmediate();
		f.events.play.emit();
		f.events.progress.emit(10);
		f.advance(10_000);
		f.events.progress.emit(20);
		const original = f.playback.get(show.id)?.history[0];
		assert.ok(original);
		if (action === "switch") {
			f.select("other", show.id + 1);
			await setImmediate();
			f.calls[1]?.result.resolve();
			await setImmediate();
			f.events.play.emit();
			f.events.progress.emit(0);
		} else {
			f.store.clear();
			adapter.dispose();
			adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
		}
		f.select("first");
		await setImmediate();
		f.calls.at(-1)?.result.resolve();
		await setImmediate();
		f.events.play.emit();
		await setImmediate();
		f.events.progress.emit(21);
		const resumed = f.playback.get(show.id);
		assert.equal(resumed?.history.length, 1);
		assert.equal(resumed?.history[0]?.startedAt, original.startedAt);
		assert.equal(resumed?.history[0]?.startPosition, original.startPosition);
		assert.equal(resumed?.history[0]?.completedAt, undefined);
		assert.equal(resumed?.positionInSeconds, 21);
		assert.deepEqual(f.seeks, [20]);
		adapter.dispose();
	}
});

test("latest pause or selection wins while resume seek is pending", async () => {
	for (const action of ["pause", "select"] as const) {
		const f = fixture();
		f.playback.set({
			showId: show.id,
			inProgress: true,
			positionInSeconds: 120,
			history: [],
		});
		const seeking = deferred<boolean>();
		f.widget.seek = () => seeking.promise;
		const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
		f.select("first");
		f.ready.resolve(f.widget);
		await setImmediate();
		f.calls[0]?.result.resolve();
		await setImmediate();
		f.events.play.emit();
		await setImmediate();
		f.events.progress.emit(0);
		f.events.progress.emit(1);
		assert.equal(f.playback.get(show.id)?.history.length, 0);
		if (action === "pause") {
			f.store.pause();
			f.events.pause.emit();
		} else {
			f.select("next");
		}
		seeking.resolve(true);
		await setImmediate();
		assert.equal(
			f.commands().filter((command) => command === "play").length,
			1,
		);
		if (action === "pause") {
			assert.equal(f.store.getSnapshot().status, "paused");
		}
		if (action === "select") {
			assert.equal(f.calls[1]?.key, "/dj/next/");
		}
		adapter.dispose();
	}
});

test("failed or refused seeking reports the problem and still allows playback", async () => {
	const log = mock.method(console, "error", () => {});
	try {
		for (const failure of ["refused", "rejected"] as const) {
			const f = fixture();
			f.playback.set({
				showId: show.id,
				inProgress: true,
				positionInSeconds: 120,
				history: [],
			});
			f.widget.seek = async () => {
				if (failure === "rejected") {
					throw new Error("Seek failed");
				}
				return false;
			};
			const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
			f.select("first");
			f.ready.resolve(f.widget);
			await setImmediate();
			f.calls[0]?.result.resolve();
			await setImmediate();
			assert.deepEqual(f.commands(), ["play"]);
			f.events.play.emit();
			await setImmediate();
			f.events.progress.emit(0);
			f.events.progress.emit(1);
			assert.equal(f.playback.get(show.id)?.history[0]?.startPosition, 0);
			adapter.dispose();
		}
		assert.equal(log.mock.callCount(), 2);
	} finally {
		log.mock.restore();
	}
});

test("failed storage initialization permits playback without overwriting unread history", async () => {
	const f = fixture();
	const initialize = mock.method(f.playback, "initialize", async () => {
		throw new Error("Storage unavailable");
	});
	const log = mock.method(console, "error", () => {});
	const adapter = new MixcloudAdapter(f.store, f.ready.promise, f.playback);
	try {
		f.select("first");
		f.ready.resolve(f.widget);
		await setImmediate();
		f.calls[0]?.result.resolve();
		await setImmediate();
		assert.deepEqual(f.commands(), ["play"]);
		f.events.play.emit();
		f.events.progress.emit(0);
		f.events.progress.emit(12);
		assert.equal(f.playback.get(show.id), undefined);
		assert.equal(initialize.mock.callCount(), 1);
	} finally {
		adapter.dispose();
		log.mock.restore();
	}
});
