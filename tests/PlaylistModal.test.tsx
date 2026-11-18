import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import PlaylistModal from "../src/components/playlists/PlaylistModal";
import SaveToPlaylist from "../src/components/playlists/SaveToPlaylist";

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
