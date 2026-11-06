// Run: bun tests/playlist-creation.browser.mjs (requires agent-browser).
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import console from "node:console";
import { URL } from "node:url";
import { promisify } from "node:util";
import { build, file, serve } from "bun";

const { Response } = globalThis;

const exec = promisify(execFile);
const session = "archive-playlist-creation";
const bundle = await build({
	entrypoints: ["tests/res/playlist-creation.tsx"],
	target: "browser",
	define: { "import.meta.env.BASE_URL": JSON.stringify("/") },
});
assert.ok(bundle.success, bundle.logs.join("\n"));
const server = serve({
	port: 0,
	fetch(request) {
		const path = new URL(request.url).pathname;
		const output = bundle.outputs.find((item) => path === `/${item.path.split("/").pop()}`);
		if (output) return new Response(output);
		if (path.startsWith("/assets/")) return new Response(file(`public${path}`));
		return new Response('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/playlist-creation.css"><div id="root"></div><script type="module" src="/playlist-creation.js"></script>', { headers: { "Content-Type": "text/html" } });
	},
});
async function browser(...args) {
	const { stdout } = await exec("agent-browser", ["--session", session, ...args], { timeout: 30_000 });
	return stdout.trim();
}
async function evaluate(code) {
	return JSON.parse(await browser("eval", code));
}
const saveDialog = 'dialog[aria-label="Playlist"][open]';
const discardDialog = 'dialog[aria-label="Discard unsaved changes?"][open]';
const newDialog = 'dialog[aria-label="New Playlist"][open]';
const button = (label) => `button[aria-label="${label}"]`;
const wait = (code) => browser("wait", "--fn", code);
const names = () => evaluate("playlistFixture.stores.playlistStore.getAll().map(p => p.title)");
async function openNew() {
	await browser("click", `${saveDialog} ${button("New playlist")}`);
	await browser("wait", newDialog);
	assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'), "Playlist name");
}

