// Run: bun tests/database/indexed-db.browser.mjs (requires agent-browser).
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { URL } from "node:url";
import { promisify } from "node:util";
import { build, file, serve } from "bun";

const exec = promisify(execFile);
const { Response } = globalThis;

export async function runIndexedDBChecks() {
	const bundle = await build({
		entrypoints: ["src/database/indexed-db.ts"],
		target: "browser",
	});
	assert.ok(bundle.success, "Database module must bundle");
	const storesBundle = await build({
		entrypoints: ["src/stores/stores.ts"],
		target: "browser",
		define: { "import.meta.env.BASE_URL": JSON.stringify("/") },
	});
	assert.ok(storesBundle.success, "Stores module must bundle");
	let showDownloads = 0;
	let tagDownloads = 0;
	const server = serve({
		port: 0,
		fetch(request) {
			switch (new URL(request.url).pathname) {
				case "/database.js":
					return new Response(bundle.outputs[0], {
						headers: { "Content-Type": "application/javascript" },
					});
				case "/stores.js":
					return new Response(storesBundle.outputs[0], {
						headers: { "Content-Type": "application/javascript" },
					});
				case "/resources/data_versions.json":
					return Response.json({
						shows: { id: 1, updatedAt: "2026-10-30T12:00:00.000Z" },
						djs: { id: 1, updatedAt: "2026-10-30T12:00:00.000Z" },
						tags: { id: 1, updatedAt: "2026-10-30T12:00:00.000Z" },
					});
				case "/resources/shows.json":
					showDownloads++;
					return new Response(file("tests/res/shows.json"));
				case "/resources/tags.json":
					tagDownloads++;
					return new Response(file("tests/res/tags.json"));
				case "/fixture.json":
					return new Response(file("tests/res/shows.json"));
				default:
					return new Response("<!doctype html><title>IndexedDB checks</title>", {
						headers: { "Content-Type": "text/html" },
					});
			}
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
			const check = (ok, message) => { if (!ok) throw new Error(message); };
			const { createIndexedDB } = await import(new URL('/database.js', location.href).href);
			const remove = () => new Promise((resolve, reject) => {
				const request = indexedDB.deleteDatabase('odr-archive');
				request.onsuccess = resolve;
				request.onerror = () => reject(request.error);
			});
			const inspect = () => new Promise((resolve, reject) => {
				const request = indexedDB.open('odr-archive', 2);
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			const revision = async () => {
				const db = await inspect();
				try {
					return await new Promise((resolve, reject) => {
						const tx = db.transaction('metadata', 'readonly');
						const request = tx.objectStore('metadata').get('shows');
						tx.oncomplete = () => resolve(request.result?.revision);
						tx.onabort = () => reject(tx.error);
					});
				} finally { db.close(); }
			};
			await remove();
			const database = createIndexedDB();
			const shows = database.getObjectStore('shows');
			const metadata = database.getObjectStore('metadata');
			const initial = await Promise.all([shows.getAll(), shows.get(42)]);
			check(initial[0].length === 0 && initial[1] === undefined, 'Empty reads');
			const db = await inspect();
			const schema = db.transaction(['shows', 'metadata', 'tags'], 'readonly');
			check(schema.objectStore('tags').keyPath === 'id', 'Tag primary key');
			check(schema.objectStore('shows').keyPath === 'id', 'Show primary key');
			check(schema.objectStore('metadata').keyPath === 'key', 'Metadata primary key');
			db.close();
			const fixture = (await (await fetch('/fixture.json')).json()).data[0];
			const original = { ...fixture, id: 42, title: 'Original' };
			await shows.set(original);
			original.title = 'Mutated outside storage';
			const stored = await shows.get(42);
			check(stored.title === 'Original', 'Writes clone objects');
			stored.title = 'Mutated read';
			check((await shows.get(42)).title === 'Original', 'Reads clone objects');
			await shows.set({ ...fixture, id: 42, title: 'Updated' });
			check((await shows.get(42)).title === 'Updated', 'Upsert');
			await shows.delete(42);
			await shows.delete(42);
			check(await shows.get(42) === undefined, 'Delete and missing delete');
			await metadata.set({ key: 'shows', revision: 1 });
			check((await metadata.get('shows')).revision === 1, 'String-keyed metadata CRUD');
			check((await metadata.getAll()).length === 1, 'Metadata getAll');
			await metadata.delete('shows');
			check(await metadata.get('shows') === undefined, 'Metadata delete');
			await database.transaction([
				{ store: 'shows', action: 'set', value: { ...fixture, id: 99 } },
				{ store: 'shows', action: 'delete', key: 99 },
				{ store: 'metadata', action: 'set', value: { key: 'shows', revision: 2 } },
				{ store: 'metadata', action: 'delete', key: 'shows' },
			]);
			check(await shows.get(99) === undefined && await metadata.get('shows') === undefined, 'Typed batch deletes');
			await database.transaction([
				{ store: 'metadata', action: 'set', value: { key: 'shows', revision: 3 } },
				{ store: 'metadata', action: 'clear' },
			]);
			check((await metadata.getAll()).length === 0, 'Metadata batch clear');
			await database.transaction([]);
			await database.transaction([
				{ store: 'shows', action: 'set', value: { ...fixture, id: 99 } },
				{ store: 'shows', action: 'clear' },
				{ store: 'shows', action: 'set', value: { ...fixture, id: 42, title: 'Committed' } },
				{ store: 'metadata', action: 'set', value: { key: 'shows', revision: 12 } },
			]);
			check((await shows.getAll()).length === 1 && await revision() === 12, 'Ordered atomic batch');
			let rejected = false;
			try {
				await database.transaction([
					{ store: 'shows', action: 'clear' },
					{ store: 'metadata', action: 'set', value: { key: 'shows', revision: 13 } },
					{ store: 'shows', action: 'set', value: { ...fixture, id: 43, uncloneable: () => {} } },
				]);
			} catch { rejected = true; }
			check(rejected, 'Synchronous queuing failure rejects');
			check((await shows.get(42)).title === 'Committed' && await revision() === 12, 'Queuing failure rolls back all stores');
			const put = IDBObjectStore.prototype.put;
			IDBObjectStore.prototype.put = function (...args) {
				const request = put.apply(this, args);
				request.addEventListener('success', () => request.transaction.abort());
				return request;
			};
			rejected = false;
			try {
				await database.transaction([
					{ store: 'shows', action: 'clear' },
					{ store: 'metadata', action: 'set', value: { key: 'shows', revision: 14 } },
				]);
			} catch { rejected = true; }
			finally { IDBObjectStore.prototype.put = put; }
			check(rejected, 'Abort after request success must reject');
			check((await shows.get(42)).title === 'Committed' && await revision() === 12, 'Abort rolls back all stores');
			const tag = { id: 7, title: 'Tag', color: '#123456' };
			await database.transaction([
				{ store: 'tags', action: 'set', value: tag },
				{ store: 'metadata', action: 'set', value: { key: 'tags', revision: 1 } },
			]);
			rejected = false;
			try {
				await database.transaction([
					{ store: 'tags', action: 'clear' },
					{ store: 'metadata', action: 'set', value: { key: 'tags', revision: 2 } },
					{ store: 'tags', action: 'set', value: { ...tag, uncloneable: () => {} } },
				]);
			} catch { rejected = true; }
			check(rejected && (await database.getObjectStore('tags').get(7)).title === 'Tag', 'Tag rollback');
			check((await metadata.get('tags')).revision === 1, 'Tag revision rollback');
			return { passed: true };
		})()`));
		assert.deepEqual(result, { passed: true });
		await browser("reload");
		const persisted = JSON.parse(await browser("eval", `(async () => {
			const { createIndexedDB } = await import(new URL('/database.js', location.href).href);
			const database = createIndexedDB();
			const store = database.getObjectStore('shows');
			if ((await database.getObjectStore('tags').get(7)).title !== 'Tag') throw new Error('Tag persistence');
			const title = (await store.get(42)).title;
			// Deleting the DB exercises closing cached connections on versionchange.
			await new Promise((resolve, reject) => {
				const request = indexedDB.deleteDatabase('odr-archive');
				request.onsuccess = resolve;
				request.onerror = () => reject(request.error);
			});
			return { title, reopened: await store.getAll() };
		})()`));
		assert.deepEqual(persisted, { title: "Committed", reopened: [] });
		const upgraded = JSON.parse(await browser("eval", `(async () => {
			await new Promise((resolve, reject) => {
				const request = indexedDB.deleteDatabase('odr-archive');
				request.onsuccess = resolve;
				request.onerror = () => reject(request.error);
			});
			await new Promise((resolve, reject) => {
				const request = indexedDB.open('odr-archive', 1);
				request.onupgradeneeded = () => {
					request.result.createObjectStore('shows', { keyPath: 'id' }).put({ id: 42, title: 'Preserved' });
					request.result.createObjectStore('metadata', { keyPath: 'key' }).put({ key: 'shows', revision: 12 });
				};
				request.onsuccess = () => { request.result.close(); resolve(); };
				request.onerror = () => reject(request.error);
			});
			const { createIndexedDB } = await import(new URL('/database.js', location.href).href);
			const database = createIndexedDB();
			return {
				title: (await database.getObjectStore('shows').get(42)).title,
				revision: (await database.getObjectStore('metadata').get('shows')).revision,
				tags: await database.getObjectStore('tags').getAll(),
			};
		})()`));
		assert.deepEqual(upgraded, { title: "Preserved", revision: 12, tags: [] });
		const initialized = JSON.parse(await browser("eval", `(async () => {
			const { createStores } = await import(new URL('/stores.js', location.href).href);
			const first = createStores();
			await first.initialize();
			const firstShows = first.showStore.getAll();
			if (!firstShows.length) throw new Error('Expected imported shows');
			if (first.showStore.get(firstShows[0].id) !== firstShows[0]) {
				throw new Error('Lookup must use the same in-memory record');
			}
			const second = createStores();
			await second.initialize();
			return {
				first: firstShows.length,
				second: second.showStore.getAll().length,
				cached: second.versionsStore.getCached('shows'),
				firstTags: first.tagStore.getAll().length,
				secondTags: second.tagStore.getAll().length,
				cachedTags: second.versionsStore.getCached('tags'),
			};
		})()`));
		assert.ok(initialized.first > 0);
		assert.equal(initialized.second, initialized.first);
		assert.equal(initialized.cached, 1);
		assert.ok(initialized.firstTags > 0);
		assert.equal(initialized.secondTags, initialized.firstTags);
		assert.equal(initialized.cachedTags, 1);
		assert.equal(tagDownloads, 1, "A matching local revision must not download tags again");
		assert.equal(showDownloads, 1, "A matching local revision must not download shows again");
	} finally {
		try {
			await browser("close");
		} finally {
			await server.stop(true);
		}
	}
}

if (import.meta.main) {
	await runIndexedDBChecks();
}
