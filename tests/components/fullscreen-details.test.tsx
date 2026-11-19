import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import FullscreenDetails, {
	FullscreenTracklist,
} from "../../src/components/miniplayer/FullscreenDetails";
import { SaveToPlaylistButton } from "../../src/components/playlists/SaveToPlaylist";
import {
	AudioStore,
	type AudioTrack,
	StoresProvider,
	stores,
} from "../../src/stores";
import fixtureShows from "../res/shows.json";

test("empty tracklists omit the section", () => {
	assert.equal(renderToStaticMarkup(<FullscreenTracklist entries={[]} />), "");
});

test("tracklists preserve song and chapter order and escape content", () => {
	const html = renderToStaticMarkup(
		<FullscreenTracklist
			entries={[
				{ artist: "Artist & guest", song: "Song" },
				{ chapter: "<Final chapter>" },
			]}
		/>,
	);
	assert.ok(html.includes("TRACKLIST"));
	assert.ok(html.includes("Artist &amp; guest — Song"));
	assert.ok(html.includes("&lt;Final chapter&gt;"));
	assert.ok(html.indexOf("Artist") < html.indexOf("Final chapter"));
});

test("playlist control reflects unsaved and saved membership", () => {
	const unsaved = renderToStaticMarkup(
		<SaveToPlaylistButton showId={1} playlistSaves={[]} showNote={false} />,
	);
	const saved = renderToStaticMarkup(
		<SaveToPlaylistButton
			showId={1}
			playlistSaves={[{ playlistId: "test", title: "Favorites" }]}
			showNote={false}
		/>,
	);
	assert.ok(unsaved.includes("Save to Playlist"));
	assert.ok(saved.includes("bookmark-filled.svg"));
	assert.ok(saved.includes("Favorites"));
});

test("fullscreen keeps one accessible title and hides decorative repeats", () => {
	const show = fixtureShows.data[0];
	assert.ok(show);
	const html = renderToStaticMarkup(
		<FullscreenDetails
			show={{ ...show, title: "Marquee title" }}
			base="/archive"
			onNavigate={() => {}}
		/>,
	);
	assert.ok(html.includes('data-has-tracklist="false"'));
	assert.ok(html.includes('data-playing="false"'));
	assert.ok(html.includes('aria-label="View Marquee title"'));
	assert.ok(html.includes('aria-hidden="true"'));
	assert.equal((html.match(/<span>Marquee title<\/span>/g) ?? []).length, 19);
});

test("marquee runs only for confirmed playback", () => {
	const show = fixtureShows.data[0];
	assert.ok(show);
	class SelectedSnapshotStore extends AudioStore {
		override getServerSnapshot = () => this.getSnapshot();
	}
	const audioStore = new SelectedSnapshotStore();
	const track: AudioTrack = {
		show,
		source: { kind: "mixcloud", cloudcastKey: "/dj/show/" },
	};
	const render = () =>
		renderToStaticMarkup(
			<StoresProvider stores={{ ...stores, audioStore }}>
				<FullscreenDetails show={show} base="/archive" onNavigate={() => {}} />
			</StoresProvider>,
		);
	audioStore.select(track);
	assert.ok(render().includes('data-playing="false"'));
	const selected = audioStore.getSnapshot();
	assert.ok(selected.status !== "idle");
	audioStore.confirmPlaying(selected.track);
	assert.ok(render().includes('data-playing="true"'));
	audioStore.confirmPaused(selected.track);
	assert.ok(render().includes('data-playing="false"'));
});
