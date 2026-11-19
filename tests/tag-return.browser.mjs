// Build first, then run: bun tests/tag-return.browser.mjs
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import console from "node:console";
import { URL } from "node:url";
import { promisify } from "node:util";
import { file, serve } from "bun";

const { Response } = globalThis;
const exec = promisify(execFile);
async function browser(...args) {
	return (await exec("agent-browser", ["--session", "tag-return", ...args])).stdout.trim();
}
let denyStorage = false;
const server = serve({
	hostname: "127.0.0.1",
	port: 0,
	async fetch(request) {
		const path = new URL(request.url).pathname.replace(/^\//, "");
		if (path.startsWith("resources/")) {
			return new Response("Catalog unavailable", { status: 503 });
		}
		const assetPath = path && !path.split("/").at(-1).includes(".")
			? `${path.replace(/\/$/, "")}/index.html` : path || "index.html";
		const asset = file(`dist/${assetPath}`);
		if (!await asset.exists()) return new Response("Missing", { status: 404 });
		if (denyStorage && assetPath.endsWith(".html")) {
			return new Response((await asset.text()).replace("<head>", `<head><script>Object.defineProperty(window, 'indexedDB', {get() { throw new Error('Storage unavailable'); }});</script>`), {
				headers: { "Content-Type": "text/html" },
			});
		}
		return new Response(asset);
	},
});
try {
	const tag = (await file("public/resources/tags.json").json()).data[0];
	const show = (await file("public/resources/shows.json").json()).data[0];
	const dj = (await file("public/resources/djs_brief.json").json()).data[0];
	for (const storageUnavailable of [false, true]) {
		denyStorage = storageUnavailable;
		for (const [kind, entity, fallback] of [["shows", show, "/"], ["djs", dj, "/djs"]]) {
			for (const [query, href, label] of [
				[`?fromTag=${tag.id}`, `/tags/${tag.id}`, tag.title.toUpperCase()],
				["?fromTag=invalid", fallback, kind.toUpperCase()],
			]) {
				await browser("open", `http://127.0.0.1:${server.port}/${kind}/${entity.id}${query}`);
				await browser("wait", "--fn", `(() => {
					const link = document.querySelector('[data-tag-return]');
					return link?.pathname === ${JSON.stringify(href)} && link.querySelector('b').textContent === ${JSON.stringify(label)};
				})()`);
				assert.equal(await browser("eval", "document.querySelector('[data-tag-return]').pathname"), JSON.stringify(href));
			}
		}
	}
	console.log("Direct show/DJ returns resolve from built HTML with failed catalog requests and unavailable IndexedDB; invalid tags retain listing defaults.");
} finally {
	await browser("close");
	server.stop(true);
}
