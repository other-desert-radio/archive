import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FullscreenTracklist } from "../../src/components/miniplayer/FullscreenDetails";
import { SaveToPlaylistButton } from "../../src/components/playlists/SaveToPlaylist";

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
