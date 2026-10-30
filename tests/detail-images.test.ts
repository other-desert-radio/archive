import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { fetchDJ } from "../src/utils/fetch-dj";
import { fetchDJs } from "../src/utils/fetch-djs";
import { fetchShows } from "../src/utils/fetch-shows";

const escapeAttribute = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#x27;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");

test("built show and DJ detail pages render large artwork with alt text and page-specific tag sizes", async () => {
	execFileSync("bun", ["run", "build"], { stdio: "pipe", timeout: 30_000 });
	const shows = await fetchShows(pathToFileURL("src/res/shows.json"));
	const djs = await fetchDJs(pathToFileURL("src/res/djs_brief.json"));
	const profiles = await Promise.all(
		djs.map((dj) => fetchDJ(pathToFileURL(`src/res/djs/${dj.id}.json`))),
	);
	for (const [category, records] of [
		["shows", shows],
		["djs", profiles],
	] as const) {
		for (const record of records) {
			const html = await readFile(
				`dist/${category}/${record.id}/index.html`,
				"utf8",
			);
			const tagClass = "tag tag-large";
			const tags =
				html.match(new RegExp(`<a\\b[^>]*class="${tagClass}"[^>]*>`, "g")) ??
				[];
			assert.equal(
				tags.length,
				record.tagIds.length,
				`${category}/${record.id} should render large tags`,
			);
			const image = (html.match(/<img\b[^>]*>/g) ?? []).find((tag) =>
				tag.includes(
					`src="${category === "djs" ? "/archive-site/" : ""}${escapeAttribute(record.image_large)}"`,
				),
			);
			assert.ok(image, `${category}/${record.id} should render large artwork`);
			assert.doesNotMatch(image, /loading="lazy"/);
			assert.match(image, /decoding="async"/);
			assert.ok(
				image.includes(`alt="${escapeAttribute(record.title)}"`),
				`${category}/${record.id}: ${image}`,
			);
		}
	}
});
