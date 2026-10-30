import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { fetchDJ } from "../src/utils/fetch-dj";
import { fetchDJs } from "../src/utils/fetch-djs";
import { fetchShows } from "../src/utils/fetch-shows";

const contracts = [
	{ name: "DJ profile", fixture: "dj.json", load: fetchDJ },
	{ name: "DJ summaries", fixture: "djs.json", load: fetchDJs },
	{ name: "shows", fixture: "shows.json", load: fetchShows },
];

for (const { name, fixture, load } of contracts) {
	for (const field of ["image_small", "image_large"]) {
		test(`${name} reject a missing ${field}`, async () => {
			const directory = await mkdtemp(join(tmpdir(), "archive-images-"));
			try {
				const data = JSON.parse(await readFile(`tests/res/${fixture}`, "utf8"));
				const record = Array.isArray(data.data) ? data.data[0] : data.data;
				delete record[field];
				const file = join(directory, "data.json");
				await writeFile(file, JSON.stringify(data));
				await assert.rejects(load(pathToFileURL(file)), /unexpected format/);
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		});
	}
}

for (const field of ["image_small", "image_large"]) {
	test(`shows reject an invalid ${field} and nested DJs missing ${field}`, async () => {
		const directory = await mkdtemp(join(tmpdir(), "archive-images-"));
		try {
			const file = join(directory, "data.json");
			const shows = await fetchShows(pathToFileURL("tests/res/shows.json"));
			await writeFile(
				file,
				JSON.stringify({
					version: 1,
					updatedAt: "2026-10-30T12:00:00.000Z",
					data: shows.map((show) => ({
						...show,
						[field]: "image with spaces.jpg",
					})),
				}),
			);
			await assert.rejects(
				fetchShows(pathToFileURL(file)),
				/unexpected format/,
			);
			const data = JSON.parse(await readFile("tests/res/shows.json", "utf8"));
			delete data.data[0].djs[0][field];
			await writeFile(file, JSON.stringify(data));
			await assert.rejects(
				fetchShows(pathToFileURL(file)),
				/unexpected format/,
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
}
