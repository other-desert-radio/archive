// Build first, then run: bun tests/show-details.browser.mjs (requires agent-browser).
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import console from "node:console";
import { URL } from "node:url";
import { promisify } from "node:util";
import { file, serve } from "bun";

const { Response } = globalThis;
const exec = promisify(execFile);
const manifest = await file("dist/resources/data_versions.json").json();
const details = await file("dist/resources/show_details.json").json();
const catalog = await file("dist/resources/shows.json").json();
const described = details.data.find(detail => detail.description);
assert.ok(described, "Needs a show with a description");
let gate = Promise.withResolvers();
let revision = details.version;
let fail = false;
let detailRequests = 0;
let detailResponses = 0;
let showRequests = 0;
const server = serve({
	hostname: "127.0.0.1",
	port: 0,
	async fetch(request) {
		const path = new URL(request.url).pathname.replace(/^\//, "");
		if (path === "resources/data_versions.json") {
			return Response.json({ ...manifest, show_details: { ...manifest.show_details, id: revision } });
		}
		if (path === "resources/show_details.json") {
			detailRequests++;
			await gate.promise;
			detailResponses++;
			return fail ? new Response("Offline", { status: 503 }) : Response.json({ ...details, version: revision });
		}
		if (path === "resources/shows.json") showRequests++;
		const relative = path && !path.split("/").at(-1).includes(".")
			? `${path.replace(/\/$/, "")}/index.html` : path || "index.html";
		const asset = file(`dist/${relative}`);
		return await asset.exists() ? new Response(asset) : new Response("Missing", { status: 404 });
	},
});
async function browser(...args) {
	const { stdout } = await exec("agent-browser", ["--session", "show-details", ...args], { timeout: 30_000 });
	return stdout.trim();
}
async function evaluate(code) {
	return JSON.parse(await browser("eval", code));
}
const base = `http://127.0.0.1:${server.port}/`;
const ready = "!document.querySelector('main [role=status]') && !document.querySelector('main [role=alert]') && !!document.querySelector('main article [data-show-playback]')";
const readCache = `(async () => {
	const db = await new Promise((resolve, reject) => {
		const request = indexedDB.open('odr-archive');
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	try {
		return await new Promise((resolve, reject) => {
			const tx = db.transaction(['show_details', 'metadata'], 'readonly');
			const records = tx.objectStore('show_details').getAll();
			const revision = tx.objectStore('metadata').get('show_details');
			tx.oncomplete = () => resolve({ records: records.result, revision: revision.result?.revision ?? null });
			tx.onabort = () => reject(tx.error);
		});
	} finally { db.close(); }
})()`;
async function cacheMatches(expected) {
	await browser("wait", "--fn", `${readCache}.then(cache => cache.revision === ${expected})`);
}
async function selectShow() {
	await evaluate("document.querySelector('main [data-show-playback]').click(); true");
	await browser("wait", "main [data-show-playback][data-selected=true]");
}
try {
	await browser("set", "viewport", "390", "844");
	await browser("open", base);
	await browser("wait", "--fn", ready);
	await browser("wait", "--fn", "performance.getEntriesByType('resource').some(entry => entry.name.endsWith('resources/shows.json'))");
	assert.equal(detailResponses, 0, "Browsing must be ready before details respond");
	await selectShow();
	assert.equal(detailResponses, 0, "Playback selection must not wait for details");
	assert.deepEqual(await evaluate(readCache), { records: [], revision: null });
	gate.resolve();
	await cacheMatches(revision);
	assert.equal(detailRequests, 1, "Multiple hydrated consumers share one details request");
	assert.equal(showRequests, 1);
	assert.deepEqual((await evaluate(readCache)).records.sort((a, b) => a.id - b.id), [...details.data].sort((a, b) => a.id - b.id));

	await browser("reload");
	await browser("wait", "--fn", ready);
	await cacheMatches(revision);
	assert.equal(detailRequests, 1, "Warm matching cache must skip the download");
	assert.equal(showRequests, 1);

	const cached = await evaluate(readCache);
	revision++;
	fail = true;
	gate = Promise.withResolvers();
	await browser("reload");
	await browser("wait", "--fn", ready);
	await selectShow();
	gate.resolve();
	await browser("wait", "--fn", "performance.getEntriesByType('resource').some(entry => entry.name.endsWith('resources/show_details.json'))");
	assert.equal(detailRequests, 2);
	assert.deepEqual(await evaluate(readCache), cached, "Failed detail-only refresh must preserve records and committed revision");
	assert.equal(showRequests, 1, "Detail-only changes must not redownload shows");

	fail = false;
	await browser("reload");
	await browser("wait", "--fn", ready);
	await cacheMatches(revision);
	assert.equal(detailRequests, 3, "A failed refresh can retry on the next initialization");

	revision++;
	gate = Promise.withResolvers();
	await browser("open", `${base}shows/${described.id}/`);
	await browser("wait", "#description-title");
	assert.ok(await evaluate("document.querySelector('.description-content').textContent.length > 0"));
	assert.equal(detailResponses, 3, "Static descriptions render while the browser details refresh is held");
	assert.equal(await evaluate("document.querySelector('.description-content').closest('astro-island') === null"), true);
	gate.resolve();
	await cacheMatches(revision);
	assert.ok(catalog.data.some(show => show.id === described.id));
	console.log("Show details: deferred loading, playback selection, shared requests, warm cache, failed refresh, retry and static descriptions passed.");
} finally {
	gate.resolve();
	try { await browser("close"); } finally { await server.stop(true); }
}
