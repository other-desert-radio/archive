// Build first, then run: bun tests/mobile-navigation.browser.mjs
// Uses Chromium touch input; Safari's fetch-prefetch fallback is exercised too.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import console from "node:console";
import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers";
import { URL } from "node:url";
import { promisify } from "node:util";
import { file as bunFile, serve } from "bun";

const { Response, WebSocket } = globalThis;

const exec = promisify(execFile);
const session = "archive-mobile-performance";
const latency = 800;
async function browser(...args) {
	const { stdout } = await exec("agent-browser", [
		"--session",
		session,
		...args,
	]);
	return stdout.trim();
}
async function evaluate(code) {
	return JSON.parse(await browser("eval", code));
}

// Send genuine touch events rather than synthesizing a click or using a mouse.
async function touchClient() {
	const socket = new WebSocket(await browser("get", "cdp-url"));
	await new Promise((resolve, reject) => {
		socket.addEventListener("open", resolve, { once: true });
		socket.addEventListener("error", reject, { once: true });
	});
	let id = 0;
	const pending = new Map();
	socket.addEventListener("message", ({ data }) => {
		const message = JSON.parse(data);
		const task = pending.get(message.id);
		if (!task) return;
		pending.delete(message.id);
		if (message.error) task.reject(new Error(message.error.message));
		else task.resolve(message.result);
	});
	function send(method, params = {}, sessionId) {
		return new Promise((resolve, reject) => {
			const request = ++id;
			pending.set(request, { resolve, reject });
			socket.send(JSON.stringify({ id: request, method, params, sessionId }));
		});
	}
	const { targetInfos } = await send("Target.getTargets");
	const target = targetInfos.find(
		(item) => item.type === "page" && item.url.includes("/archive-site/"),
	);
	assert.ok(target, "local archive tab exists");
	const { sessionId } = await send("Target.attachToTarget", {
		targetId: target.targetId,
		flatten: true,
	});
	return {
		async tap(x, y) {
			await send(
				"Input.dispatchTouchEvent",
				{ type: "touchStart", touchPoints: [{ x, y }] },
				sessionId,
			);
			await send(
				"Input.dispatchTouchEvent",
				{ type: "touchEnd", touchPoints: [] },
				sessionId,
			);
		},
		close: () => socket.close(),
	};
}

function fixtureServer({ warm = true, fallback = false, details = false }) {
	const requests = [];
	// Keep deliberately slow artwork on a separate origin, like the Mixcloud
	// CDN. Otherwise HTTP/1 connection limits create artificial HTML starvation.
	const artworkServer = serve({
		port: 0,
		hostname: "127.0.0.1",
		async fetch() {
			if (details) {
				await new Promise((resolve) => setTimeout(resolve, 2000));
			}
			return new Response(
				'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"/>',
				{
					headers: { "Content-Type": "image/svg+xml" },
				},
			);
		},
	});
	// A fresh origin keeps the cold/warm comparisons independent. HTML caching
	// matches the static host contract; latency applies only to network misses.
	const server = serve({
		port: 0,
		hostname: "127.0.0.1",
		async fetch(request) {
			const path = new URL(request.url).pathname.replace(
				/^\/archive-site\/?/,
				"",
			);
			if (path.includes(".."))
				return new Response("Invalid path", { status: 400 });
			const html = !path.split("/").at(-1).includes(".");
			const file = `dist/${html ? `${path.replace(/\/$/, "")}/index.html` : path}`;
			try {
				if (!html) {
					const asset = bunFile(file);
					return (await asset.exists())
						? new Response(asset)
						: new Response("Not found", { status: 404 });
				}
				await new Promise((resolve) => setTimeout(resolve, latency));
				let body = await readFile(file, "utf8");
				if (!warm || details)
					body = body.replaceAll(
						'data-astro-prefetch="viewport"',
						'data-astro-prefetch="false"',
					);
				body = body.replace(/<img\b[^>]*>/g, (image, index) =>
					image.replace(
						/src="[^"]+"/,
						`src="http://127.0.0.1:${artworkServer.port}/${index}.svg"`,
					),
				);
				if (details) {
					// Measure rendered HTML independently of deferred hydration/modules.
					// DOMContentLoaded can wait for scripts long after text is visible.
					body = body.replace(
						"</main>",
						`</main><script>
            requestAnimationFrame(() => requestAnimationFrame(() => {
              window.contentReadyAt = Date.now();
            }));
          </script>`,
					);
				}
				if (fallback) {
					body = body.replace(
						"<head>",
						`<head><script>
						const supports = DOMTokenList.prototype.supports;
						DOMTokenList.prototype.supports = function(token) {
							return token === 'prefetch' ? false : supports.call(this, token);
						};
					</script>`,
					);
				}
				requests.push(new URL(request.url).pathname);
				return new Response(body, {
					headers: {
						"Content-Type": "text/html",
						"Cache-Control": details ? "no-store" : "public, max-age=600",
					},
				});
			} catch {
				return new Response("Not found", { status: 404 });
			}
		},
	});
	return { server, artworkServer, requests };
}

