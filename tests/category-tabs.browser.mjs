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
const source = await file("src/components/CategoryTabs.astro").text();
const compressionScrollPx = Number(source.match(/const compressionScrollPx = ([\d.]+);/)?.[1]);
const easeOutPower = Number(source.match(/const easeOutPower = ([\d.]+);/)?.[1]);
assert.ok(compressionScrollPx > 2 && easeOutPower >= 1, "Readable scroll tuning constants are required");
const halfwayScroll = compressionScrollPx / 2;
const halfwayProgress = 1 - 0.5 ** easeOutPower;
const restoredProgress = `String(1 - (1 - Math.min(1, Math.max(0, scrollY / ${compressionScrollPx}))) ** ${easeOutPower})`;
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
	await browser("wait", "--fn", "document.querySelector('.tabs-strip').getAnimations().length === 0");
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
	for (const [y, progress] of [[0, 0], [halfwayScroll, halfwayProgress], [compressionScrollPx, 1], [compressionScrollPx * 2, 1], [halfwayScroll, halfwayProgress], [0, 0]]) {
		await verifyProgress(y, progress);
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
		window.scrollTo(0, ${halfwayScroll});
		window.dispatchEvent(new Event('scroll'));
		document.dispatchEvent(new Event('astro:before-swap'));
		requestAnimationFrame(() => {
			resolve(tabs.style.getPropertyValue('--tabs-progress'));
		});
	})`), "0");
	await evaluate("document.dispatchEvent(new Event('astro:page-load')); true");
	await verifyProgress(halfwayScroll, halfwayProgress);
	await browser("set", "media", "light", "reduced-motion");
	await verifyProgress(0, 1);
	await browser("set", "media", "light");
	await verifyProgress(0, 0);

	// Page-load must use restored scroll rather than assuming the top of the page.
	await verifyProgress(halfwayScroll, halfwayProgress);
	await browser("reload");
	await browser("wait", "--fn", `Math.abs(scrollY - ${halfwayScroll}) < 2 && document.querySelector('[data-category-tabs]')?.style.getPropertyValue('--tabs-progress') === ${restoredProgress}`);
	await verifyProgress(halfwayScroll, halfwayProgress);
	await evaluate("window.outgoingTabs = document.querySelector('[data-category-tabs]'); true");
	await browser("click", "[data-category-tabs] a[href='/archive/djs']");
	await browser("wait", "--fn", "location.pathname.replace(/\\/$/, '') === '/archive/djs' && document.querySelector('[data-category-tabs]') !== window.outgoingTabs && document.querySelector('[data-category-tabs]')?.style.getPropertyValue('--tabs-progress') === '0'");
	await verifyProgress(compressionScrollPx, 1);
	assert.equal(await evaluate("window.outgoingTabs.style.getPropertyValue('--tabs-progress')"), String(halfwayProgress));
	await browser("back");
	await browser("wait", "--fn", `location.pathname === '/archive/' && Math.abs(scrollY - ${halfwayScroll}) < 2 && document.querySelector('[data-category-tabs]')?.style.getPropertyValue('--tabs-progress') === ${restoredProgress}`);

	await browser("click", "[data-category-tabs] a[href='/archive/djs']");
	await browser("wait", "--fn", "location.pathname.replace(/\\/$/, '') === '/archive/djs'");
	await evaluate("document.fonts.ready.then(() => true)");
	for (const width of [320, 332, 750, 1440, 2000]) {
		await browser("set", "viewport", String(width), "800");
		const states = [];
		for (const [y, progress] of [[0, 0], [halfwayScroll, halfwayProgress], [compressionScrollPx - 1, 1 - (1 / compressionScrollPx) ** easeOutPower], [compressionScrollPx, 1], [compressionScrollPx * 2, 1], [0, 0]]) {
			await verifyProgress(y, progress);
			const state = await evaluate(`(() => {
				const strip = document.querySelector('.tabs-strip');
				const links = [...strip.querySelectorAll('a')];
				const rects = links.map(link => link.getBoundingClientRect());
				const active = strip.querySelector('[aria-current="page"]');
				const textRect = element => {
					const range = document.createRange();
					range.selectNodeContents(element);
					return range.getBoundingClientRect();
				};
				return {
					font: parseFloat(getComputedStyle(links[0]).fontSize),
					left: rects[0].left,
					width: rects.at(-1).right - rects[0].left,
					gaps: rects.slice(1).map((rect, i) => rect.left - rects[i].right),
					height: strip.getBoundingClientRect().height,
					background: getComputedStyle(strip).backgroundColor,
					color: getComputedStyle(active).color,
					underline: getComputedStyle(active).textDecorationLine,
					navLeft: document.querySelector('.leading-box').getBoundingClientRect().left,
					stripTop: strip.getBoundingClientRect().top,
					navBottom: document.querySelector('header > nav').getBoundingClientRect().bottom,
					textGap: textRect(links[0]).top - textRect(document.querySelector('header > nav > span')).bottom,
					compactGap: parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.5,
					pageHeight: document.documentElement.scrollHeight,
					mainY: document.querySelector('main').getBoundingClientRect().top + scrollY,
					overflow: document.documentElement.scrollWidth > innerWidth,
					hitTargets: rects.every(rect => rect.height >= 44 && rect.width >= 44),
					clearBelow: !document.elementFromPoint(innerWidth / 2, strip.getBoundingClientRect().bottom + 4)?.closest('header')
				};
			})()`);
			const channels = state.background.match(/[\d.]+/g).map(Number);
			assert.deepEqual(channels.slice(0, 3), [0, 0, 0]);
			assert.ok(Math.abs((channels[3] ?? 1) - progress) < 0.005, "background opacity must follow eased scroll progress");
			assert.equal(state.color, progress < 0.5 ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)");
			assert.equal(state.underline, "underline");
			assert.equal(state.overflow, false, `overflow at ${width}px`);
			assert.equal(state.hitTargets, true, `touch targets at ${width}px`);
			assert.equal(state.clearBelow, true, "reserved transparent space must pass clicks through");
			assert.ok(Math.abs(state.stripTop - state.navBottom) < 1);
			states.push(state);
		}
		const [expanded, halfway, nearEnd, compact, beyond, reversed] = states;
		assert.ok(expanded.font > halfway.font && halfway.font > compact.font);
		assert.ok(expanded.height > halfway.height && halfway.height > compact.height);
		assert.ok(expanded.left >= halfway.left && halfway.left >= compact.left);
		assert.ok(Math.abs(compact.left - compact.navLeft) < 1);
		assert.ok(Math.abs(compact.textGap - compact.compactGap) < 2, "compact title-to-tab text gap must be approximately 1.5rem");
		assert.ok(expanded.width > halfway.width && halfway.width > compact.width);
		assert.ok(expanded.gaps.every((gap, i) => gap > compact.gaps[i]));
		assert.ok(nearEnd.font >= compact.font);
		assert.ok(Math.abs((expanded.font - halfway.font) / (expanded.font - compact.font) - halfwayProgress) < 0.01, "font size must follow the configured ease-out curve");
		assert.deepEqual(beyond, compact);
		assert.deepEqual(reversed, expanded);
		assert.ok(states.every(state => Math.abs(state.pageHeight - expanded.pageHeight) <= 1 && Math.abs(state.mainY - expanded.mainY) < 1), "compression must preserve document geometry");
	}
	// Empty history must stay usable without adding artificial scrolling to reach the endpoint.
	await browser("click", "[data-category-tabs] a[href='/archive/history']");
	await browser("wait", "--fn", "location.pathname.replace(/\\/$/, '') === '/archive/history' && document.querySelector('[data-category-tabs]')?.style.getPropertyValue('--tabs-progress') === '0'");
	await browser("set", "media", "light", "reduced-motion");
	await verifyProgress(0, 1);
	assert.equal(await evaluate("getComputedStyle(document.querySelector('.tabs-strip')).backgroundColor"), "rgb(0, 0, 0)");
	await browser("set", "media", "light");
	await verifyProgress(0, 0);
	console.log("Tab progress, reversal, frame batching, cleanup, reduced motion, reload and history restoration pass.");
	console.log("Transparent-to-black styling, responsive compression, alignment, touch targets and stable scroll geometry pass.");
} finally {
	await browser("close");
	server.stop(true);
}
