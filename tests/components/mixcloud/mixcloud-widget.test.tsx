import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import MixcloudWidget, {
	mixcloudEmbedUrl,
	waitForMixcloudWidget,
} from "../../../src/components/mixcloud";

const miniParams = { mini: true, hide_cover: true, light: false };

function playbackApi() {
	const event = { on: () => {}, off: () => {} };
	return {
		load: async () => {},
		play: async () => {},
		pause: async () => {},
		events: { play: event, pause: event, error: event },
	};
}

test("waits for readiness before validating methods added by Mixcloud", async () => {
	let resolveReady = () => {};
	const widget = {
		ready: new Promise<void>((resolve) => {
			resolveReady = resolve;
		}),
	};
	let completed = false;
	const result = waitForMixcloudWidget(widget).then((value) => {
		completed = true;
		return value;
	});
	await Promise.resolve();
	assert.equal(completed, false);
	Object.assign(widget, playbackApi());
	resolveReady();
	assert.equal(await result, widget);
});

test("rejects missing readiness, failed readiness, and incomplete playback APIs", async () => {
	await assert.rejects(waitForMixcloudWidget({}), /readiness/);
	await assert.rejects(
		waitForMixcloudWidget({ ready: Promise.reject(new Error("blocked")) }),
		/blocked/,
	);
	await assert.rejects(
		waitForMixcloudWidget({ ready: Promise.resolve() }),
		/playback API/,
	);
});

test("embed URL preserves encoded show keys and uses the dark mini widget", () => {
	const key = "/otherdesertradio/show-%C3%B6/";
	const url = new URL(mixcloudEmbedUrl(key, miniParams));
	assert.equal(url.origin, "https://www.mixcloud.com");
	assert.equal(url.searchParams.get("feed"), key);
	assert.equal(url.searchParams.get("mini"), "1");
	assert.equal(url.searchParams.get("light"), "0");
	assert.equal(url.searchParams.has("autoplay"), false);
});

test("embed options serialize explicitly supplied boolean values", () => {
	const url = new URL(
		mixcloudEmbedUrl("/dj/show/", {
			mini: false,
			hide_cover: false,
			light: true,
		}),
	);
	assert.equal(url.searchParams.get("mini"), "0");
	assert.equal(url.searchParams.get("hide_cover"), "0");
	assert.equal(url.searchParams.get("light"), "1");
});

test("rejects URLs, profiles, and malformed cloudcast keys", () => {
	for (const key of [
		"https://www.mixcloud.com/dj/show/",
		"/dj/",
		"/dj/show/?x=1",
		"/dj/show/#x",
		"/dj/a b/",
	]) {
		assert.throws(() => mixcloudEmbedUrl(key, miniParams), /show key/);
	}
});

test("server rendering includes one labeled iframe without using browser APIs", () => {
	const html = renderToStaticMarkup(
		<MixcloudWidget
			initialCloudcastKey="/dj/show/"
			iframeParams={miniParams}
		/>,
	);
	assert.equal((html.match(/<iframe/g) ?? []).length, 1);
	assert.ok(html.includes('title="Mixcloud show player"'));
	assert.ok(html.includes('allow="autoplay"'));
	assert.ok(html.includes('data-mixcloud-widget="loading"'));
	assert.ok(
		html.includes(
			'src="' +
				mixcloudEmbedUrl("/dj/show/", miniParams).replaceAll("&", "&amp;") +
				'"',
		),
	);
});
