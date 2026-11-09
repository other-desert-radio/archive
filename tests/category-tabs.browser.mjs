// Build first, then run: bun tests/category-tabs.browser.mjs
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import console from "node:console";
import { URL } from "node:url";
import { promisify } from "node:util";
import { file, serve } from "bun";

const { Response } = globalThis;
const exec = promisify(execFile);
const session = "category-tabs";
async function browser(...args) {
	const { stdout } = await exec("agent-browser", ["--session", session, ...args]);
	return stdout.trim();
}
async function evaluate(code) {
	return JSON.parse(await browser("eval", code));
}
async function verifyProgress(y, progress) {
	await evaluate(`window.scrollTo(0, ${y}); true`);
	await browser("wait", "--fn", `(() => {
		const tabs = document.querySelector('[data-category-tabs]');
		return tabs.style.getPropertyValue('--tabs-progress') === '${progress}'
			&& tabs.hasAttribute('data-compact') === ${progress === 1};
	})()`);
	assert.equal(await evaluate("scrollY"), y);
}

const server = serve({
	hostname: "127.0.0.1",
	port: 0,
	async fetch(request) {
		const path = new URL(request.url).pathname.replace(/^\/archive\/?/, "");
		const assetPath = path && !path.split("/").at(-1).includes(".")
			? `${path.replace(/\/$/, "")}/index.html` : path || "index.html";
		const asset = file(`dist/${assetPath}`);
		return (await asset.exists()) ? new Response(asset) : new Response("Missing", { status: 404 });
	},
});
const base = `http://127.0.0.1:${server.port}/archive`;
try {
	await browser("set", "viewport", "1440", "800");
	await browser("open", `${base}/`);
	await browser("wait", "--fn", "document.querySelector('[data-category-tabs]')?.style.getPropertyValue('--tabs-progress') === '0'");
	for (const y of [0, 80, 160, 320, 80, 0]) {
		await verifyProgress(y, Math.min(1, y / 160));
	}

	// Repeated page-load initialization must not leave duplicate scroll listeners.
	await evaluate(`(() => {
		document.dispatchEvent(new Event('astro:page-load'));
		document.dispatchEvent(new Event('astro:page-load'));
		return true;
	})()`);
	await browser("wait", "--fn", "new Promise(resolve => requestAnimationFrame(() => resolve(true)))");
	assert.equal(await evaluate(`new Promise(resolve => {
		const tabs = document.querySelector('[data-category-tabs]');
		let changes = 0;
		const original = tabs.style.setProperty.bind(tabs.style);
		tabs.style.setProperty = (...args) => { changes++; original(...args); };
		for (let i = 0; i < 10; i++) window.dispatchEvent(new Event('scroll'));
		requestAnimationFrame(() => {
			tabs.style.setProperty = original;
			resolve(changes);
		});
	})`), 1);

	// Disposal must cancel queued work and stop updates on the outgoing element.
	assert.equal(await evaluate(`new Promise(resolve => {
		const tabs = document.querySelector('[data-category-tabs]');
		window.scrollTo(0, 80);
		window.dispatchEvent(new Event('scroll'));
		document.dispatchEvent(new Event('astro:before-swap'));
		requestAnimationFrame(() => {
			resolve(tabs.style.getPropertyValue('--tabs-progress'));
		});
	})`), "0");
	await evaluate("document.dispatchEvent(new Event('astro:page-load')); true");
	await verifyProgress(80, 0.5);
	await browser("set", "media", "light", "reduced-motion");
	await verifyProgress(0, 1);
	await browser("set", "media", "light");
	await verifyProgress(0, 0);

	// Page-load must use restored scroll rather than assuming the top of the page.
	await verifyProgress(80, 0.5);
	await browser("reload");
	await browser("wait", "--fn", "Math.abs(scrollY - 80) < 2 && document.querySelector('[data-category-tabs]')?.style.getPropertyValue('--tabs-progress') === String(scrollY / 160)");
	await verifyProgress(80, 0.5);
	await evaluate("window.outgoingTabs = document.querySelector('[data-category-tabs]'); true");
	await browser("click", "[data-category-tabs] a[href='/archive/djs']");
	await browser("wait", "--fn", "location.pathname.replace(/\\/$/, '') === '/archive/djs' && document.querySelector('[data-category-tabs]') !== window.outgoingTabs && document.querySelector('[data-category-tabs]')?.style.getPropertyValue('--tabs-progress') === '0'");
	await verifyProgress(160, 1);
	assert.equal(await evaluate("window.outgoingTabs.style.getPropertyValue('--tabs-progress')"), "0.5");
	await browser("back");
	await browser("wait", "--fn", "location.pathname === '/archive/' && Math.abs(scrollY - 80) < 2 && document.querySelector('[data-category-tabs]')?.style.getPropertyValue('--tabs-progress') === String(scrollY / 160)");
	console.log("Tab progress, reversal, frame batching, cleanup, reduced motion, reload and history restoration pass.");
} finally {
	await browser("close");
	server.stop(true);
}
