import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("every built page hosts one hydrated, persisted miniplayer in its navigation", async () => {
	execFileSync("bun", ["run", "build"], { stdio: "pipe", timeout: 30_000 });
	const files = await readdir("dist", { recursive: true });
	const pages = files.filter((file) => file.endsWith(".html"));
	assert.ok(pages.length > 0);
	for (const page of pages) {
		const html = await readFile(`dist/${page}`, "utf8");
		const navigation = html.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/)?.[0];
		assert.ok(navigation, `${page}: missing navigation`);
		const islands = navigation.match(/<astro-island\b[^>]*>/g) ?? [];
		const players = islands.filter((island) =>
			island.includes('data-astro-transition-persist="miniplayer"'),
		);
		assert.equal(players.length, 1, `${page}: expected one persisted player`);
		assert.ok(
			players[0]?.includes('client="load"'),
			`${page}: missing hydration`,
		);
		assert.ok(
			navigation.includes("data-miniplayer"),
			`${page}: missing container`,
		);
	}
});