try {
	await browser("open", server.url.href);
	await browser("click", button("Save to Playlist"));
	await wait(`!document.querySelector('${saveDialog} ${button("New playlist")}').disabled`);
	// Clean backdrop dismisses; changed selections and notes require confirmation.
	await browser("mouse", "move", "1", "1");
	await browser("mouse", "down");
	await browser("mouse", "up");
	await wait(`!document.querySelector('${saveDialog}')`);
	await browser("click", button("Save to Playlist"));
	await browser("click", `${saveDialog} input[aria-label="Liked Shows"]`);
	await browser("mouse", "move", "1", "1");
	await browser("mouse", "down");
	await browser("mouse", "up");
	await browser("wait", discardDialog);
	await browser("click", `${discardDialog} ${button("Keep editing")}`);
	assert.equal(await evaluate(`document.querySelector('${saveDialog} input[aria-label="Liked Shows"]').checked`), true);
	await browser("press", "Escape");
	await browser("wait", discardDialog);
	await browser("press", "Escape");
	assert.equal(await evaluate(`!!document.querySelector('${saveDialog}') && !document.querySelector('${discardDialog}')`), true);
	await browser("click", `${saveDialog} ${button("Close playlist")}`);
	await browser("click", `${discardDialog} ${button("Discard changes")}`);
	await wait(`!document.querySelector('${saveDialog}')`);
	await browser("click", button("Save to Playlist"));
	assert.equal(await evaluate(`document.querySelector('${saveDialog} input[aria-label="Liked Shows"]').checked`), false);
	await browser("fill", `${saveDialog} textarea`, "Draft note");
	await browser("press", "Escape");
	await browser("wait", discardDialog);
	for (const width of [320, 332, 750, 1440]) {
		await browser("set", "viewport", String(width), "900");
		assert.equal(await evaluate(`(() => {
			const d = document.querySelector('${discardDialog}');
			const r = d.getBoundingClientRect();
			return r.left >= 0 && r.right <= innerWidth && d.scrollWidth <= d.clientWidth;
		})()`), true, `Discard dialog fits at ${width}px`);
	}
	await browser("screenshot", "/tmp/playlist-discard-confirmation.png");
	await browser("click", `${discardDialog} ${button("Discard changes")}`);
	await browser("click", button("Save to Playlist"));
	assert.equal(await evaluate(`document.querySelector('${saveDialog} textarea').value`), "");
	// Reverting edits leaves the form clean.
	await browser("click", `${saveDialog} input[aria-label="Liked Shows"]`);
	await browser("click", `${saveDialog} input[aria-label="Liked Shows"]`);
	await browser("press", "Escape");
	await wait(`!document.querySelector('${saveDialog}')`);
	await browser("click", button("Save to Playlist"));
	await browser("click", `${saveDialog} input[aria-label="Liked Shows"]`);
	await browser("fill", `${saveDialog} textarea`, "Keep my note");
	await openNew();
	await browser("fill", `${newDialog} input`, "   ");
	assert.equal(await evaluate(`document.querySelector('${newDialog} ${button("Create playlist")}').disabled`), true);
	await browser("fill", `${newDialog} input`, "Draft");
	await browser("press", "Escape");
	assert.equal(await evaluate(`document.querySelector('${newDialog}') === null && !!document.querySelector('${saveDialog}')`), true);
	assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'), "New playlist");
	await openNew();
	assert.equal(await evaluate(`document.querySelector('${newDialog} input').value`), "");
	for (let i = 0; i < 5; i++) {
		await browser("press", "Tab");
		// Native dialogs may let Tab visit browser chrome, represented by body focus.
		assert.equal(await evaluate(`document.activeElement === document.body || document.activeElement.closest('dialog') === document.querySelector('${newDialog}')`), true, "Tab cannot reach the underlying form");
	}
	await browser("click", `${newDialog} ${button("Cancel new playlist")}`);
	assert.equal(await evaluate(`!!document.querySelector('${saveDialog}') && !document.querySelector('${newDialog}')`), true);
	await openNew();
	await browser("fill", `${newDialog} input`, "  Road trip  ");
	await browser("press", "Enter");
	await wait(`!document.querySelector('${newDialog}')`);
	assert.equal(await evaluate(`document.querySelector('${saveDialog} input[aria-label="Road trip"]').checked`), true);
	assert.equal(await evaluate(`document.querySelector('${saveDialog} input[aria-label="Liked Shows"]').checked`), true);
	assert.equal(await evaluate(`document.querySelector('${saveDialog} textarea').value`), "Keep my note");
	assert.equal(await evaluate('playlistFixture.stores.playlistStore.getAll().find(p => p.title === "Road trip").shows.length'), 0);
	await browser("click", `${saveDialog} ${button("Save playlist")}`);
	await wait(`!document.querySelector('${saveDialog}')`);
	await browser("reload");
	await browser("click", button("Save to Playlist"));
	await wait(`!!document.querySelector('${saveDialog} input[aria-label="Road trip"]')`);
	assert.equal(await evaluate(`document.querySelector('${saveDialog} input[aria-label="Road trip"]').checked`), true);
	assert.equal(await evaluate(`document.querySelector('${saveDialog} textarea').value`), "Keep my note");

	// Persistence failure must leave the draft intact and be safely retryable.
	await openNew();
	await evaluate("playlistFixture.fail = true; true");
	await browser("fill", `${newDialog} input`, "Retry me");
	await browser("click", `${newDialog} ${button("Create playlist")}`);
	await browser("wait", `${newDialog} [role="alert"]`);
	assert.equal(await evaluate(`document.querySelector('${newDialog} input').value`), "Retry me");
	assert.ok(!(await names()).includes("Retry me"));
	await evaluate("playlistFixture.fail = false; playlistFixture.pause = true; true");
	await browser("click", `${newDialog} ${button("Create playlist")}`);
	const calls = await evaluate("playlistFixture.createCalls");
	await evaluate(`document.querySelector('${newDialog} form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); true`);
	await browser("press", "Escape");
	assert.equal(await evaluate(`!!document.querySelector('${newDialog}')`), true);
	assert.equal(await evaluate("playlistFixture.createCalls"), calls);
	await evaluate("playlistFixture.pause = false; playlistFixture.resume(); true");
	await wait(`!document.querySelector('${newDialog}')`);
	assert.equal((await names()).filter((name) => name === "Retry me").length, 1);
	await browser("click", `${saveDialog} ${button("Close playlist")}`);
	await browser("click", `${discardDialog} ${button("Discard changes")}`);
	await wait(`!document.querySelector('${saveDialog}')`);
	assert.equal(await evaluate('playlistFixture.stores.playlistStore.getAll().find(p => p.title === "Retry me").shows.length'), 0);

	// Standalone creation has no callback; duplicate titles are allowed.
	await browser("click", button("Create standalone playlist"));
	await browser("fill", `${newDialog} input`, "Road trip");
	await browser("click", `${newDialog} ${button("Create playlist")}`);
	await wait(`!document.querySelector('${newDialog}')`);
	assert.equal((await names()).filter((name) => name === "Road trip").length, 2);
	assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'), "Create standalone playlist");

	// The actual miniplayer uses the same nested creation flow.
	await browser("click", button("Select player show"));
	await browser("click", button("Favorite show"));
	await openNew();
	for (const width of [320, 332, 750, 1440]) {
		await browser("set", "viewport", String(width), "900");
		await browser("fill", `${newDialog} input`, "A long playlist name ".repeat(12));
		assert.equal(await evaluate(`(() => {
			const d = document.querySelector('${newDialog}');
			const r = d.getBoundingClientRect();
			return r.left >= 0 && r.right <= innerWidth && d.scrollWidth <= d.clientWidth;
		})()`), true, `Dialog fits at ${width}px`);
		if (width === 320 || width === 1440) {
			await browser("screenshot", `/tmp/playlist-creation-${width}.png`);
		}
	}
	await browser("fill", `${newDialog} input`, "Player playlist");
	await browser("click", `${newDialog} ${button("Create playlist")}`);
	await wait(`!document.querySelector('${newDialog}')`);
	assert.equal(await evaluate(`document.querySelector('${saveDialog} input[aria-label="Player playlist"]').checked`), true);
	await browser("click", `${saveDialog} ${button("Save playlist")}`);
	await wait(`!document.querySelector('${saveDialog}')`);
	assert.equal(await evaluate('playlistFixture.stores.playlistStore.getAll().find(p => p.title === "Player playlist").shows.length'), 1);
	console.log("Playlist creation browser checks passed");
} finally {
	await browser("close").catch(() => {});
	server.stop(true);
}
