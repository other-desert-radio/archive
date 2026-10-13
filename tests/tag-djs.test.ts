import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { fetchDJ } from "../src/utils/fetch-dj";
import { fetchDJs } from "../src/utils/fetch-djs";
import { fetchShows } from "../src/utils/fetch-shows";
import { fetchTags } from "../src/utils/fetch-tags";

test("tag pages render only matching DJ cards with profiles and detail links", async () => {
	execFileSync("bun", ["run", "build"], { stdio: "pipe", timeout: 30_000 });
	const summaries = await fetchDJs(pathToFileURL("src/res/djs_brief.json"));
	const profiles = await Promise.all(
		summaries.map(({ id }) => fetchDJ(pathToFileURL(`src/res/djs/${id}.json`))),
	);
	const tags = await fetchTags(pathToFileURL("src/res/tags.json"));
	const shows = await fetchShows(pathToFileURL("src/res/shows.json"));
	for (const tag of tags.values()) {
		const html = await readFile(`dist/tags/${tag.id}/index.html`, "utf8");
		assert.ok(html.includes('href="/archive-site/explore"'));
		for (const show of shows.filter((show) => show.tagIds.includes(tag.id))) {
			assert.ok(
				html.includes(
					`href="/archive-site/shows/${show.id}?fromTag=${tag.id}"`,
				),
			);
		}
		assert.equal(
			html.includes('aria-labelledby="tag-shows-heading"'),
			shows.some((show) => show.tagIds.includes(tag.id)),
			`tag ${tag.id}: shows section visibility`,
		);
		const cards =
			html.match(/<a\b[^>]*class="dj-explore-card"[^>]*>[\s\S]*?<\/a>/g) ?? [];
		const matching = profiles.filter((dj) => dj.tagIds.includes(tag.id));
		assert.equal(
			html.includes('aria-labelledby="tag-djs-heading"'),
			matching.length > 0,
			`tag ${tag.id}: DJs section visibility`,
		);
		assert.equal(cards.length, matching.length, `tag ${tag.id}: card count`);
		for (const [index, dj] of matching.entries()) {
			const card = cards[index];
			assert.ok(card);
			assert.ok(
				card.includes(`href="/archive-site/djs/${dj.id}?fromTag=${tag.id}"`),
			);
			assert.ok(card.includes(`aria-label="View ${dj.title}"`));
			assert.ok(card.includes(`src="/archive-site/${dj.image_large}"`));
			assert.ok(card.includes(`alt="${dj.title}"`));
			assert.ok(card.includes(dj.bio), `tag ${tag.id}: DJ ${dj.id} bio`);
		}
	}
});
