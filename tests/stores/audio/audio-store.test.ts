import assert from "node:assert/strict";
import test from "node:test";
import { AudioStore, type AudioTrack } from "../../../src/stores/audio";

const track: AudioTrack = {
	title: "Archive show",
	source: { kind: "mixcloud", cloudcastKey: "/dj/show/" },
};

function selectedTrack(store: AudioStore): AudioTrack {
	const request = store.getRequestSnapshot();
	assert.ok(request && request.action !== "clear");
	return request.track;
}

test("starts idle and ignores requests without a selected track", () => {
	const store = new AudioStore();
	const initial = store.getSnapshot();
	store.play();
	store.pause();
	store.clear();
	store.confirmPlaying(track);
	assert.equal(store.getSnapshot(), initial);
	assert.equal(store.getRequestSnapshot(), undefined);
});

test("selection publishes a load request and waits for actual playback confirmation", () => {
	const store = new AudioStore();
	store.select(track);
	const selected = selectedTrack(store);
	assert.deepEqual(store.getSnapshot(), { status: "loading", track });
	assert.deepEqual(store.getRequestSnapshot(), {
		id: 1,
		action: "load",
		track,
	});
	assert.equal(store.getSnapshot(), store.getSnapshot());
	assert.equal(store.getRequestSnapshot(), store.getRequestSnapshot());
	store.confirmPlaying(selected);
	assert.deepEqual(store.getSnapshot(), { status: "playing", track });
	assert.equal(store.getRequestSnapshot()?.id, 1);
});

test("pause and resume requests retain confirmed state until the adapter responds", () => {
	const store = new AudioStore();
	store.play(track);
	const selected = selectedTrack(store);
	store.confirmPlaying(selected);
	const playing = store.getSnapshot();
	store.pause();
	assert.equal(store.getSnapshot(), playing);
	assert.equal(store.getRequestSnapshot()?.action, "pause");
	store.confirmPaused(selected);
	const paused = store.getSnapshot();
	store.play();
	assert.equal(store.getSnapshot(), paused);
	assert.equal(store.getRequestSnapshot()?.action, "play");
	store.confirmPlaying(selected);
	assert.deepEqual(store.getSnapshot(), { status: "playing", track });
});

test("confirmation notifies state subscribers without publishing another playback request", () => {
	const store = new AudioStore();
	const statuses: string[] = [];
	const actions: string[] = [];
	const unsubscribeState = store.subscribe(() =>
		statuses.push(store.getSnapshot().status),
	);
	const unsubscribeRequests = store.subscribeRequests((request) =>
		actions.push(request.action),
	);
	store.select(track);
	const selected = selectedTrack(store);
	store.confirmPlaying(selected);
	store.confirmPlaying(selected);
	store.confirmPaused(selected);
	assert.deepEqual(statuses, ["loading", "playing", "paused"]);
	assert.deepEqual(actions, ["load"]);
	unsubscribeState();
	unsubscribeRequests();
	store.clear();
	assert.deepEqual(statuses, ["loading", "playing", "paused"]);
	assert.deepEqual(actions, ["load"]);
});

test("clearing publishes cancellation and rejects callbacks from the cleared selection", () => {
	const store = new AudioStore();
	store.select(track);
	const selected = selectedTrack(store);
	store.clear();
	store.confirmPlaying(selected);
	store.confirmPaused(selected);
	store.reportError(selected, "Late error");
	assert.deepEqual(store.getSnapshot(), { status: "idle" });
	assert.deepEqual(store.getRequestSnapshot(), { id: 2, action: "clear" });
});

test("changing sources or reselecting a show rejects previous selection callbacks", () => {
	const store = new AudioStore();
	store.select(track);
	const old = selectedTrack(store);
	store.select({
		title: "Live",
		source: { kind: "samcast", streamUrl: "https://example.com/live" },
	});
	const current = store.getSnapshot();
	store.confirmPlaying(old);
	store.reportError(old, "Old source failed");
	assert.equal(store.getSnapshot(), current);
	store.select(track);
	const reselected = store.getSnapshot();
	store.confirmPaused(old);
	assert.equal(store.getSnapshot(), reselected);
});

test("errors retain the track and resume requests enter loading without claiming playback", () => {
	const store = new AudioStore();
	store.select(track);
	const selected = selectedTrack(store);
	store.reportError(selected, "Playback blocked");
	assert.deepEqual(store.getSnapshot(), {
		status: "error",
		track,
		message: "Playback blocked",
	});
	store.play();
	assert.deepEqual(store.getSnapshot(), { status: "loading", track });
	assert.equal(store.getRequestSnapshot()?.action, "play");
});

test("latest intent can reverse a pending pause or resume before confirmation", () => {
	const store = new AudioStore();
	store.select(track);
	const selected = selectedTrack(store);
	store.confirmPlaying(selected);
	store.pause();
	store.play();
	assert.equal(store.getRequestSnapshot()?.action, "play");
	store.confirmPaused(selected);
	store.play();
	store.pause();
	assert.equal(store.getRequestSnapshot()?.action, "pause");
});

test("late adapters can read the latest request while server hydration always starts idle", () => {
	const store = new AudioStore();
	store.select(track);
	store.pause();
	assert.deepEqual(store.getRequestSnapshot(), {
		id: 2,
		action: "pause",
		track,
	});
	assert.deepEqual(store.getServerSnapshot(), { status: "idle" });
	assert.equal(store.getServerSnapshot(), new AudioStore().getServerSnapshot());
});

test("track, nested source, state and requests are immutable copies", () => {
	const store = new AudioStore();
	const mutable = {
		title: "Show",
		source: { kind: "mixcloud" as const, cloudcastKey: "/dj/first/" },
	};
	store.select(mutable);
	mutable.title = "Changed";
	mutable.source.cloudcastKey = "/dj/changed/";
	const selected = selectedTrack(store);
	assert.equal(selected.title, "Show");
	assert.deepEqual(selected.source, {
		kind: "mixcloud",
		cloudcastKey: "/dj/first/",
	});
	assert.ok(Object.isFrozen(selected));
	assert.ok(Object.isFrozen(selected.source));
	assert.ok(Object.isFrozen(store.getSnapshot()));
	assert.ok(Object.isFrozen(store.getRequestSnapshot()));
});
