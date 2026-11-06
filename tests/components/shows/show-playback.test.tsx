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
import ShowsPane from "../../../src/components/shows/ShowsPane";
import {
	AudioStore,
	createStores,
	StoresProvider,
	stores,
} from "../../../src/stores";

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

test("show listing uses the empty server snapshot even with loaded playback records", () => {
	const stores = createStores();
	stores.playbackStore.set({
		showId: show.id,
		positionInSeconds: 15,
		inProgress: true,
		history: [],
	});
	assert.equal(stores.playbackStore.getSnapshot().length, 1);
	const html = renderToStaticMarkup(
		<StoresProvider stores={stores}>
			<ShowsPane shows={[show]} showIds={[show.id]} tags={new Map()} />
		</StoresProvider>,
	);
	assert.match(html, /aria-label="Play Show"/);
	assert.doesNotMatch(html, /role="progressbar"/);
});

test("artwork progress reflects elapsed time and stays between zero and full", () => {
	for (const [positionInSeconds, percentage] of [
		[15, 25],
		[0, 0],
		[-10, 0],
		[90, 100],
	]) {
		const html = renderToStaticMarkup(
			<PlayableShowArtwork
				show={show}
				base=""
				record={{ positionInSeconds, inProgress: true }}
			/>,
		);
		assert.ok(html.includes(`aria-valuenow="${percentage}"`));
		assert.ok(html.includes(`width:${percentage}%`));
		assert.match(html, /aria-label="Playback progress for Show"/);
	}
});

test("artwork hides progress without a record or a valid duration", () => {
	const withoutRecord = renderToStaticMarkup(
		<PlayableShowArtwork show={show} base="" />,
	);
	assert.doesNotMatch(withoutRecord, /role="progressbar"/);
	for (const duration of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
		const html = renderToStaticMarkup(
			<PlayableShowArtwork
				show={{ ...show, duration }}
				base=""
				record={{ positionInSeconds: 15, inProgress: true }}
			/>,
		);
		assert.doesNotMatch(html, /role="progressbar"/);
	}
});

test("artwork shows remaining minutes and padded seconds, bounded at zero", () => {
	for (const [positionInSeconds, expected] of [
		[5, "2:00"],
		[60, "1:05"],
		[124.5, "0:01"],
		[130, "0:00"],
	] as const) {
		const html = renderToStaticMarkup(
			<PlayableShowArtwork
				show={{ ...show, duration: 125 }}
				base=""
				record={{ positionInSeconds, inProgress: true }}
			/>,
		);
		assert.ok(html.includes(`>${expected}</span>`));
	}
});

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
			<StoresProvider stores={{ ...stores, audioStore }}>
				<ShowCard show={show} tags={new Map()} />
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
			<StoresProvider stores={{ ...stores, audioStore }}>
				<PlayableShowArtwork
					show={show}
					base="/archive/"
					loading="eager"
					border="secondary"
				/>
			</StoresProvider>,
		);
	assert.match(render(), /aria-label="Play Show"/);
	assert.match(render(), /loading="eager"/);
	assert.match(render(), /image-border-secondary/);
	assert.doesNotMatch(render(), /\/archive\/\//);
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
