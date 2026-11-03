import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { isMatching, P } from "ts-pattern";
import { HydratedDJPattern } from "../src/utils/fetch-dj";
import { DJPattern } from "../src/utils/fetch-djs";
import { ShowPattern } from "../src/utils/fetch-shows";
import { TagPattern } from "../src/utils/fetch-tags";
import { IsoDatePattern, VersionsPattern } from "../src/utils/patterns";

const EnvelopePattern = {
	version: P.number.finite(),
	updatedAt: IsoDatePattern,
	data: P.unknown,
};

function assertFields<const T extends Record<string, P.Pattern<unknown>>>(
	value: unknown,
	pattern: T,
	location: string,
): asserts value is P.infer<T> {
	if (isMatching(pattern, value)) {
		return;
	}
	for (const [field, fieldPattern] of Object.entries(pattern)) {
		if (!isMatching({ [field]: fieldPattern }, value)) {
			throw new Error(`${location}.${field}: invalid or missing field`);
		}
	}
	throw new Error(`${location}: unexpected format`);
}

async function readJson(directory: string, filename: string): Promise<unknown> {
	try {
		return JSON.parse(await readFile(join(directory, filename), "utf8"));
	} catch (error) {
		throw new Error(`${filename}: cannot read JSON`, { cause: error });
	}
}

async function readExport(directory: string, filename: string) {
	const value = await readJson(directory, filename);
	assertFields(value, EnvelopePattern, filename);
	return value;
}

async function readCatalog<const T extends Record<string, P.Pattern<unknown>>>(
	directory: string,
	filename: string,
	pattern: T,
	revision: number,
): Promise<P.infer<T>[]> {
	const exported = await readExport(directory, filename);
	checkRevision(exported.version, revision, filename);
	if (!Array.isArray(exported.data)) {
		throw new Error(`${filename}.data: expected an array`);
	}
	const ids = new Set<number>();
	return exported.data.map((value: unknown, index: number) => {
		const location = `${filename}.data[${index}]`;
		if (!isMatching({ id: P.number }, value)) {
			throw new Error(`${location}.id: expected a number`);
		}
		const id = value.id;
		assertFields(value, pattern, location);
		if (ids.has(id)) {
			throw new Error(`${location}.id: duplicate ID ${id}`);
		}
		ids.add(id);
		return value;
	});
}

function checkRevision(
	actual: number,
	expected: number,
	filename: string,
): void {
	if (actual !== expected) {
		throw new Error(
			`${filename}.version: expected ${expected}, received ${actual}`,
		);
	}
}

function checkReferences(
	ids: number[],
	known: Set<number>,
	location: string,
): void {
	for (const id of ids) {
		if (!known.has(id)) {
			throw new Error(`${location}: unknown ID ${id}`);
		}
	}
}

export async function validateResources(directory: string): Promise<void> {
	const manifestFile = "data_versions.json";
	const manifest = await readJson(directory, manifestFile);
	assertFields(manifest, VersionsPattern, manifestFile);
	for (const name of ["shows", "djs", "tags"] as const) {
		const version = manifest[name];
		if (!Number.isFinite(version.id)) {
			throw new Error(`${manifestFile}.${name}.id: expected a finite number`);
		}
	}
	const shows = await readCatalog(
		directory,
		"shows.json",
		ShowPattern,
		manifest.shows.id,
	);
	const djs = await readCatalog(
		directory,
		"djs_brief.json",
		DJPattern,
		manifest.djs.id,
	);
	const tags = await readCatalog(
		directory,
		"tags.json",
		TagPattern,
		manifest.tags.id,
	);
	const djIds = new Set(djs.map(({ id }) => id));
	const tagIds = new Set(tags.map(({ id }) => id));
	for (const show of shows) {
		checkReferences(
			show.djs.map(({ id }) => id),
			djIds,
			`shows.json: show ${show.id}.djs`,
		);
		checkReferences(show.tagIds, tagIds, `shows.json: show ${show.id}.tagIds`);
	}
	for (const dj of djs) {
		checkReferences(dj.tagIds, tagIds, `djs_brief.json: DJ ${dj.id}.tagIds`);
	}
	let filenames: string[];
	try {
		filenames = await readdir(join(directory, "djs"));
	} catch (error) {
		throw new Error("djs/: cannot read profile directory", { cause: error });
	}
	const profileIds = new Set<number>();
	for (const name of filenames
		.filter((name) => name.endsWith(".json"))
		.sort()) {
		const filename = `djs/${name}`;
		const exported = await readExport(directory, filename);
		checkRevision(exported.version, manifest.djs.id, filename);
		assertFields(exported.data, HydratedDJPattern, `${filename}.data`);
		const dj = exported.data;
		if (profileIds.has(dj.id)) {
			throw new Error(`${filename}.data.id: duplicate profile ID ${dj.id}`);
		}
		if (name !== `${dj.id}.json`) {
			throw new Error(`${filename}.data.id: expected filename ${dj.id}.json`);
		}
		checkReferences([dj.id], djIds, `${filename}.data.id`);
		checkReferences(dj.tagIds, tagIds, `${filename}.data.tagIds`);
		profileIds.add(dj.id);
	}
	for (const id of djIds) {
		if (!profileIds.has(id)) {
			throw new Error(`djs/${id}.json: missing DJ profile`);
		}
	}
	console.log(
		`Validated ${shows.length} shows, ${djs.length} DJs, ${tags.length} tags, and ${profileIds.size} profiles in ${directory}`,
	);
}

if (import.meta.main) {
	try {
		if (process.argv.length > 3) {
			throw new Error(
				"Usage: bun run validate:resources [resources-directory]",
			);
		}
		await validateResources(process.argv[2] ?? "dist/resources");
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	}
}
