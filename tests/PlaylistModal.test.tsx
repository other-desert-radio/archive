import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import PlaylistModal from "../src/components/playlists/PlaylistModal";

test("server rendering shows loading without claiming playlists are empty", () => {
	const markup = renderToStaticMarkup(<PlaylistModal ref={null} showId={42} />);
	assert.ok(markup.includes("Loading playlists..."));
	assert.ok(!markup.includes("No playlists yet."));
	assert.ok(
		markup.indexOf("Loading playlists...") < markup.indexOf("+ New Playlist"),
	);
	assert.doesNotMatch(markup, /<textarea|Add a note/);
});
