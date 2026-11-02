import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { URL } from "node:url";
import { promisify } from "node:util";
import { build, serve } from "bun";

const exec = promisify(execFile);
const { Response } = globalThis;

async function verifyInitialization() {
	const bundle = await build({
		entrypoints: ["src/database/indexed-db.ts"],
		target: "browser",
	});
	assert.ok(bundle.success, "Database module must bundle");
	const server = serve({
		port: 0,
		fetch(request) {
			return new URL(request.url).pathname === "/database.js"
				? new Response(bundle.outputs[0], {
						headers: { "Content-Type": "application/javascript" },
					})
				: new Response("<!doctype html><title>IndexedDB checks</title>", {
						headers: { "Content-Type": "text/html" },
					});
		},
	});
	async function browser(...args) {
		const { stdout } = await exec(
			"agent-browser",
			["--session", "archive-indexed-db", ...args],
			{ encoding: "utf8", timeout: 30_000 },
		);
		return stdout.trim();
	}
	try {
		await browser("open", server.url.href);
		const result = JSON.parse(await browser("eval", `(async () => {
			const { createIndexedDB } = await import(new URL('/database.js', location.href).href);
			const remove = () => new Promise((resolve, reject) => {
				const request = indexedDB.deleteDatabase('odr-archive');
				request.onsuccess = resolve;
				request.onerror = () => reject(request.error);
			});
			await remove();
			const database = createIndexedDB();
			const shows = database.getObjectStore('shows');
			// CRUD remains stubbed; reaching its error proves opening completed.
			const errors = await Promise.all([shows.getAll(), shows.get(42)]
				.map(task => task.catch(error => error.message)));
			const inspect = await new Promise((resolve, reject) => {
				const request = indexedDB.open('odr-archive', 1);
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			const tx = inspect.transaction(['shows', 'metadata'], 'readonly');
			const schema = {
				version: inspect.version,
				showsKey: tx.objectStore('shows').keyPath,
				metadataKey: tx.objectStore('metadata').keyPath,
			};
			inspect.close();
			// The implementation's open connection must close on versionchange.
			await remove();
			const retry = await shows.getAll().catch(error => error.message);
			await remove();
			return { errors, schema, retry };
		})()`));
		assert.deepEqual(result, {
			errors: ["Not implemented", "Not implemented"],
			schema: { version: 1, showsKey: "id", metadataKey: "key" },
			retry: "Not implemented",
		});
	} finally {
		try {
			await browser("close");
		} finally {
			await server.stop(true);
		}
	}
}

async function verifyPersistence() {
	throw new Error("Not implemented");
}

async function verifyTransactionRollback() {
	throw new Error("Not implemented");
}

export async function runIndexedDBChecks() {
	await verifyInitialization();
	await verifyPersistence();
	await verifyTransactionRollback();
}

// Only the approved initialization unit is implemented so far.
if (import.meta.main) {
	await verifyInitialization();
}
