import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { fetchDJ } from "../src/utils/fetch-dj";
import { fetchDJs } from "../src/utils/fetch-djs";
import { fetchShows } from "../src/utils/fetch-shows";
import { fetchTags } from "../src/utils/fetch-tags";
import djFixture from "./res/dj.json";
import djsFixture from "./res/djs.json";
import showsFixture from "./res/shows.json";
import tagsFixture from "./res/tags.json";

for (const { name, load, fixture } of [
	{ name: "DJ profile", load: fetchDJ, fixture: djFixture },
	{ name: "DJ summaries", load: fetchDJs, fixture: djsFixture },
	{ name: "shows", load: fetchShows, fixture: showsFixture },
	{ name: "tags", load: fetchTags, fixture: tagsFixture },
]) {
	test(`${name} require an envelope with the correct payload shape`, async () => {
		const directory = await mkdtemp(join(tmpdir(), "archive-envelope-"));
		try {
			const file = join(directory, "data.json");
			for (const input of [
				fixture.data,
				{ version: 1, updatedAt: fixture.updatedAt },
				{ ...fixture, data: null },
				{ ...fixture, data: Array.isArray(fixture.data) ? {} : [] },
			]) {
				await writeFile(file, JSON.stringify(input));
				await assert.rejects(load(pathToFileURL(file)), /unexpected format/);
			}
			if (Array.isArray(fixture.data)) {
				await writeFile(file, JSON.stringify({ ...fixture, data: [] }));
				assert.deepEqual(
					await load(pathToFileURL(file)),
					name === "tags" ? new Map() : [],
				);
			}
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
}

test("loads a validated hydrated DJ from a file URL", async () => {
	const dj = await fetchDJ(pathToFileURL("tests/res/dj.json"));

	assert.deepEqual(dj, {
		id: 1,
		title: "Test DJ One",
		image_small: "images/djs/1.jpg",
		image_large: "images/djs/1_large.jpg",
		bio: "<p>Test biography.</p>",
		socials: "<p>@testdjone</p>",
		showTitle: "Test Transmission",
		showDescription: "A test DJ show.",
		shows: [],
		tagIds: [1, 2],
	});
});
