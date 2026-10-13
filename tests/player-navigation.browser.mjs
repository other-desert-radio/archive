// Run against `bun run preview`: bun tests/player-navigation.browser.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import console from "node:console";
import process from "node:process";
import { URL } from "node:url";

const session = "archive-density";
const base = process.env["ARCHIVE_PREVIEW_URL"] ?? "http://127.0.0.1:4321/archive-site";
function browser(...args) {
	return execFileSync("agent-browser", ["--session", session, ...args], {
		encoding: "utf8",
	}).trim();
}
function evaluate(code) {
	return JSON.parse(browser("eval", code));
}

browser("open", `${base}/`);
browser("wait", "button[aria-label^='Play ']");
const basePath = new URL(base).pathname;

function rememberIdlePage() {
	evaluate(`(() => {
		Object.defineProperty(document.documentElement, 'moveBefore', {
			value: undefined, configurable: true
		});
		window.idleBody = document.body;
		window.idleHeader = document.querySelector('[data-site-header]');
		window.idlePageLoad = location.pathname;
		document.addEventListener('astro:page-load', () => {
			window.idlePageLoad = location.pathname;
		});
		return true;
	})()`);
}

function verifyIdleSwap(path) {
	browser("wait", "--fn", `window.idlePageLoad.replace(/\\/$/, '') === ${JSON.stringify(path)}`);
	browser("wait", "--fn", "!document.documentElement.hasAttribute('data-astro-transition')");
	assert.equal(evaluate("window.idleBody !== document.body"), true);
	assert.equal(evaluate("window.idleHeader !== document.querySelector('[data-site-header]')"), true);
}

// No widget: the compatibility path must leave Astro's normal body swap intact.
rememberIdlePage();
browser("click", `a[href='${basePath}/djs']`);
browser("wait", "a[aria-label^='View ']");
verifyIdleSwap(`${basePath}/djs`);
browser("click", `a[href='${basePath}/']`);
browser("wait", "button[aria-label^='Play ']");
browser("wait", "--fn", `window.idlePageLoad.replace(/\\/$/, '') === ${JSON.stringify(basePath)}`);
browser("wait", "--fn", "!document.documentElement.hasAttribute('data-astro-transition')");
// A same-origin fixture lets us check the iframe document, independently of
// Mixcloud availability. Moving it would reload it even if DOM identity survived.
evaluate(`(() => {
	// Exercise the compatibility swap even in browsers supporting moveBefore().
	Object.defineProperty(document.documentElement, 'moveBefore', {
		value: undefined, configurable: true
	});
	window.playerHeader = document.querySelector('[data-site-header]');
	window.lastPlayerPageLoad = location.pathname;
	document.addEventListener('astro:page-load', () => {
		window.lastPlayerPageLoad = location.pathname;
	});
	window.playerProbe = document.createElement('iframe');
	window.playerProbe.srcdoc = '<p>Player navigation fixture</p>';
	window.playerProbeLoads = 0;
	window.playerProbe.addEventListener('load', () => window.playerProbeLoads++);
	document.querySelector('[data-miniplayer-bar]').append(window.playerProbe);
	return true;
})()`);
browser("wait", "100");
evaluate("window.playerProbe.contentWindow.playbackPosition = 123; true");

function verifyPlayer(path) {
	browser("wait", "--fn", `window.lastPlayerPageLoad.replace(/\\/$/, '') === ${JSON.stringify(path)}`);
	browser("wait", "--fn", "!document.documentElement.hasAttribute('data-astro-transition')");
	const result = evaluate(String.raw`({
		path: location.pathname.replace(/\/$/, ''),
		sameHeader: window.playerHeader === document.querySelector('[data-site-header]'),
		connected: window.playerProbe.isConnected,
		loads: window.playerProbeLoads,
		position: window.playerProbe.contentWindow.playbackPosition
	})`);
	assert.equal(result.path, path);
	assert.equal(result.sameHeader, true);
	assert.equal(result.connected, true);
	assert.equal(result.loads, 1);
	assert.equal(result.position, 123);
}

browser("click", `a[href='${basePath}/djs']`);
browser("wait", "a[aria-label^='View ']");
verifyPlayer(`${basePath}/djs`);
browser("click", "a[aria-label='View Derek Monypeny']");
browser("wait", `a[href='${basePath}/djs']`);
verifyPlayer(`${basePath}/djs/12`);
browser("back");
verifyPlayer(`${basePath}/djs`);
browser("forward");
verifyPlayer(`${basePath}/djs/12`);
browser("back");
browser("click", `a[href='${basePath}/']`);
browser("wait", "button[aria-label^='Play ']");
verifyPlayer(basePath);

for (const width of [320, 332, 750, 1440]) {
	browser("set", "viewport", String(width), "800");
	const layout = evaluate(`(() => {
		const background = getComputedStyle(document.body, '::before');
		return {
			overflow: document.documentElement.scrollWidth > innerWidth,
			position: background.position,
			height: parseFloat(background.height),
			viewportHeight: innerHeight
		};
	})()`);
	assert.equal(layout.overflow, false, `${width}px horizontal overflow`);
	assert.equal(layout.position, "fixed");
	assert.ok(layout.height >= layout.viewportHeight);
}

// Removing the player restores normal navigation on the very next swap.
evaluate("window.playerProbe.remove(); true");
rememberIdlePage();
browser("click", `a[href='${basePath}/djs']`);
browser("wait", "a[aria-label^='View ']");
verifyIdleSwap(`${basePath}/djs`);
console.log("Idle navigation uses the default swap; active player document survives listing/detail/back/forward navigation; viewport background and responsive widths pass.");
