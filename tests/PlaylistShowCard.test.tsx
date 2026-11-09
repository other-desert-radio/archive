import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import PlaylistShowCard from "../src/components/playlists/PlaylistShowCard";
import fixture from "./res/shows.json";

test("playlist card renders playable artwork, tags, and an optional escaped note with its update date", () => {
	const show = fixture.data[0];
	assert.ok(show);
	const updatedAt = new Date(2026, 6, 10, 22, 1).toISOString();
	for (const note of [undefined, "", "Keep <b>raw</b>\nNext line"]) {
		const html = renderToStaticMarkup(
			<PlaylistShowCard
				show={{ ...show, tagIds: [1] }}
				entry={{
					showId: show.id,
					addedAt: updatedAt,
					updatedAt,
					...(note !== undefined ? { note } : {}),
				}}
				tags={new Map([[1, { id: 1, title: "Ambient", color: "#ffffff" }]])}
				record={{ positionInSeconds: 42, inProgress: true }}
			/>,
		);
		assert.match(html, /data-show-playback/);
		assert.match(html, /role="progressbar"/);
		assert.match(html, /Explore Ambient/);
		assert.doesNotMatch(html, /View Test DJ|Save to Playlist/);
		assert.equal(html.includes("Edit note for"), Boolean(note));
		assert.equal(html.includes("<time"), Boolean(note));
		if (note) {
			assert.match(html, /Jul 10, 10:01pm<\/time>/);
			assert.match(html, /Keep &lt;b&gt;raw&lt;\/b&gt;\nNext line/);
			assert.ok(html.indexOf("Explore Ambient") < html.indexOf("Jul 10"));
		}
	}
});
