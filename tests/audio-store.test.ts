import assert from "node:assert/strict";
import test from "node:test";
import { AudioStore, type AudioTrack } from "../src/audio/audio-store";

const track: AudioTrack = { title: "Archive show", source: "mixcloud" };

test("starts idle and ignores playback commands without a track", () => {
	const store = new AudioStore();
	const initial = store.getSnapshot();
	store.play();
	store.pause();
	store.clear();
	assert.equal(store.getSnapshot(), initial);
	assert.deepEqual(initial, { status: "idle" });
});

test("retains the selected track through pause and resume, and clears it", () => {
	const store = new AudioStore();
	store.play(track);
	assert.deepEqual(store.getSnapshot(), { status: "playing", track });
	store.pause();
	assert.deepEqual(store.getSnapshot(), { status: "paused", track });
	store.play();
	assert.deepEqual(store.getSnapshot(), { status: "playing", track });
	store.clear();
	assert.deepEqual(store.getSnapshot(), { status: "idle" });
});

test("notifies subscribers after updating, preserves unchanged snapshots, and cleans up", () => {
	const store = new AudioStore();
	const statuses: string[] = [];
	const unsubscribe = store.subscribe(() =>
		statuses.push(store.getSnapshot().status),
	);
	store.play(track);
	const playing = store.getSnapshot();
	store.play(track);
	assert.equal(store.getSnapshot(), playing);
	store.pause();
	const paused = store.getSnapshot();
	store.pause();
	assert.equal(store.getSnapshot(), paused);
	unsubscribe();
	unsubscribe();
	store.clear();
	assert.deepEqual(statuses, ["playing", "paused"]);
});

test("late readers see current state and server hydration keeps the idle snapshot", () => {
	const store = new AudioStore();
	store.play(track);
	store.pause();
	assert.deepEqual(store.getSnapshot(), { status: "paused", track });
	assert.deepEqual(store.getServerSnapshot(), { status: "idle" });
	assert.equal(store.getServerSnapshot(), new AudioStore().getServerSnapshot());
});

test("switches sources and protects snapshots from caller mutations", () => {
	const store = new AudioStore();
	const mutableTrack = { title: "Live broadcast", source: "samcast" as const };
	store.play(track);
	store.play(mutableTrack);
	mutableTrack.title = "Changed outside the store";
	const snapshot = store.getSnapshot();
	assert.deepEqual(snapshot, {
		status: "playing",
		track: { title: "Live broadcast", source: "samcast" },
	});
	assert.ok(Object.isFrozen(snapshot));
	assert.ok(Object.isFrozen(snapshot.track));
});
