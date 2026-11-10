// Build first, then run: bun tests/search-navigation.browser.mjs
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import console from "node:console";
import process from "node:process";
import { URL } from "node:url";
import { promisify } from "node:util";
import { file, serve } from "bun";

const { Response } = globalThis;
const exec = promisify(execFile);
async function browser(...args) {
	const { stdout } = await exec("agent-browser", ["--session", "search-navigation", ...args]);
	return stdout.trim();
}
const server = serve({
	hostname: "127.0.0.1",
	port: 0,
	async fetch(request) {
		const path = new URL(request.url).pathname.replace(/^\/archive\/?/, "");
		const assetPath = path && !path.split("/").at(-1).includes(".")
			? `${path.replace(/\/$/, "")}/index.html` : path || "index.html";
		const asset = file(`dist/${assetPath}`);
		return await asset.exists() ? new Response(asset) : new Response("Missing", { status: 404 });
	},
});
const input = 'main input[type="search"]';
async function waitForQuery(query) {
	await browser("wait", "--fn", `document.querySelector(${JSON.stringify(input)})?.value === ${JSON.stringify(query)}`);
}
async function category(label) {
	await browser("click", `a[aria-label="${label}"]`);
	await browser("wait", "--fn", `!!document.querySelector(${JSON.stringify(input)}) && !document.querySelector(${JSON.stringify(input)}).closest('astro-island').hasAttribute('ssr')`);
}
async function detailAndBack(selector, query) {
	await browser("fill", input, query);
	await browser("press", "Escape");
	await browser("wait", selector);
	await browser("eval", "window.searchDetailReady = false; document.addEventListener('astro:page-load', () => { window.searchDetailReady = true; }, { once: true })");
	await browser("click", selector);
	await browser("wait", "--fn", "window.searchDetailReady && history.state.scrollY === scrollY");
	await browser("back");
	await waitForQuery(query);
}
const historyList = 'ul[aria-label="Previous searches"]';
async function savedQueries(category) {
	return JSON.parse(await browser("eval", `(async () => {
		const db = await new Promise((resolve, reject) => {
			const request = indexedDB.open('odr-archive');
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try { return await new Promise((resolve, reject) => {
			const tx = db.transaction('search_${category}', 'readonly');
			const request = tx.objectStore('search_${category}').getAll();
			tx.oncomplete = () => resolve(request.result.map(entry => entry.query));
			tx.onabort = () => reject(tx.error);
		}); } finally { db.close(); }
	})()`));
}
async function historyChecks() {
	await browser("fill", input, "history-enter");
	await browser("press", "Enter");
	assert.equal(await browser("eval", `document.activeElement === document.querySelector('${input}')`), "false");
	await browser("click", input);
	await browser("wait", 'button[aria-label="Search for history-enter"]');
	await browser("fill", input, "history-clear");
	await browser("click", 'button[aria-label="Clear search"]');
	await browser("wait", 'button[aria-label="Search for history-clear"]');
	await browser("fill", input, "history-idle");
	await browser("wait", 'button[aria-label="Search for history-idle"]');
	for (let index = 0; index < 4; index++) {
		await browser("fill", input, `history-extra-${index}`);
		await browser("press", "Enter");
		await browser("click", input);
		await browser("wait", `button[aria-label="Search for history-extra-${index}"]`);
	}
	assert.equal(await browser("eval", `(() => {
		const list = document.querySelector('${historyList}');
		return list.children.length === 7 && list.scrollHeight > list.clientHeight && getComputedStyle(document.querySelector('${input}')).backgroundColor === 'rgb(255, 255, 255)';
	})()`), "true");
	await browser("eval", `document.querySelector('button[aria-label="Search for history-enter"]').scrollIntoView({block:'nearest'})`);
	await browser("click", 'button[aria-label="Search for history-enter"]');
	await waitForQuery("history-enter");
	assert.equal(await browser("eval", `!!document.querySelector('${historyList}')`), "false");
	await browser("click", input);
	await browser("click", 'button[aria-label="Remove search history-enter"]');
	await browser("wait", "--fn", `!document.querySelector('button[aria-label="Remove search history-enter"]')`);
	assert.equal(await browser("eval", `document.activeElement === document.querySelector('${input}') && !!document.querySelector('${historyList}') && getComputedStyle(document.querySelector('${input}')).backgroundColor === 'rgb(255, 255, 255)'`), "true");
	// Removing a focused button must not strand focus on the document body.
	await browser("eval", `document.querySelector('button[aria-label="Remove search history-extra-3"]').focus()`);
	await browser("press", "Enter");
	await browser("wait", "--fn", `!document.querySelector('button[aria-label="Remove search history-extra-3"]')`);
	assert.equal(await browser("eval", `document.activeElement === document.querySelector('${input}') && !!document.querySelector('${historyList}') && getComputedStyle(document.querySelector('${input}')).backgroundColor === 'rgb(255, 255, 255)'`), "true");
	await browser("click", 'nav[aria-label="Navigation title"] > span');
	assert.equal(await browser("eval", `!!document.querySelector('${historyList}')`), "false");
	await browser("click", input);
	await browser("wait", historyList);
	await browser("fill", input, "history-blur-unsaved");
	await browser("eval", `document.querySelector('${input}').blur()`);
	await browser("wait", "3100");
	assert.ok(!(await savedQueries("shows")).includes("history-blur-unsaved"));
	await browser("fill", input, "history-navigation-unsaved");
	await category("Browse DJs");
	await browser("wait", "3100");
	const saved = await savedQueries("shows");
	assert.ok(!saved.includes("history-navigation-unsaved"));
	assert.ok(!saved.includes("history-enter"));
	assert.ok(saved.includes("history-idle") && saved.includes("history-clear"));
	assert.deepEqual(await savedQueries("djs"), []);
	await category("Browse shows");
	await browser("reload");
	await browser("wait", "--fn", "!document.querySelector('main astro-island').hasAttribute('ssr') && !document.querySelector('main [role=status]')");
	await browser("click", input);
	await browser("wait", 'button[aria-label="Search for history-idle"]');
	for (const width of [320, 1440]) {
		await browser("set", "viewport", String(width), "900");
		assert.equal(await browser("eval", "document.documentElement.scrollWidth <= innerWidth"), "true");
	}
	await browser("press", "Escape");
	assert.equal(await browser("eval", `!!document.querySelector('${historyList}')`), "false");
	await browser("fill", input, "");
	await browser("press", "Escape");
}
try {
	const shows = (await file("public/resources/shows.json").json()).data;
	const djs = (await file("public/resources/djs_brief.json").json()).data;
	const tags = (await file("public/resources/tags.json").json()).data;
	await browser("open", `http://127.0.0.1:${server.port}/archive/`);
	await browser("wait", "--fn", "!document.querySelector('main astro-island').hasAttribute('ssr') && !document.querySelector('main [role=status]')");
	await historyChecks();
	console.log("Search history saves, deletion focus, white background, and outside dismissal pass.");
	if (!process.argv.includes("--history-only")) {
		await browser("eval", "window.searchNavigationDocument = true");
		await detailAndBack('main article a[href*="/shows/"]', shows[0].title);
		await browser("click", 'main article a[href*="/shows/"]');
		await browser("wait", 'a[data-tag-return]');
		await browser("click", 'a[data-tag-return]');
		await waitForQuery(shows[0].title);
		await category("Browse DJs");
		await waitForQuery("");
		await detailAndBack('main h2 a[href*="/djs/"]', djs[0].title);
		await category("Explore archive");
		await waitForQuery("");
		await detailAndBack('main a[aria-label^="Explore "]:not([hidden])', tags[0].title);
		await browser("wait", "--fn", `Array.from(document.querySelectorAll('[data-explore-tags] a')).every(link => link.hidden === !link.textContent.toLowerCase().includes(${JSON.stringify(tags[0].title.toLowerCase())}))`);
		await browser("fill", input, "no-matching-tag-92873");
		await browser("wait", "--fn", "!document.querySelector('[data-explore-empty]').hidden && document.querySelectorAll('[data-explore-tags] a:not([hidden])').length === 0");
		await browser("click", 'button[aria-label="Clear search"]');
		await browser("wait", "--fn", "document.querySelector('[data-explore-empty]').hidden && document.querySelectorAll('[data-explore-tags] a[hidden]').length === 0");
		await browser("fill", input, tags[0].title);
		await category("Browse shows");
		await waitForQuery("");
		await category("Browse DJs");
		await waitForQuery("");
		await category("Explore archive");
		await waitForQuery("");
		await browser("click", 'a[aria-label="View listening history"]');
		const likedPlaylist = 'a[aria-label="View playlist Liked Shows"]';
		await browser("wait", likedPlaylist);
		await browser("eval", `document.querySelector(${JSON.stringify(likedPlaylist)}).focus()`);
		await browser("press", "Enter");
		await browser("wait", input);
		await browser("fill", input, "retained-playlist-query");
		await browser("click", 'a[aria-label="Return to history"]');
		await browser("wait", likedPlaylist);
		await browser("back");
		await waitForQuery("retained-playlist-query");
		await browser("click", 'button[aria-label="Clear search"]');
		await waitForQuery("");
		assert.equal(await browser("eval", "window.searchNavigationDocument"), "true");
		console.log("Detail Back restores each page's query; category navigation clears it; playlist Back restores its own query.");
	}
	await browser("set", "device", "iPhone 12");
	await browser("reload");
	await browser("wait", "--fn", 'matchMedia("(pointer: coarse)").matches && !document.querySelector("main astro-island").hasAttribute("ssr")');
	await browser("fill", input, "mobile-clear");
	await browser("press", "Enter");
	await browser("click", 'button[aria-label="Clear search"]');
	await waitForQuery("");
	assert.equal(await browser("eval", `document.activeElement === document.querySelector('${input}')`), "false");
} catch (error) {
	console.error(await browser("eval", "JSON.stringify({url: location.href, main: document.querySelector('main')?.textContent.slice(0, 500)})"));
	throw error;
} finally {
	await browser("close");
	server.stop(true);
}
