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

function verifyPlayerLayout(width) {
	browser("wait", "--fn", `(() => {
		const bar = document.querySelector('[data-miniplayer-bar]');
		return Math.abs(parseFloat(document.documentElement.style.getPropertyValue('--miniplayer-height')) - bar.getBoundingClientRect().height) < 1;
	})()`);
	const layout = evaluate(`(() => {
		const bar = document.querySelector('[data-miniplayer-bar]');
		const rect = bar.getBoundingClientRect();
		const main = document.querySelector('main');
		const spacing = document.createElement('div');
		spacing.style.cssText = 'position: absolute; height: var(--container-grid-padding-bottom); visibility: hidden';
		main.append(spacing);
		const baseClearance = spacing.getBoundingClientRect().height;
		spacing.remove();
		return {
			position: getComputedStyle(bar).position,
			bottom: rect.bottom,
			left: rect.left,
			right: rect.right,
			height: rect.height,
			viewportHeight: innerHeight,
			viewportWidth: innerWidth,
			navBottom: document.querySelector('nav').getBoundingClientRect().bottom,
			top: rect.top,
			clearance: parseFloat(getComputedStyle(main).paddingBottom),
			baseClearance
		};
	})()`);
	if (width <= 600) {
		assert.equal(layout.position, "fixed");
		assert.ok(Math.abs(layout.bottom - layout.viewportHeight) < 1);
		assert.equal(layout.left, 0);
		assert.equal(layout.right, layout.viewportWidth);
		assert.ok(Math.abs(layout.clearance - layout.baseClearance - layout.height) < 1);
	} else {
		assert.equal(layout.position, "static");
		assert.ok(Math.abs(layout.top - layout.navBottom) < 1);
		assert.ok(Math.abs(layout.clearance - layout.baseClearance) < 1);
	}
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
	verifyPlayerLayout(evaluate("innerWidth"));
}

// Navigate with the bottom-docked player as well as checking the desktop layout.
browser("set", "viewport", "600", "800");
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

for (const [width, height] of [[320, 800], [332, 600], [600, 800], [601, 800], [750, 800], [1440, 800], [844, 390]]) {
	browser("set", "viewport", String(width), String(height));
	browser("scroll", "down", "10000");
	const layout = evaluate(`(() => {
		const layer = document.querySelector('.site-background');
		const background = getComputedStyle(layer);
		const rect = layer.getBoundingClientRect();
		return {
			overflow: document.documentElement.scrollWidth > innerWidth,
			position: background.position,
			headerTop: document.querySelector('[data-site-header]').getBoundingClientRect().top,
			top: rect.top,
			bottom: rect.bottom,
			viewportHeight: innerHeight,
			attachment: background.backgroundAttachment,
			zIndex: background.zIndex,
			canvasImage: getComputedStyle(document.documentElement).backgroundImage,
			viewport: document.querySelector('meta[name="viewport"]').content,
			touchAction: getComputedStyle(document.querySelector('.tabs a')).touchAction
		};
	})()`);
	assert.equal(layout.overflow, false, `${width}px horizontal overflow`);
	assert.equal(layout.position, "fixed");
	assert.ok(Math.abs(layout.headerTop) < 1, `${width}px header must remain sticky after scrolling`);
	assert.equal(layout.top, 0);
	assert.ok(layout.bottom >= layout.viewportHeight);
	assert.equal(layout.attachment, "scroll");
	assert.equal(layout.zIndex, "0");
	assert.ok(layout.canvasImage.includes("background.jpeg"));
	assert.ok(layout.viewport.includes("viewport-fit=cover"));
	assert.equal(layout.touchAction, "manipulation");
	verifyPlayerLayout(width);
}
browser("scroll", "up", "10000");

// Emulate an inset to verify that padding stays inside the background and the
// measured clearance includes it. Desktop emulation has no physical iOS inset.
browser("set", "viewport", "390", "844");
evaluate("document.querySelector('[data-miniplayer-bar]').style.paddingBottom = '34px'; true");
verifyPlayerLayout(390);
evaluate("window.playerProbe.style.height = '15rem'; true");
verifyPlayerLayout(390);
evaluate("document.querySelector('[data-miniplayer-bar]').style.removeProperty('padding-bottom'); true");

