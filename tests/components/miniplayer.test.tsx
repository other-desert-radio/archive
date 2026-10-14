import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import Miniplayer from "../../src/components/Miniplayer";
import { AudioStore, type AudioTrack, StoresProvider } from "../../src/stores";
import fixtureShows from "../res/shows.json";

const fixtureShow = fixtureShows[0];
if (!fixtureShow) {
	throw new Error("Expected a show fixture.");
}
const show = fixtureShow;

// Render selected UI without a browser. Production stores keep SSR idle.
class SelectedSnapshotStore extends AudioStore {
	override getServerSnapshot = () => this.getSnapshot();
}

function selectedMarkup(track: AudioTrack) {
	const audioStore = new SelectedSnapshotStore();
	audioStore.select(track);
	return renderToStaticMarkup(
		<StoresProvider stores={{ audioStore }}>
			<Miniplayer base="/archive-site" />
		</StoresProvider>,
	);
}

test("idle miniplayer renders no widget", () => {
	assert.equal(renderToStaticMarkup(<Miniplayer base="/archive-site" />), "");
});

test("Mixcloud renders one widget and one title without hover expansion", () => {
	const html = selectedMarkup({
		show: { ...show, title: "Selected show" },
		source: { kind: "mixcloud", cloudcastKey: "/dj/show/" },
	});
	assert.equal((html.match(/<iframe/g) ?? []).length, 1);
	assert.ok(html.includes("feed=%2Fdj%2Fshow%2F"));
	assert.ok(
		html.includes("mini=1&amp;hide_cover=1&amp;hide_artwork=1&amp;light=0"),
	);
	assert.equal(html.includes("data-miniplayer-expansion"), false);

	assert.equal((html.match(/<button/g) ?? []).length, 2);
	assert.ok(html.includes('type="button" aria-label="Favorite show"'));
	assert.ok(html.includes('type="button" aria-label="Expand player"'));
	assert.ok(html.includes("\u2661\uFE0E"));
	assert.ok(html.includes("\u26F6\uFE0E"));
	assert.ok(
		html.indexOf("</iframe>") < html.indexOf('aria-label="Favorite show"'),
	);
	assert.equal((html.match(/Selected show/g) ?? []).length, 3);
	assert.equal(html.includes("<dialog"), false);
});

test("SAMCast keeps its title and progress without fullscreen controls or a widget", () => {
	const html = selectedMarkup({
		show: { ...show, title: "Live broadcast" },
		source: { kind: "samcast", streamUrl: "https://example.com/live" },
	});
	assert.ok(html.includes("Live broadcast"));
	assert.equal(html.includes("<iframe"), false);
	assert.equal(html.includes("<button"), false);
	assert.equal(html.includes("<dialog"), false);
	assert.ok(html.includes('aria-hidden="true"'));
});

test("clearing a selected track removes the player content", () => {
	const audioStore = new SelectedSnapshotStore();
	audioStore.select({
		show: { ...show, title: "Selected show" },
		source: { kind: "mixcloud", cloudcastKey: "/dj/show/" },
	});
	audioStore.clear();
	assert.equal(
		renderToStaticMarkup(
			<StoresProvider stores={{ audioStore }}>
				<Miniplayer base="/archive-site" />
			</StoresProvider>,
		),
		"",
	);
});

test("metadata links each DJ and the show using the configured base path", () => {
	const html = selectedMarkup({
		show: {
			...show,
			djs: [
				{
					...show.djs[0],
					id: 12,
					title: "First DJ",
					image_small: "dj.jpg",
					image_large: "dj-large.jpg",
				},
				{
					id: 34,
					title: "Second DJ",
					image_small: "dj.jpg",
					image_large: "dj-large.jpg",
				},
			],
		},
		source: { kind: "mixcloud", cloudcastKey: "/dj/show/" },
	});
	const base = "/archive-site";
	assert.ok(
		html.includes(
			`href="${base}/djs/12" aria-label="View First DJ">First DJ</a>`,
		),
	);
	assert.ok(
		html.includes(
			`href="${base}/djs/34" aria-label="View Second DJ">Second DJ</a>`,
		),
	);
	assert.ok(
		html.includes(
			`href="${base}/shows/${show.id}" aria-label="View ${show.title}">${show.title}</a>`,
		),
	);
	assert.ok(html.includes('aria-hidden="true">|</span>'));
	assert.ok(html.indexOf("First DJ</a>") < html.indexOf("Second DJ</a>"));
	assert.equal((html.match(/<iframe/g) ?? []).length, 1);
});

test("shows without DJs keep the show link and omit the divider", () => {
	const html = selectedMarkup({
		show: { ...show, djs: [] },
		source: { kind: "mixcloud", cloudcastKey: "/dj/show/" },
	});
	assert.ok(html.includes(`aria-label="View ${show.title}"`));
	assert.equal(html.includes("/djs/"), false);
	assert.equal(html.includes('aria-hidden="true">|</span>'), false);
});
