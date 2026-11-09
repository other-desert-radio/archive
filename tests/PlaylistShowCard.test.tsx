import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import PlaylistShowCard from "../src/components/playlists/PlaylistShowCard";
import fixture from "./res/shows.json";

test("playlist card hides tags and marks chins with notes while preserving playback and escaped note text", () => {
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
		assert.doesNotMatch(html, /Explore Ambient/);
		assert.match(html, new RegExp(`data-has-note="${Boolean(note)}"`));
		assert.doesNotMatch(html, /View Test DJ|Save to Playlist/);
		assert.equal(html.includes("Edit note for"), Boolean(note));
		assert.equal(html.includes("<time"), Boolean(note));
		if (note) {
			assert.match(html, /Jul 10, 10:01pm<\/time>/);
			assert.match(html, /Keep &lt;b&gt;raw&lt;\/b&gt;\nNext line/);
		}
	}
});