// Touch emulation must not expose the inactive tab's desktop hover border.
browser("set", "device", "iPhone 12");
browser("hover", `a[href='${basePath}/djs']`);
const touchTab = evaluate(`(() => {
	const tab = document.querySelector('.tabs a:not([aria-current])');
	return {
		hover: matchMedia('(hover: hover)').matches,
		border: getComputedStyle(tab).borderBottomWidth,
		touchAction: getComputedStyle(tab).touchAction,
		highlight: getComputedStyle(tab).webkitTapHighlightColor
	};
})()`);
assert.equal(touchTab.hover, false);
assert.equal(touchTab.border, "0px");
assert.equal(touchTab.touchAction, "manipulation");
assert.equal(touchTab.highlight, "rgba(0, 0, 0, 0)");

// Removing the player restores Astro's default swap on the next click.
evaluate("window.playerProbe.remove(); true");
browser("wait", "--fn", "document.querySelector('[data-miniplayer-bar]').getBoundingClientRect().height === 0 && document.documentElement.style.getPropertyValue('--miniplayer-height') === '0px'");
rememberIdlePage();
browser("click", `a[href='${basePath}/djs']`);
browser("wait", "a[aria-label^='View ']");
verifyIdleSwap(`${basePath}/djs`);
console.log("Idle navigation uses the default swap; active player document survives listing/detail/back/forward navigation; bottom docking, dynamic clearance, viewport background and responsive widths pass.");


