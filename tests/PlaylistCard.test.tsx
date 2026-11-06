import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import PlaylistCard from "../src/components/playlists/PlaylistCard";
import PlaylistPage from "../src/pages/playlists/_PlaylistPage";

test("playlist card links the local ID and escapes its title", () => {
	const html = renderToStaticMarkup(
		<PlaylistCard
			playlist={{
				id: "local-id",
				type: "user",
				title: "<Road trip>",
				createdAt: "2026-11-06T00:00:00Z",
				updatedAt: "2026-11-06T00:00:00Z",
				shows: [],
			}}
		/>,
	);
	assert.ok(html.includes('href="/playlists/#local-id"'));
	assert.ok(html.includes('aria-label="View playlist &lt;Road trip&gt;"'));
	assert.ok(html.includes("&lt;Road trip&gt;"));
});

test("playlist page renders safely before browser storage and location are available", () => {
	const html = renderToStaticMarkup(<PlaylistPage />);
	assert.ok(html.includes("Loading playlist..."));
	assert.ok(!html.includes("Playlist not found"));
});
