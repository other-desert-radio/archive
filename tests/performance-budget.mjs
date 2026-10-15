import assert from "node:assert/strict";
import console from "node:console";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

// Production growth guards, measured with gzip regardless of preview-server
// compression. These are transfer-size budgets, not device timing guarantees.
// Baseline: JS 76 KiB, CSS 3.1 KiB, root HTML 8.9 KiB, other category
// HTML <=4.5 KiB, detail HTML <=4.9 KiB. Leave room for routine content growth.
const KiB = 1024;
const failures = [];

function budget(label, bytes, limit) {
	console.log(
		`${label}: ${(bytes / KiB).toFixed(1)} / ${(limit / KiB).toFixed(1)} KiB gzip`,
	);
	if (bytes > limit) {
		failures.push(`${label} exceeds its gzip budget by ${bytes - limit} bytes`);
	}
}

async function compressedSize(path) {
	return gzipSync(await readFile(path)).length;
}

async function htmlFiles(directory) {
	const files = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await htmlFiles(path)));
		else if (entry.name.endsWith(".html")) files.push(path);
	}
	return files;
}

try {
	const assets = await readdir("dist/_astro");
	for (const [extension, limit] of [
		[".js", 100 * KiB],
		[".css", 5 * KiB],
	]) {
		const files = assets.filter((file) => file.endsWith(extension));
		assert.ok(
			files.length,
			`No ${extension} assets found; run bun run build first`,
		);
		const sizes = await Promise.all(
			files.map((file) => compressedSize(join("dist/_astro", file))),
		);
		budget(
			`All emitted ${extension} assets`,
			sizes.reduce((a, b) => a + b, 0),
			limit,
		);
	}

	for (const [route, limit] of [
		["", 12 * KiB],
		["djs", 7 * KiB],
		["explore", 7 * KiB],
		["history", 7 * KiB],
	]) {
		budget(
			`${route || "root"} HTML`,
			await compressedSize(join("dist", route, "index.html")),
			limit,
		);
	}

	for (const category of ["djs", "shows", "tags"]) {
		const files = (await htmlFiles(join("dist", category))).filter(
			(file) => file !== join("dist", category, "index.html"),
		);
		assert.ok(
			files.length,
			`No ${category} details found; run bun run build first`,
		);
		let largest = { path: "", bytes: 0 };
		for (const path of files) {
			const bytes = await compressedSize(path);
			if (bytes > largest.bytes) largest = { path, bytes };
		}
		budget(
			`Largest ${category} detail (${largest.path})`,
			largest.bytes,
			8 * KiB,
		);
	}

	assert.equal(
		failures.length,
		0,
		`${failures.join("\n")}\nInspect new hydration, bundled data, dependencies, or rendered content before deliberately changing a budget.`,
	);
} catch (error) {
	if (error.code === "ENOENT") {
		throw new Error(
			"Production output is missing. Run bun run build before this check.",
			{
				cause: error,
			},
		);
	}
	throw error;
}
