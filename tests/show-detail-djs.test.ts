import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { fetchDJ } from "../src/utils/fetch-dj";
import { fetchShows } from "../src/utils/fetch-shows";

test("show details include each associated DJ's profile and biography", async () => {
	execFileSync("bun", ["run", "build"], { stdio: "pipe", timeout: 30_000 });
	const shows = await fetchShows(pathToFileURL("src/res/shows.json"));
	for (const show of shows) {
		const html = await readFile(`dist/shows/${show.id}/index.html`, "utf8");
		assert.equal(
			(html.match(/class="show-dj"/g) ?? []).length,
			show.djs.length,
		);
		for (const { id } of show.djs) {
			const dj = await fetchDJ(pathToFileURL(`src/res/djs/${id}.json`));
			assert.ok(html.includes(`aria-labelledby="dj-${id}"`));
			assert.ok(html.includes(`href="/archive-site/djs/${id}"`));
			assert.ok(html.includes(`src="/archive-site/${dj.image_large}"`));
			assert.ok(html.includes(dj.bio));
		}
	}
});
