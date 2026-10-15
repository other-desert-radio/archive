import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("every built page hosts one hydrated, persisted miniplayer below its navigation", async () => {
	execFileSync("bun", ["run", "build"], { stdio: "pipe", timeout: 30_000 });
	const files = await readdir("dist", { recursive: true });
	const pages = files.filter((file) => file.endsWith(".html"));
	assert.ok(pages.length > 0);
	for (const page of pages) {
		const html = await readFile(`dist/${page}`, "utf8");
		const isCategoryPage = [
			"index.html",
			"djs/index.html",
			"explore/index.html",
			"history/index.html",
		].includes(page);
		assert.equal(
			html.includes('name="astro-view-transitions-enabled"'),
			isCategoryPage,
			`${page}: client routing is limited to category pages`,
		);
		for (const link of html.match(/<a\b[^>]*>/g) ?? []) {
			if (/href="[^"?]*\/(djs|shows|tags)\/\d+(?:\?[^"]*)?"/.test(link)) {
				assert.ok(
					link.includes("data-astro-reload"),
					`${page}: detail link must bypass the router: ${link}`,
				);
			}
		}
		const navigation = html.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/)?.[0];
		assert.ok(navigation, `${page}: missing navigation`);
		const header = html.match(/<header\b[^>]*>[\s\S]*?<\/header>/)?.[0];
		assert.ok(header, `${page}: missing shared header`);
		assert.ok(
			!navigation.includes("<astro-island"),
			`${page}: player must be outside navigation`,
		);
		assert.ok(
			/<\/nav>\s*<div[^>]*data-miniplayer-bar/.test(header),
			`${page}: missing player bar below navigation`,
		);
		const islands = header.match(/<astro-island\b[^>]*>/g) ?? [];
		const players = islands.filter((island) =>
			island.includes('data-astro-transition-persist="miniplayer"'),
		);
		assert.equal(players.length, 1, `${page}: expected one persisted player`);
		assert.ok(
			players[0]?.includes('client="load"'),
			`${page}: missing hydration`,
		);
		assert.ok(
			!header.includes('data-miniplayer="'),
			`${page}: idle player should have no visible container`,
		);
	}
});
