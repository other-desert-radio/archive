// Build first, then run: bun tests/search-navigation.browser.mjs
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import console from "node:console";
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
	await browser("wait", selector);
	await browser("eval", "window.searchDetailReady = false; document.addEventListener('astro:page-load', () => { window.searchDetailReady = true; }, { once: true })");
	await browser("click", selector);
	await browser("wait", "--fn", "window.searchDetailReady && history.state.scrollY === scrollY");
	await browser("back");
	await waitForQuery(query);
}
try {
	const shows = (await file("public/resources/shows.json").json()).data;
	const djs = (await file("public/resources/djs_brief.json").json()).data;
	const tags = (await file("public/resources/tags.json").json()).data;
	await browser("open", `http://127.0.0.1:${server.port}/archive/`);
	await browser("wait", "--fn", "!document.querySelector('main astro-island').hasAttribute('ssr') && !document.querySelector('main [role=status]')");
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
	await browser("click", likedPlaylist);
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
} catch (error) {
	console.error(await browser("eval", "JSON.stringify({url: location.href, main: document.querySelector('main')?.textContent.slice(0, 500)})"));
	throw error;
} finally {
	await browser("close");
	server.stop(true);
}
