import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import PlaylistModal from "../src/components/playlists/PlaylistModal";
import SaveToPlaylist, {
	SaveToPlaylistButton,
} from "../src/components/playlists/SaveToPlaylist";

test("shared button can hide a note while retaining the saved playlist titles", () => {
	for (const showNote of [true, false]) {
		const markup = renderToStaticMarkup(
			<SaveToPlaylistButton
				showId={42}
				playlistSaves={[{ playlistId: "liked", title: "Liked Shows" }]}
				note="Shared note"
				showNote={showNote}
			/>,
		);
		assert.match(markup, /Liked Shows/);
		assert.equal(markup.includes("Shared note"), showNote);
		assert.doesNotMatch(markup, /<dialog/);
	}
});

test("save control renders a loading skeleton before client initialization", () => {
	const markup = renderToStaticMarkup(<SaveToPlaylist showId={42} />);
	assert.match(markup, /role="status" aria-label="Loading playlists"/);
	assert.doesNotMatch(markup, /aria-label="Save to Playlist"/);
});

test("server rendering shows loading without claiming playlists are empty", () => {
	const markup = renderToStaticMarkup(<PlaylistModal ref={null} showId={42} />);
	assert.ok(markup.includes("Loading playlists..."));
	assert.match(markup, /<button[^>]*aria-label="New playlist"[^>]*disabled=""/);
	assert.ok(!markup.includes("No playlists yet."));
	assert.ok(
		markup.indexOf("Loading playlists...") < markup.indexOf("+ New Playlist"),
	);
	assert.doesNotMatch(markup, /<textarea|Add a note/);
});
