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
const source = await file("src/styles/styles.css").text();
const compressionScrollPx = Number(source.match(/--tabs-compression-scroll-px: ([\d.]+);/)?.[1]);
const easeOutPower = Number(source.match(/--tabs-ease-out-power: ([\d.]+);/)?.[1]);
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
	if (y > 0 && y < compressionScrollPx) {
		// Small frame-by-frame moves exercise the slow path independently of flings.
		await evaluate(`new Promise(resolve => {
			window.scrollTo(0, scrollY >= ${compressionScrollPx} ? ${compressionScrollPx} : 0);
			const step = () => {
				if (scrollY === ${y}) { resolve(true); return; }
				window.scrollTo(0, scrollY + Math.sign(${y} - scrollY) * Math.min(2, Math.abs(${y} - scrollY)));
				requestAnimationFrame(step);
			};
			requestAnimationFrame(() => requestAnimationFrame(step));
		})`);
	} else {
		await evaluate(`window.scrollTo(0, ${y}); true`);
	}
	await browser("wait", "--fn", `(() => {
		const tabs = document.querySelector('[data-category-tabs]');
		return tabs.style.getPropertyValue('--tabs-progress') === '${progress}'
			&& tabs.hasAttribute('data-compact') === ${progress === 1};
	})()`);
	await browser("wait", "--fn", "document.querySelector('.tabs-strip').getAnimations().length === 0");
	assert.equal(await evaluate("scrollY"), y);
}

async function verifyCompactCategorySwitch(driver, destination) {
	await evaluate(`(() => {
		window.categorySwapState = undefined;
		document.addEventListener('astro:after-swap', () => {
			const tabs = document.querySelector('[data-category-tabs]');
			window.categorySwapState = {
				progress: Number(getComputedStyle(tabs).getPropertyValue('--tabs-progress')),
				background: getComputedStyle(tabs.querySelector('.tabs-strip')).backgroundColor,
			};
		}, { once: true });
		return true;
	})()`);
	await browser("click", `[data-category-tabs] a[href='/archive/${destination}']`);
	await browser("wait", "--fn", `location.pathname.replace(/\\/$/, '') === '/archive/${destination}' && document.querySelector('header[data-tabs-driver=${driver}]') !== null && scrollY >= ${compressionScrollPx} && Number(getComputedStyle(document.querySelector('[data-category-tabs]')).getPropertyValue('--tabs-progress')) === 1`);
	await browser("wait", "--fn", "!document.documentElement.hasAttribute('data-astro-transition')");
	assert.deepEqual(await evaluate("window.categorySwapState"), { progress: 1, background: "rgb(0, 0, 0)" }, "the replacement strip must already be compact during the swap");
}

