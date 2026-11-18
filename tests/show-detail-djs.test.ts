import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import process from "node:process";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { isMatching } from "ts-pattern";
import { ShowDetailsExportPattern } from "../src/stores/show-details/types";
import { fetchDJ } from "../src/utils/fetch-dj";
import { fetchShows } from "../src/utils/fetch-shows";

test("show details include each associated DJ's profile and biography", {
	timeout: 30_000,
}, async () => {
	execFileSync("bun", ["run", "build"], {
		stdio: "pipe",
		timeout: 30_000,
		env: { ...process.env, NODE_ENV: "production" },
	});
	const shows = await fetchShows(pathToFileURL("public/resources/shows.json"));
	const exported: unknown = JSON.parse(
		await readFile("public/resources/show_details.json", "utf8"),
	);
	assert.ok(isMatching(ShowDetailsExportPattern, exported));
	const details = new Map(exported.data.map((detail) => [detail.id, detail]));
	for (const show of shows) {
		const html = await readFile(`dist/shows/${show.id}/index.html`, "utf8");
		const detail = details.get(show.id);
		assert.ok(detail);
		assert.equal(
			html.includes('id="description-title"'),
			Boolean(detail.description),
		);
		if (detail.description) {
			assert.ok(
				html.includes(detail.description),
				`Show ${show.id} must include its description in static HTML`,
			);
		}
		assert.equal(
			html.includes('id="tracklist-title"'),
			Boolean(detail.tracklist?.length),
		);
		if (detail.tracklist?.length) {
			const tracklistHtml = html.slice(
				html.indexOf('<ol class="tracklist"'),
				html.indexOf("</ol>", html.indexOf('<ol class="tracklist"')),
			);
			assert.equal(
				(tracklistHtml.match(/<li(?:\s[^>]*)?>/g) ?? []).length,
				detail.tracklist.length,
			);
			if (detail.description) {
				assert.ok(
					html.indexOf('id="description-title"') <
						html.indexOf('id="tracklist-title"'),
				);
			}
		}

		assert.ok(
			!html.includes("&quot;tracklist&quot;"),
			"Tracklists must not be serialized into island props",
		);
		assert.ok(html.includes('aria-label="Save to Playlist"'));
		assert.ok(html.includes("/archive/assets/icons/bookmark.svg#bookmark"));
		assert.ok(html.includes('aria-label="Playlist"'));
		assert.ok(
			html.indexOf('aria-label="Save to Playlist"') <
				html.indexOf('class="dj-name"'),
		);
		assert.equal(
			(html.match(/class="show-dj"/g) ?? []).length,
			show.djs.length,
		);
		for (const { id } of show.djs) {
			const dj = await fetchDJ(
				pathToFileURL(`public/resources/djs/${id}.json`),
			);
			assert.ok(html.includes(`aria-labelledby="dj-${id}"`));
			assert.ok(html.includes(`href="/archive/djs/${id}"`));
			if (dj.image_large) {
				assert.ok(html.includes(`src="/archive/${dj.image_large}"`));
			}
			if (dj.bio) {
				assert.ok(html.includes(dj.bio));
			}
		}
	}
});
