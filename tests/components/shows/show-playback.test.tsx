import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ShowCard from "../../../src/components/shows/ShowCard";
import {
	isSelectedShow,
	mixcloudShowTrack,
	toggleShowPlayback,
} from "../../../src/components/shows/show-playback";
import { AudioStore, StoresProvider } from "../../../src/stores";

const show = {
	id: 1,
	title: "Show",
	url: "https://www.mixcloud.com/dj/show/?utm_source=archive",
	date: "2026-09-07T00:00:00.000Z",
	duration: 60,
	image_small: "small.jpg",
	image_large: "large.jpg",
	djs: [],
	tagIds: [],
};

class SelectedSnapshotStore extends AudioStore {
	override getServerSnapshot = () => this.getSnapshot();
}

test("show URLs become keys without tracking params and reject other sources", () => {
	assert.deepEqual(mixcloudShowTrack(show), {
		title: "Show",
		source: { kind: "mixcloud", cloudcastKey: "/dj/show/" },
	});
	for (const url of [
		"https://example.com/dj/show/",
		"https://www.mixcloud.com/dj/",
		"https://www.mixcloud.com.evil.com/dj/show/",
		"http://www.mixcloud.com/dj/show/",
	]) {
		assert.throws(() => mixcloudShowTrack({ title: "Show", url }));
	}
});

test("card selects, pauses pending/playing audio, and resumes the same selection", () => {
	const store = new AudioStore();
	const track = mixcloudShowTrack(show);
	toggleShowPlayback(store, track);
	const request = store.getRequestSnapshot();
	assert.ok(request && request.action === "load");
	assert.equal(isSelectedShow(store.getSnapshot(), track), true);
	toggleShowPlayback(store, track);
	assert.equal(store.getRequestSnapshot()?.action, "pause");
	store.confirmPlaying(request.track);
	toggleShowPlayback(store, track);
	assert.equal(store.getRequestSnapshot()?.action, "pause");
	store.confirmPaused(request.track);
	toggleShowPlayback(store, track);
	assert.equal(store.getRequestSnapshot()?.action, "play");
	const resume = store.getRequestSnapshot();
	assert.ok(resume && resume.action !== "clear");
	assert.equal(resume.track, request.track);
	const next = mixcloudShowTrack({
		title: "Next",
		url: "https://mixcloud.com/dj/next/",
	});
	toggleShowPlayback(store, next);
	assert.equal(store.getRequestSnapshot()?.action, "load");
	assert.equal(isSelectedShow(store.getSnapshot(), track), false);
});

test("card renders accessible play/pause controls and retains the selected overlay", () => {
	const audioStore = new SelectedSnapshotStore();
	const render = () =>
		renderToStaticMarkup(
			<StoresProvider stores={{ audioStore }}>
				<ShowCard show={show} base="/archive-site" tags={new Map()} />
			</StoresProvider>,
		);
	assert.ok(render().includes('aria-label="Play Show"'));
	assert.ok(render().includes('data-selected="false"'));
	audioStore.select(mixcloudShowTrack(show));
	assert.ok(render().includes('aria-label="Pause Show"'));
	const request = audioStore.getRequestSnapshot();
	assert.ok(request && request.action === "load");
	audioStore.confirmPlaying(request.track);
	assert.ok(render().includes('aria-label="Pause Show"'));
	assert.ok(render().includes('data-selected="true"'));
	audioStore.confirmPaused(request.track);
	assert.ok(render().includes('aria-label="Play Show"'));
	assert.ok(render().includes('data-selected="true"'));
});
