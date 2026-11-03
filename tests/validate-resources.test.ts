import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	mkdir,
	mkdtemp,
	readFile,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { validateResources } from "../scripts/validate-resources";
import profile from "./res/dj.json";
import djs from "./res/djs.json";
import shows from "./res/shows.json";
import tags from "./res/tags.json";

async function fixture(run: (directory: string) => Promise<void>) {
	const directory = await mkdtemp(join(tmpdir(), "archive-validation-"));
	try {
		await mkdir(join(directory, "djs"));
		const revision = { id: 1, updatedAt: tags.updatedAt };
		for (const [filename, value] of Object.entries({
			"shows.json": shows,
			"djs_brief.json": djs,
			"tags.json": tags,
			"data_versions.json": { shows: revision, djs: revision, tags: revision },
			"djs/1.json": profile,
			"djs/2.json": { ...profile, data: { ...profile.data, id: 2 } },
		})) {
			await writeFile(join(directory, filename), JSON.stringify(value));
		}
		await run(directory);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

async function replace(directory: string, filename: string, value: unknown) {
	await writeFile(join(directory, filename), JSON.stringify(value));
}

test("valid exports and existing permissive profile fields pass", async () => {
	await fixture(async (directory) => {
		await validateResources(directory);
		await replace(directory, "djs/1.json", {
			...profile,
			data: {
				...profile.data,
				bio: null,
				image_small: undefined,
				shows: [null, "legacy"],
				extra: true,
			},
		});
		const revision = { id: 1, updatedAt: tags.updatedAt };
		await replace(directory, "data_versions.json", {
			shows: revision,
			djs: revision,
			tags: revision,
			extra: null,
		});
		await validateResources(directory);
	});
});

test("empty catalogs with an empty profile directory pass", async () => {
	await fixture(async (directory) => {
		for (const filename of ["shows.json", "djs_brief.json", "tags.json"]) {
			await replace(directory, filename, { ...tags, data: [] });
		}
		await rm(join(directory, "djs/1.json"));
		await rm(join(directory, "djs/2.json"));
		await validateResources(directory);
	});
});

const invalidCases = [
	{
		name: "record field",
		file: "shows.json",
		value: { ...shows, data: [{ ...shows.data[0], title: 4 }] },
		error: /shows.json.data\[0\].title/,
	},
	{
		name: "payload shape",
		file: "tags.json",
		value: { ...tags, data: {} },
		error: /tags.json.data: expected an array/,
	},
	{
		name: "missing envelope",
		file: "tags.json",
		value: tags.data,
		error: /tags.json.version/,
	},
	{
		name: "invalid revision",
		file: "tags.json",
		value: { ...tags, version: "1" },
		error: /tags.json.version/,
	},
	{
		name: "invalid timestamp",
		file: "tags.json",
		value: { ...tags, updatedAt: "yesterday" },
		error: /tags.json.updatedAt/,
	},
	{
		name: "manifest structure",
		file: "data_versions.json",
		value: {},
		error: /data_versions.json.shows/,
	},
	{
		name: "export revision mismatch",
		file: "shows.json",
		value: { ...shows, version: 2 },
		error: /shows.json.version: expected 1, received 2/,
	},
	{
		name: "profile revision mismatch",
		file: "djs/1.json",
		value: { ...profile, version: 2 },
		error: /djs\/1.json.version: expected 1, received 2/,
	},
	{
		name: "show DJ reference",
		file: "shows.json",
		value: {
			...shows,
			data: [{ ...shows.data[0], djs: [{ id: 99, title: "Missing" }] }],
		},
		error: /shows.json: show 1.djs: unknown ID 99/,
	},
	{
		name: "show tag reference",
		file: "shows.json",
		value: { ...shows, data: [{ ...shows.data[0], tagIds: [99] }] },
		error: /shows.json: show 1.tagIds: unknown ID 99/,
	},
	{
		name: "brief DJ tag reference",
		file: "djs_brief.json",
		value: {
			...djs,
			data: djs.data.map((dj) => (dj.id === 1 ? { ...dj, tagIds: [99] } : dj)),
		},
		error: /djs_brief.json: DJ 1.tagIds: unknown ID 99/,
	},
	{
		name: "profile tag reference",
		file: "djs/1.json",
		value: { ...profile, data: { ...profile.data, tagIds: [99] } },
		error: /djs\/1.json.data.tagIds: unknown ID 99/,
	},
	{
		name: "profile record shape",
		file: "djs/1.json",
		value: { ...profile, data: { ...profile.data, shows: {} } },
		error: /djs\/1.json.data.shows/,
	},
];

for (const { name, file, value, error } of invalidCases) {
	test(`rejects ${name} with location context`, async () => {
		await fixture(async (directory) => {
			await replace(directory, file, value);
			await assert.rejects(validateResources(directory), error);
		});
	});
}

for (const [file, exported] of [
	["shows.json", shows],
	["djs_brief.json", djs],
	["tags.json", tags],
] as const) {
	test(`rejects duplicate IDs in ${file}`, async () => {
		await fixture(async (directory) => {
			await replace(directory, file, {
				...exported,
				data: [exported.data[0], exported.data[0]],
			});
			await assert.rejects(validateResources(directory), /duplicate ID 1/);
		});
	});
}

test("rejects missing, orphan, and misnamed profiles", async () => {
	await fixture(async (directory) => {
		await rm(join(directory, "djs/2.json"));
		await assert.rejects(
			validateResources(directory),
			/djs\/2.json: missing DJ profile/,
		);
		await replace(directory, "djs/99.json", {
			...profile,
			data: { ...profile.data, id: 99 },
		});
		await assert.rejects(
			validateResources(directory),
			/djs\/99.json.data.id: unknown ID 99/,
		);
		await rm(join(directory, "djs/99.json"));
		await rename(
			join(directory, "djs/1.json"),
			join(directory, "djs/wrong.json"),
		);
		await assert.rejects(
			validateResources(directory),
			/djs\/wrong.json.data.id: expected filename 1.json/,
		);
	});
});

test("rejects duplicate profile IDs", async () => {
	await fixture(async (directory) => {
		await replace(directory, "djs/2.json", profile);
		await assert.rejects(
			validateResources(directory),
			/duplicate profile ID 1/,
		);
	});
});

test("rejects malformed and missing files and directories", async () => {
	await fixture(async (directory) => {
		await rm(join(directory, "djs"), { recursive: true });
		await assert.rejects(
			validateResources(directory),
			/djs\/: cannot read profile directory/,
		);
		await writeFile(join(directory, "tags.json"), "{");
		await assert.rejects(
			validateResources(directory),
			/tags.json: cannot read JSON/,
		);
		await rm(join(directory, "shows.json"));
		await assert.rejects(
			validateResources(directory),
			/shows.json: cannot read JSON/,
		);
	});
});

test("rejects non-finite revisions parsed from JSON", async () => {
	await fixture(async (directory) => {
		const manifestPath = join(directory, "data_versions.json");
		const manifest = await readFile(manifestPath, "utf8");
		await writeFile(manifestPath, manifest.replace('"id":1', '"id":1e400'));
		await assert.rejects(
			validateResources(directory),
			/data_versions.json.shows.id: expected a finite number/,
		);
		await writeFile(manifestPath, manifest);
		await writeFile(
			join(directory, "tags.json"),
			JSON.stringify(tags).replace('"version":1', '"version":1e400'),
		);
		await assert.rejects(validateResources(directory), /tags.json.version/);
	});
});

test("CLI reports counts on success and a nonzero exit with diagnostics on failure", async () => {
	await fixture(async (directory) => {
		const run = () =>
			spawnSync("bun", ["scripts/validate-resources.ts", directory], {
				encoding: "utf8",
			});
		const success = run();
		assert.equal(success.status, 0, success.stderr);
		assert.match(
			success.stdout,
			/Validated 1 shows, 2 DJs, 2 tags, and 2 profiles/,
		);
		await rm(join(directory, "tags.json"));
		const failure = run();
		assert.equal(failure.status, 1);
		assert.match(failure.stderr, /tags.json: cannot read JSON/);
	});
});
