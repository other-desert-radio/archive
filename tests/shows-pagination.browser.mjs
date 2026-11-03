// Build first, then run: bun tests/shows-pagination.browser.mjs
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import console from "node:console";
import { setTimeout } from "node:timers";
import { URL } from "node:url";
import { promisify } from "node:util";
import { file, serve } from "bun";

const { Response } = globalThis;
const exec = promisify(execFile);
const session = "shows-pagination";
async function browser(...args) {
	const { stdout } = await exec("agent-browser", ["--session", session, ...args]);
	return stdout.trim();
}
async function evaluate(code) {
	return JSON.parse(await browser("eval", code));
}
async function verifyHistoryReturn(index) {
	const saved = await evaluate(`(() => {
		const link = document.querySelectorAll('main article a[href*="/shows/"]')[${index}];
		link.scrollIntoView({ block: 'center' });
		window.paginationDocument = true;
		window.paginationIframe = document.querySelector('[data-miniplayer] iframe');
		return { x: scrollX, y: scrollY, count: document.querySelectorAll('main article').length, path: link.pathname };
	})()`);
	await evaluate(`document.querySelectorAll('main article a[href*="/shows/"]')[${index}].click(); true`);
	await browser("wait", "--fn", `location.pathname === ${JSON.stringify(saved.path)}`);
	await evaluate(`document.addEventListener('astro:after-swap', () => {
		window.paginationFirstSwap = {
			count: document.querySelectorAll('main article').length,
			y: scrollY,
		};
	}, { once: true }); history.back(); true`);
	await browser("wait", "--fn", `location.pathname === '/archive/' && document.querySelectorAll('main article').length === ${saved.count} && Math.abs(scrollY - ${saved.y}) < 2`);
	assert.deepEqual(await evaluate("window.paginationFirstSwap"), { count: saved.count, y: saved.y });
	assert.equal(await evaluate("window.paginationDocument"), true);
	assert.equal(await evaluate("!window.paginationIframe || document.querySelector('[data-miniplayer] iframe') === window.paginationIframe"), true);
	assert.equal(await evaluate("scrollX"), saved.x);
}

const catalog = await file("public/resources/shows.json").json();
const html = await file("dist/index.html").text();
assert.equal((html.match(/<article /g) ?? []).length, Math.min(20, catalog.data.length));
let fail = true;
const server = serve({
	hostname: "127.0.0.1",
	port: 0,
	async fetch(request) {
		const path = new URL(request.url).pathname.replace(/^\/archive\/?/, "");
		if (path === "resources/data_versions.json" && fail) {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			return new Response("Unavailable", { status: 503 });
		}
		const assetPath = path && !path.split("/").at(-1).includes(".")
			? `${path.replace(/\/$/, "")}/index.html` : path || "index.html";
		const asset = file(`dist/${assetPath}`);
		return (await asset.exists()) ? new Response(asset) : new Response("Missing", { status: 404 });
	},
});
try {
	await browser("set", "viewport", "390", "844");
	await browser("open", `http://127.0.0.1:${server.port}/archive/`);
	await browser("wait", "main [role='status']");
	assert.deepEqual(await evaluate(`(() => {
		const status = document.querySelector('main [role="status"]');
		return [status.textContent, getComputedStyle(status).textAlign, getComputedStyle(status).fontStyle];
	})()`), ["Loading shows...", "center", "italic"]);
	await browser("wait", "button[aria-label='Retry loading shows']");
	assert.equal(await evaluate("document.querySelectorAll('main article').length"), 20);
	fail = false;
	await browser("click", "button[aria-label='Retry loading shows']");
	await browser("wait", "--fn", "!document.querySelector('main [role=status]') && !document.querySelector('main [role=alert]')");
	for (const width of [390, 1440]) {
		await browser("set", "viewport", String(width), "844");
		if (width === 1440) {
			await browser("open", `http://127.0.0.1:${server.port}/archive/`);
			await browser("wait", "--fn", "!document.querySelector('main [role=status]')");
		}
		let count = await evaluate("document.querySelectorAll('main article').length");
		while (count < catalog.data.length) {
			await evaluate("window.scrollTo(0, document.body.scrollHeight); true");
			await browser("wait", "--fn", `document.querySelectorAll('main article').length > ${count}`);
			const next = await evaluate("document.querySelectorAll('main article').length");
			assert.equal(next, Math.min(count + 20, catalog.data.length));
			count = next;
			if (width === 390 && count === 60) await verifyHistoryReturn(45);
		}
		assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
	}
	const ids = await evaluate(`Array.from(document.querySelectorAll('main article a[aria-label^="View "][href*="/shows/"]'), (link) => Number(link.pathname.split('/').pop()))`);
	assert.deepEqual(ids, catalog.data.map((show) => show.id));
	const cardTags = await evaluate(`Array.from(document.querySelectorAll('main article'), (card) => Array.from(card.querySelectorAll('a.tag'), (link) => Number(link.pathname.split('/').pop())))`);
	assert.deepEqual(cardTags, catalog.data.map((show) => show.tagIds));
	assert.equal(await evaluate("document.querySelector('main [class*=sentinel]') === null"), true);
	await browser("click", "main article:last-child button[aria-label^='Play ']");
	await browser("wait", "main article:last-child button[aria-label^='Pause ']");
	await browser("wait", "[data-miniplayer] iframe");
	// Exercise the Safari compatibility swap while an iframe is active.
	await evaluate("Object.defineProperty(Element.prototype, 'moveBefore', { value: undefined, configurable: true }); true");
	for (const width of [390, 1440]) {
		await browser("set", "viewport", String(width), "844");
		await verifyHistoryReturn(65);
	}
	console.log("History Back restores loaded batches and scroll on phone and desktop.");
	console.log("Static first batch, loading style, retry, ordered infinite scroll, final batch, responsive layout and appended playback pass.");
} finally {
	await browser("close");
	server.stop(true);
}