async function scenario({ warm, fallback }) {
	const { server, artworkServer, requests } = fixtureServer({ warm, fallback });
	let touch;
	try {
		await browser("set", "device", "iPhone 12");
		await browser(
			"open",
			`http://127.0.0.1:${server.port}/archive-site/explore`,
		);
		await browser("wait", ".tabs");
		touch = await touchClient();
		assert.equal(await evaluate("matchMedia('(hover: hover)').matches"), false);
		const timings = [];
		const destinations = warm
			? ["djs", "history", "", "explore"]
			: ["djs", "history"];
		for (const destination of destinations) {
			if (warm) {
				await browser(
					"wait",
					"--fn",
					`performance.getEntriesByType('resource').some(r => new URL(r.name).pathname === '/archive-site/${destination}')`,
				);
			}
			const before = requests.filter(
				(path) => path === `/archive-site/${destination}`,
			).length;
			const point = await evaluate(`(() => {
				window.navigationTiming = {};
				for (const event of ['touchend', 'click']) document.addEventListener(event, () => {
					window.navigationTiming[event] = performance.now();
				}, { once: true });
				document.addEventListener('astro:after-swap', () => {
					window.navigationTiming.swap = performance.now();
				}, { once: true });
				document.addEventListener('astro:before-swap', event => {
					event.viewTransition.ready.then(() => {
						requestAnimationFrame(() => requestAnimationFrame(() => {
							window.navigationTiming.rendered = performance.now();
						}));
					});
				}, { once: true });
				const rect = document.querySelector('.tabs a[href="/archive-site/${destination}"]').getBoundingClientRect();
				return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
			})()`);
			await touch.tap(point.x, point.y);
			await browser(
				"wait",
				"--fn",
				"Number.isFinite(window.navigationTiming.rendered)",
			);
			const timing = await evaluate(`({
				tapToClick: window.navigationTiming.click - window.navigationTiming.touchend,
				clickToSwap: window.navigationTiming.swap - window.navigationTiming.click,
				clickToRendered: window.navigationTiming.rendered - window.navigationTiming.click
			})`);
			assert.ok(timing.tapToClick < 150, "touch does not wait for double tap");
			if (warm) {
				assert.equal(
					requests.filter((path) => path === `/archive-site/${destination}`)
						.length,
					before,
					"tap reuses prefetched HTML without a network round trip",
				);
				assert.ok(
					timing.clickToRendered < latency / 2,
					`warm tab renders in ${timing.clickToRendered}ms; budget ${latency / 2}ms`,
				);
			} else {
				assert.ok(
					timing.clickToSwap >= latency,
					"cold navigation reproduces network wait",
				);
			}
			timings.push({ destination, ...timing });
		}
		return timings;
	} finally {
		touch?.close();
		await browser("close");
		await server.stop(true);
		await artworkServer.stop(true);
	}
}

async function detailNavigation() {
	const { server, artworkServer, requests } = fixtureServer({ details: true });
	let touch;
	try {
		await browser("set", "device", "iPhone 12");
		const timings = [];
		for (const [listing, selector] of [
			["djs", "a[href^='/archive-site/djs/']"],
			["", "a[href^='/archive-site/shows/']"],
			["explore", "a[href^='/archive-site/tags/']"],
		]) {
			await browser(
				"open",
				`http://127.0.0.1:${server.port}/archive-site/${listing}`,
			);
			await browser("wait", selector);
			touch ??= await touchClient();
			for (const link of [selector, "nav a.leading-box"]) {
				const destination = await evaluate(
					`new URL(document.querySelector(${JSON.stringify(link)}).href).pathname`,
				);
				const before = requests.filter((path) => path === destination).length;
				const point = await evaluate(`(() => {
          window.contentReadyAt = undefined;
          window.detailDocumentMarker = true;
          document.addEventListener('click', () => {
            sessionStorage.setItem('performance-tap', Date.now().toString());
          }, { once: true, capture: true });
          const rect = document.querySelector(${JSON.stringify(link)}).getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        })()`);
				await touch.tap(point.x, point.y);
				await browser(
					"wait",
					"--fn",
					`location.pathname === ${JSON.stringify(destination)} && Number.isFinite(window.contentReadyAt)`,
				);
				const result = await evaluate(`({
          clickToContent: window.contentReadyAt - Number(sessionStorage.getItem('performance-tap')),
          newDocument: window.detailDocumentMarker === undefined,
          textVisible: document.querySelector('main').getBoundingClientRect().height > 0,
          pendingArtwork: [...document.querySelectorAll('main img')].some(img => !img.complete)
        })`);
				assert.equal(
					result.newDocument,
					true,
					`${destination}: bypass client transitions`,
				);
				assert.equal(
					result.textVisible,
					true,
					`${destination}: main content is visible`,
				);
				assert.equal(
					requests.filter((path) => path === destination).length - before,
					1,
					`${destination}: one HTML request, without router fetch then reload`,
				);
				assert.ok(
					result.clickToContent < latency + 500,
					`${destination}: content ready in ${result.clickToContent}ms; budget ${latency + 500}ms including ${latency}ms network delay`,
				);
				if (/\/(shows|djs)\/\d+/.test(destination)) {
					assert.equal(
						result.pendingArtwork,
						true,
						`${destination}: content renders before slow artwork`,
					);
				}
				timings.push({ destination, ...result });
			}
		}
		return timings;
	} finally {
		touch?.close();
		await browser("close");
		await server.stop(true);
		await artworkServer.stop(true);
	}
}

for (const config of [
	{ warm: false, fallback: false },
	{ warm: true, fallback: false },
	{ warm: true, fallback: true },
]) {
	console.log(JSON.stringify({ ...config, timings: await scenario(config) }));
}
console.log(
	JSON.stringify({ details: true, timings: await detailNavigation() }),
);
