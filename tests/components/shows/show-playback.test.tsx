import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
	isSelectedShow,
	mixcloudShowTrack,
	ShowCard,
	toggleShowPlayback,
} from "../../../src/components/shows";
import PlayableShowArtwork from "../../../src/components/shows/PlayableShowArtwork";
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
		show,
		source: { kind: "mixcloud", cloudcastKey: "/dj/show/" },
	});
	for (const url of [
		"https://example.com/dj/show/",
		"https://www.mixcloud.com/dj/",
		"https://www.mixcloud.com.evil.com/dj/show/",
		"http://www.mixcloud.com/dj/show/",
	]) {
		assert.throws(() => mixcloudShowTrack({ ...show, url }));
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
		...show,
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

test("detail artwork shares player state and loads its image eagerly", () => {
	const audioStore = new SelectedSnapshotStore();
	const render = () =>
		renderToStaticMarkup(
			<StoresProvider stores={{ audioStore }}>
				<PlayableShowArtwork
					show={show}
					base="/archive-site/"
					loading="eager"
					border="secondary"
				/>
			</StoresProvider>,
		);
	assert.match(render(), /aria-label="Play Show"/);
	assert.match(render(), /loading="eager"/);
	assert.match(render(), /image-border-secondary/);
	assert.doesNotMatch(render(), /\/archive-site\/\//);
	audioStore.select(mixcloudShowTrack(show));
	assert.match(render(), /aria-label="Pause Show"/);
	assert.match(render(), /data-selected="true"/);
	const request = audioStore.getRequestSnapshot();
	assert.ok(request && request.action === "load");
	audioStore.confirmPaused(request.track);
	assert.match(render(), /aria-label="Play Show"/);
});

test("full show metadata survives playback requests and state transitions", () => {
	const selectedShow = {
		...show,
		djs: [
			{
				id: 2,
				title: "DJ",
				image_small: "dj.jpg",
				image_large: "dj-large.jpg",
			},
		],
		tagIds: [1, 2],
	};
	const track = mixcloudShowTrack(selectedShow);
	assert.equal(track.show, selectedShow);
	const store = new AudioStore();
	store.select(track);
	const request = store.getRequestSnapshot();
	assert.ok(request && request.action === "load");
	assert.equal(request.track.show, selectedShow);
	store.confirmPlaying(request.track);
	store.pause();
	store.confirmPaused(request.track);
	store.play();
	store.reportError(request.track, "Playback failed");
	const state = store.getSnapshot();
	assert.ok(state.status === "error");
	assert.equal(state.track.show, selectedShow);
	const resume = store.getRequestSnapshot();
	assert.ok(resume && resume.action === "play");
	assert.equal(resume.track.show, selectedShow);
});