// Exercise the real React player with a same-origin iframe document, so
// fullscreen identity checks do not depend on Mixcloud network/playback readiness.
browser("open", `${base}/`);
browser("wait", "button[aria-label^='Play ']");
evaluate("document.querySelector('button[aria-label^=\"Play \"]').click(); true");
browser("wait", "[data-miniplayer] iframe");
evaluate(`(() => {
	window.fullscreenFrame = document.querySelector('[data-miniplayer] iframe');
	window.fullscreenFrame.srcdoc = '<p>Fullscreen playback fixture</p>';
	return true;
})()`);
browser("wait", "--fn", "window.fullscreenFrame.contentDocument?.body.textContent.includes('Fullscreen playback fixture')");
evaluate("window.fullscreenDocument = window.fullscreenFrame.contentDocument; true");
for (const [width, height] of [[390, 844], [600, 844], [601, 844], [750, 844], [840, 782], [1440, 844], [2560, 844]]) {
	browser("set", "viewport", String(width), String(height));
	evaluate("window.scrollTo(0, 200); true");
	const savedScrollY = evaluate("window.scrollY");
	const savedBodyStyles = evaluate("document.body.style.cssText");
	const compactHeight = evaluate("document.querySelector('[data-miniplayer-bar]').getBoundingClientRect().height");
	const expand = width <= 600
		? '[data-miniplayer] > button[aria-label="Expand player"]'
		: '[data-miniplayer] div > button[aria-label="Expand player"]';
	browser("click", expand);
	browser("wait", '[data-presentation="fullscreen"]');
	browser("wait", "--fn", "document.body.style.position === 'fixed'");
	const lockedTop = evaluate("document.body.getBoundingClientRect().top");
	browser("scroll", "down", "400");
	assert.equal(evaluate("document.body.getBoundingClientRect().top"), lockedTop);
	assert.equal(evaluate("getComputedStyle(document.documentElement).overflow"), "hidden");
	const fullscreen = evaluate(`(() => {
		const player = document.querySelector('[data-miniplayer]');
		const rect = player.getBoundingClientRect();
		const frame = player.querySelector('iframe');
		const artwork = player.querySelector('[class*="fullscreen-artwork"] img');
		const title = player.querySelector('[class*="fullscreen-title"]');
		const tagLinks = [...player.querySelectorAll('[class*="fullscreen-tags"] a')];
		return {
			x: rect.x, y: rect.y, width: rect.width, height: rect.height,
			viewportWidth: innerWidth, viewportHeight: innerHeight,
			barHeight: document.querySelector('[data-miniplayer-bar]').getBoundingClientRect().height,
			sameFrame: frame === window.fullscreenFrame,
			sameDocument: frame.contentDocument === window.fullscreenDocument,
			frameBottom: frame.getBoundingClientRect().bottom,
			background: getComputedStyle(player).backgroundColor,
			heartHidden: getComputedStyle(player.querySelector('[aria-label="Favorite show"]').parentElement).display === 'none',
			closeVisible: player.querySelector('[aria-label="Close player"]').getBoundingClientRect().width > 0,
			artworkVisible: artwork.getBoundingClientRect().width > 0 && artwork.getBoundingClientRect().height > 0,
			artworkWidth: artwork.getBoundingClientRect().width,
			artworkHeight: artwork.getBoundingClientRect().height,
			artworkBottom: artwork.getBoundingClientRect().bottom,
			metadataTop: title.parentElement.getBoundingClientRect().top,
			artworkCenterY: artwork.getBoundingClientRect().y + artwork.getBoundingClientRect().height / 2,
			frameCenterY: frame.getBoundingClientRect().y + frame.getBoundingClientRect().height / 2,
			matchingTitle: artwork.alt === title.textContent && title.textContent.length > 0,
			showLink: title.getAttribute('href').startsWith('/archive-site/shows/'),
			tagsVisible: tagLinks.length > 0 && tagLinks.every(link => link.getBoundingClientRect().height > 0),
			tagDestinations: tagLinks.every(link => link.getAttribute('href').startsWith('/archive-site/tags/')),
			overflow: document.documentElement.scrollWidth > innerWidth
		};
	})()`);
	assert.equal(fullscreen.x, 0);
	assert.equal(fullscreen.y, 0);
	assert.equal(fullscreen.width, fullscreen.viewportWidth);
	assert.equal(fullscreen.height, fullscreen.viewportHeight);
	assert.ok(Math.abs(fullscreen.barHeight - compactHeight) < 1);
	assert.equal(fullscreen.sameFrame, true);
	assert.equal(fullscreen.sameDocument, true);
	assert.equal(fullscreen.background, "rgb(0, 0, 0)");
	assert.equal(fullscreen.heartHidden, true);
	assert.equal(fullscreen.closeVisible, true);
	assert.equal(fullscreen.artworkVisible, true);
	assert.equal(fullscreen.matchingTitle, true);
	assert.equal(fullscreen.showLink, true);
	assert.equal(fullscreen.tagsVisible, true);
	assert.equal(fullscreen.tagDestinations, true);
	if (width <= 1023) {
		assert.ok(fullscreen.artworkBottom <= fullscreen.metadataTop, 'Artwork must not overlap metadata');
		assert.ok(Math.abs(fullscreen.frameBottom - fullscreen.viewportHeight) < 1);
	}
	if (width > 1023) {
		assert.ok(Math.abs(fullscreen.artworkWidth - fullscreen.artworkHeight) < 1);
		assert.ok(fullscreen.artworkHeight <= fullscreen.viewportHeight * 0.8);
		assert.ok(Math.abs(fullscreen.artworkCenterY - fullscreen.frameCenterY) < 1);
	}
	assert.equal(fullscreen.overflow, false);
	if (width <= 600) {
		assert.ok(Math.abs(fullscreen.frameBottom - fullscreen.viewportHeight) < 1);
	}
	browser("click", '[data-miniplayer] button[aria-label="Close player"]');
	browser("wait", '[data-presentation="compact"]');
	browser("wait", "--fn", "document.body.style.position !== 'fixed'");
	assert.equal(evaluate("window.scrollY"), savedScrollY);
	assert.equal(evaluate("document.body.style.cssText"), savedBodyStyles);
	browser("scroll", "down", "100");
	assert.ok(evaluate("window.scrollY") > savedScrollY);
	assert.equal(evaluate("document.querySelector('[data-miniplayer] iframe') === window.fullscreenFrame && window.fullscreenFrame.contentDocument === window.fullscreenDocument"), true);
}
console.log("Fullscreen expand/close, scroll restoration and iframe identity pass on mobile and desktop widths.");