let forceFallback = true;
const server = serve({
	hostname: "127.0.0.1",
	port: 0,
	async fetch(request) {
		const path = new URL(request.url).pathname.replace(/^\/archive\/?/, "");
		const assetPath = path && !path.split("/").at(-1).includes(".")
			? `${path.replace(/\/$/, "")}/index.html` : path || "index.html";
		const asset = file(`dist/${assetPath}`);
		if (forceFallback && assetPath.endsWith(".html") && await asset.exists()) {
			const html = (await asset.text()).replace("<head>", `<head><script>
				(() => {
					const supports = CSS.supports.bind(CSS);
					CSS.supports = (...args) => args.some(arg => arg.includes('animation-timeline')) ? false : supports(...args);
				})();
			</script>`);
			return new Response(html, { headers: { "Content-Type": "text/html" } });
		}
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
		window.scrollTo(0, ${halfwayScroll});
		for (let i = 0; i < 10; i++) window.dispatchEvent(new Event('scroll'));
		requestAnimationFrame(() => {
			tabs.style.setProperty = original;
			resolve(changes);
		});
	})`), 1);
	await verifyProgress(0, 0);
	await verifyProgress(compressionScrollPx * 2, 1);
	assert.equal(await evaluate(`new Promise(resolve => {
		const tabs = document.querySelector('[data-category-tabs]');
		let changes = 0;
		const observer = new MutationObserver(records => { changes += records.length; });
		observer.observe(tabs, { attributes: true });
		window.scrollTo(0, ${compressionScrollPx * 3});
		window.dispatchEvent(new Event('scroll'));
		requestAnimationFrame(() => requestAnimationFrame(() => {
			observer.disconnect();
			resolve(changes);
		}));
	})`), 0, "scrolling beyond compact must not rewrite styles or attributes");
	await verifyProgress(0, 0);

	// Disposal must cancel queued work and stop updates on the outgoing element.
	assert.equal(await evaluate(`new Promise(resolve => {
		const tabs = document.querySelector('[data-category-tabs]');
		window.scrollTo(0, ${halfwayScroll});
		window.dispatchEvent(new Event('scroll'));
		const swap = new Event('astro:before-swap');
		Object.defineProperty(swap, 'newDocument', { value: document.implementation.createHTMLDocument('') });
		document.dispatchEvent(swap);
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
	await verifyProgress(0, 0);
	await evaluate(`window.scrollTo(0, ${halfwayScroll}); true`);
	await browser("wait", "--fn", "document.querySelector('[data-category-tabs]').hasAttribute('data-compact')");
	assert.equal(await evaluate("getComputedStyle(document.querySelector('.tabs-strip')).transitionDuration"), "0s", "fast downward scrolling must skip transitions");
	// A slower continuation in the same direction must not bounce out of the snapped state.
	await evaluate(`new Promise(resolve => requestAnimationFrame(() => {
		window.scrollBy(0, 1);
		requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
	}))`);
	assert.equal(await evaluate("document.querySelector('[data-category-tabs]').style.getPropertyValue('--tabs-progress')"), "1");
	await verifyProgress(compressionScrollPx * 4, 1);
	await evaluate(`window.scrollTo(0, ${compressionScrollPx * 3}); true`);
	await browser("wait", "--fn", "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))");
	assert.equal(await evaluate("document.querySelector('[data-category-tabs]').hasAttribute('data-compact')"), true, "fast upward scrolling farther down must stay compact");
	await evaluate(`window.scrollTo(0, ${halfwayScroll}); true`);
	await browser("wait", "--fn", "document.querySelector('[data-category-tabs]').style.getPropertyValue('--tabs-progress') === '0'");
	assert.equal(await evaluate("getComputedStyle(document.querySelector('.tabs-strip')).transitionDuration"), "0s", "fast return near the top must expand immediately");
	await verifyProgress(0, 0);
	await verifyProgress(halfwayScroll, halfwayProgress);
	await verifyProgress(0, 0);
	await verifyProgress(1, 1 - (1 - 1 / compressionScrollPx) ** easeOutPower);
	const topState = await evaluate(`new Promise(resolve => {
		window.scrollTo(0, 0);
		requestAnimationFrame(() => requestAnimationFrame(() => {
			window.dispatchEvent(new Event('scroll'));
			requestAnimationFrame(() => {
				const tabs = document.querySelector('[data-category-tabs]');
				const strip = tabs.querySelector('.tabs-strip');
				resolve({ expanded: tabs.hasAttribute('data-expanded'), background: getComputedStyle(strip).backgroundColor, transition: getComputedStyle(strip).transitionDuration, animations: strip.getAnimations().length });
			});
		}));
	})`);
	assert.deepEqual(topState, { expanded: true, background: "rgba(0, 0, 0, 0)", transition: "0s", animations: 0 }, "returning to the top must clear black immediately, including a settling scroll event");
	// Empty history must stay usable without adding artificial scrolling to reach the endpoint.
	await browser("click", "[data-category-tabs] a[href='/archive/history']");
	await browser("wait", "--fn", "location.pathname.replace(/\\/$/, '') === '/archive/history' && document.querySelector('[data-category-tabs]')?.style.getPropertyValue('--tabs-progress') === '0'");
	await browser("set", "media", "light", "reduced-motion");
	await verifyProgress(0, 1);
	assert.equal(await evaluate("getComputedStyle(document.querySelector('.tabs-strip')).backgroundColor"), "rgb(0, 0, 0)");
	await browser("set", "media", "light");
	await verifyProgress(0, 0);
	await browser("click", "[data-category-tabs] a[href='/archive/djs']");
	await browser("wait", "--fn", "location.pathname.replace(/\\/$/, '') === '/archive/djs' && document.querySelector('header[data-tabs-driver=js]') !== null");
	await browser("wait", "--fn", "!document.documentElement.hasAttribute('data-astro-transition')");
	await verifyProgress(compressionScrollPx * 4, 1);
	await verifyCompactCategorySwitch("js", "history");
	console.log("Tab progress, reversal, frame batching, cleanup, reduced motion, reload and history restoration pass.");
	console.log("Transparent-to-black styling, responsive compression, alignment, touch targets and stable scroll geometry pass.");
	console.log("Fast flings snap without transitions, upward scrolling stays compact outside the top zone, and slow scrolling restores easing.");
	// Exercise the real supported path separately from the forced fallback above.
	forceFallback = false;
	await browser("set", "media", "light");
	await browser("open", `${base}/djs`);
	await browser("wait", "header[data-tabs-driver='css']");
	await evaluate("document.fonts.ready.then(() => true)");
	for (const width of [320, 332, 750, 1440, 2000]) {
		await browser("set", "viewport", String(width), "800");
		const states = [];
		for (const y of [0, halfwayScroll, compressionScrollPx, compressionScrollPx * 4, halfwayScroll, 0]) {
			const progress = 1 - (1 - Math.min(1, y / compressionScrollPx)) ** easeOutPower;
			await evaluate(`window.scrollTo(0, ${y}); true`);
			await browser("wait", "--fn", `Math.abs(Number(getComputedStyle(document.querySelector('[data-category-tabs]')).getPropertyValue('--tabs-progress')) - ${progress}) < 0.001`);
			const state = await evaluate(`(() => {
				const header = document.querySelector('[data-site-header]');
				const tabs = document.querySelector('[data-category-tabs]');
				const strip = tabs.querySelector('.tabs-strip');
				const link = strip.querySelector('a');
				return {
					font: parseFloat(getComputedStyle(link).fontSize),
					left: link.getBoundingClientRect().left,
					titleLeft: header.querySelector('.leading-box').getBoundingClientRect().left,
					background: getComputedStyle(strip).backgroundColor,
					color: getComputedStyle(link).color,
					timeline: getComputedStyle(header).animationTimeline,
					transition: getComputedStyle(strip).transitionDuration,
					inlineProgress: tabs.style.getPropertyValue('--tabs-progress') || header.style.getPropertyValue('--tabs-progress'),
					mainY: document.querySelector('main').getBoundingClientRect().top + scrollY,
					overflow: document.documentElement.scrollWidth > innerWidth,
					hitTargets: [...tabs.querySelectorAll('a')].every(a => a.getBoundingClientRect().width >= 44 && a.getBoundingClientRect().height >= 44)
				};
			})()`);
			assert.equal(state.inlineProgress, "", "native scrolling must not write progress through JavaScript");
			assert.ok(state.timeline.includes("scroll(root"), JSON.stringify(state));
			assert.equal(state.transition, "0s", "native colors must follow scroll without a trailing timed transition");
			assert.equal(state.color, progress >= 0.5 ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)");
			const channels = state.background.match(/[\d.]+/g).map(Number);
			assert.ok(Math.abs((channels[3] ?? 1) - progress) < 0.005);
			assert.equal(state.overflow, false);
			assert.equal(state.hitTargets, true);
			states.push(state);
		}
		const [expanded, halfway, compact, beyond, reverseHalfway, reversed] = states;
		assert.ok(expanded.font > halfway.font && halfway.font > compact.font);
		assert.ok(Math.abs((expanded.font - halfway.font) / (expanded.font - compact.font) - halfwayProgress) < 0.01);
		assert.ok(Math.abs(compact.left - compact.titleLeft) < 1);
		assert.deepEqual(compact, beyond);
		assert.deepEqual(halfway, reverseHalfway);
		assert.deepEqual(expanded, reversed);
		assert.ok(states.every(state => Math.abs(state.mainY - expanded.mainY) < 1));
	}
	await browser("click", "[data-category-tabs] a[href='/archive/explore']");
	await browser("wait", "--fn", "location.pathname.replace(/\\/$/, '') === '/archive/explore' && document.querySelector('header[data-tabs-driver=css]') !== null");
	await browser("wait", "--fn", "!document.documentElement.hasAttribute('data-astro-transition')");
	await browser("click", "[data-category-tabs] a[href='/archive/history']");
	await browser("wait", "--fn", "location.pathname.replace(/\\/$/, '') === '/archive/history' && document.querySelector('header[data-tabs-driver=css]') !== null");
	await browser("wait", "--fn", "!document.documentElement.hasAttribute('data-astro-transition')");
	await browser("set", "media", "light", "reduced-motion");
	await browser("wait", "--fn", "getComputedStyle(document.querySelector('[data-category-tabs]')).getPropertyValue('--tabs-progress').trim() === '1'");
	assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-site-header]')).animationName"), "none");
	assert.equal(await evaluate("getComputedStyle(document.querySelector('.tabs-strip')).backgroundColor"), "rgb(0, 0, 0)");
	await browser("set", "media", "light");
	await browser("wait", "--fn", "getComputedStyle(document.querySelector('[data-category-tabs]')).getPropertyValue('--tabs-progress').trim() === '0'");
	await browser("click", "[data-category-tabs] a[href='/archive/djs']");
	await browser("wait", "--fn", "location.pathname.replace(/\\/$/, '') === '/archive/djs' && document.querySelector('header[data-tabs-driver=css]') !== null");
	await browser("wait", "--fn", "!document.documentElement.hasAttribute('data-astro-transition')");
	await evaluate(`window.scrollTo(0, ${compressionScrollPx * 4}); true`);
	await browser("wait", "--fn", "Number(getComputedStyle(document.querySelector('[data-category-tabs]')).getPropertyValue('--tabs-progress')) === 1");
	await verifyCompactCategorySwitch("css", "history");
	await browser("back");
	await browser("wait", "--fn", `location.pathname.replace(/\\/$/, '') === '/archive/djs' && scrollY === ${compressionScrollPx * 4} && Number(getComputedStyle(document.querySelector('[data-category-tabs]')).getPropertyValue('--tabs-progress')) === 1`);
	await browser("wait", "--fn", "!document.documentElement.hasAttribute('data-astro-transition')");
	await browser("forward");
	await browser("wait", "--fn", `location.pathname.replace(/\\/$/, '') === '/archive/history' && scrollY >= ${compressionScrollPx} && Number(getComputedStyle(document.querySelector('[data-category-tabs]')).getPropertyValue('--tabs-progress')) === 1`);
	await browser("wait", "--fn", "!document.documentElement.hasAttribute('data-astro-transition')");
	await browser("reload");
	await browser("wait", "--fn", `document.querySelector('header[data-tabs-driver=css]') !== null && scrollY >= ${compressionScrollPx} && Number(getComputedStyle(document.querySelector('[data-category-tabs]')).getPropertyValue('--tabs-progress')) === 1`);
	await evaluate(`(() => {
		Object.defineProperty(Element.prototype, 'moveBefore', { value: undefined, configurable: true });
		window.tabsPlayerHeader = document.querySelector('[data-site-header]');
		window.tabsPlayerProbe = document.createElement('iframe');
		window.tabsPlayerProbe.style.cssText = 'width:1px;height:1px;display:block';
		window.tabsPlayerProbe.srcdoc = '<p>Category player fixture</p>';
		document.querySelector('[data-miniplayer-bar]').append(window.tabsPlayerProbe);
		return true;
	})()`);
	await browser("wait", "--fn", "window.tabsPlayerProbe.contentDocument?.body.textContent.includes('Category player fixture')");
	await evaluate("window.tabsPlayerProbe.contentWindow.playbackPosition = 123; true");
	await verifyCompactCategorySwitch("css", "djs");
	assert.equal(await evaluate("window.tabsPlayerHeader === document.querySelector('[data-site-header]') && window.tabsPlayerProbe.isConnected && window.tabsPlayerProbe.contentWindow.playbackPosition === 123"), true, "compact navigation must preserve the player document");
	await evaluate("window.scrollTo(0, 0); true");
	await browser("wait", "--fn", "Number(getComputedStyle(document.querySelector('[data-category-tabs]')).getPropertyValue('--tabs-progress')) === 0");
	console.log("Native CSS timelines, eased progress, immediate color reversal, responsive layout, navigation and reduced motion pass.");
	console.log("Compact category entry, empty History, Back/Forward, reload and player-preserving swaps pass.");
} catch (error) {
	console.error(await evaluate(`({ path: location.pathname, y: scrollY, driver: document.querySelector('[data-site-header]')?.dataset.tabsDriver, progress: document.querySelector('[data-category-tabs]')?.style.getPropertyValue('--tabs-progress'), computed: getComputedStyle(document.querySelector('[data-category-tabs]')).getPropertyValue('--tabs-progress') })`));
	throw error;
} finally {
	await browser("close");
	server.stop(true);
}
