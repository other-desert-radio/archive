import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import Miniplayer from "../../src/components/Miniplayer";
import { AudioStore, type AudioTrack, StoresProvider } from "../../src/stores";

// Render selected UI without a browser. Production stores keep SSR idle.
class SelectedSnapshotStore extends AudioStore {
	override getServerSnapshot = () => this.getSnapshot();
}

function selectedMarkup(track: AudioTrack) {
	const audioStore = new SelectedSnapshotStore();
	audioStore.select(track);
	return renderToStaticMarkup(
		<StoresProvider stores={{ audioStore }}>
			<Miniplayer />
		</StoresProvider>,
	);
}

test("idle miniplayer renders no widget", () => {
	assert.equal(renderToStaticMarkup(<Miniplayer />), "");
});

test("Mixcloud compact UI renders one widget without duplicate title or progress", () => {
	const html = selectedMarkup({
		title: "Selected show",
		source: { kind: "mixcloud", cloudcastKey: "/dj/show/" },
	});
	assert.equal((html.match(/<iframe/g) ?? []).length, 1);
	assert.ok(html.includes("feed=%2Fdj%2Fshow%2F"));
	assert.ok(html.includes("mini=1&amp;hide_cover=1&amp;light=0"));
	assert.equal(html.includes("Selected show"), false);
	assert.equal(html.includes('aria-hidden="true"'), false);
	assert.ok(/<button[^>]*disabled/.test(html));
	assert.equal(html.includes("<dialog"), false);
});

test("SAMCast keeps its title and enabled fullscreen scaffold without a widget", () => {
	const html = selectedMarkup({
		title: "Live broadcast",
		source: { kind: "samcast", streamUrl: "https://example.com/live" },
	});
	assert.ok(html.includes("Live broadcast"));
	assert.equal(html.includes("<iframe"), false);
	assert.equal(html.includes("disabled"), false);
	assert.ok(html.includes('aria-hidden="true"'));
});
