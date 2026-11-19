// Run against `bun run preview`: bun tests/player-navigation.browser.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import console from "node:console";
import { readFileSync } from "node:fs";
import process from "node:process";
import { URL } from "node:url";

const session = "archive-density";
const base = process.env["ARCHIVE_PREVIEW_URL"] ?? "http://127.0.0.1:4321/archive";
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
	assert.equal(layout.position, "fixed", `Player must stay at the bottom at ${width}px`);
	assert.ok(Math.abs(layout.bottom - layout.viewportHeight) < 1);
	assert.equal(layout.left, 0);
	assert.equal(layout.right, layout.viewportWidth);
	assert.ok(Math.abs(layout.clearance - layout.baseClearance - layout.height) < 1);
}

browser("open", `${base}/`);
browser("wait", "button[aria-label^='Play ']");
const basePath = new URL(base).pathname;
const catalog = JSON.parse(readFileSync("public/resources/shows.json", "utf8"));
const showWithDetails = catalog.data.slice(0, 20).find((show) => show.tagIds.length > 0 && show.djs.length > 0);
assert.ok(showWithDetails, "Fullscreen fixture needs a visible show with tags and DJs");
function playShowWithDetails() {
	evaluate(`document.querySelector('main article a[href="${basePath}/shows/${showWithDetails.id}"]').closest('article').querySelector('[data-show-playback]').click(); true`);
}

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
browser("click", `a[href='${basePath}/explore']`);
verifyPlayer(`${basePath}/explore`);
browser("click", `a[href='${basePath}/history']`);
verifyPlayer(`${basePath}/history`);
browser("back");
verifyPlayer(`${basePath}/explore`);
browser("forward");
verifyPlayer(`${basePath}/history`);
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
			repeat: background.backgroundRepeat,
			size: background.backgroundSize,
			layerImage: background.backgroundImage,
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
	assert.equal(layout.repeat, "no-repeat");
	assert.equal(layout.size, "cover");
	assert.ok(layout.canvasImage.includes(width <= 600 ? "/backgrounds/background-white-vertical.webp" : "/backgrounds/background-white.webp"));
	assert.equal(layout.layerImage, layout.canvasImage);
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
console.log("Idle navigation uses the default swap; active player document survives root-tab/back/forward navigation; bottom docking, dynamic clearance, viewport background and responsive widths pass.");


// Exercise the real React player with a same-origin iframe document, so
// fullscreen identity checks do not depend on Mixcloud network/playback readiness.
browser("open", `${base}/`);
browser("wait", "button[aria-label^='Play ']");
playShowWithDetails();
browser("wait", "[data-miniplayer] iframe");
evaluate(`(() => {
	window.fullscreenFrame = document.querySelector('[data-miniplayer] iframe');
	window.fullscreenFrame.srcdoc = '<p>Fullscreen playback fixture</p>';
	return true;
})()`);
browser("wait", "--fn", "window.fullscreenFrame.contentDocument?.body.textContent.includes('Fullscreen playback fixture')");
evaluate("window.fullscreenDocument = window.fullscreenFrame.contentDocument; true");
// Drag the mound with real pointer capture; a short pull returns, a long pull opens.
browser("set", "viewport", "1440", "844");
const compactBounds = evaluate("document.querySelector('[data-miniplayer]').getBoundingClientRect().toJSON()");
browser("mouse", "move", "2", String(compactBounds.bottom - 2));
assert.equal(evaluate("getComputedStyle(document.elementFromPoint(2, innerHeight - 2)).cursor"), "grab", "Compact whitespace advertises dragging");
browser("mouse", "move", "400", String(compactBounds.bottom - 2));
browser("wait", "250");
const smallMoundHeight = evaluate("document.querySelector('[data-miniplayer] button[class*=\"expand-handle\"]').getBoundingClientRect().height");
browser("mouse", "move", "400", String(compactBounds.top + 1));
browser("wait", "250");
const largeMoundHeight = evaluate("document.querySelector('[data-miniplayer] button[class*=\"expand-handle\"]').getBoundingClientRect().height");
assert.ok(largeMoundHeight > smallMoundHeight * 2, "Mound grows as the pointer approaches its crest");
for (const [distance, expected] of [[60, "compact"], [500, "fullscreen"]]) {
	browser("mouse", "move", "400", "820");
	browser("wait", "250");
	const handle = evaluate(`(() => {
		const button = document.querySelector('[data-miniplayer] button[class*="expand-handle"]');
		const rect = button.getBoundingClientRect();
		return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
	})()`);
	browser("mouse", "move", String(handle.x), String(handle.y));
	browser("mouse", "down");
	browser("mouse", "move", String(handle.x), String(handle.y - distance), "--duration", "800", "--steps", "20");
	browser("wait", "150");
	browser("mouse", "up");
	browser("wait", "600");
	assert.equal(evaluate("document.querySelector('[data-miniplayer]').dataset.presentation"), expected);
	assert.equal(evaluate("document.querySelector('[data-miniplayer] iframe') === window.fullscreenFrame && window.fullscreenFrame.contentDocument === window.fullscreenDocument"), true);
	if (expected === "fullscreen") {
		assert.equal(evaluate(`(() => {
			const player = document.querySelector('[data-miniplayer]');
			const title = player.querySelector('[class*="controls"] > [class*="title"]');
			const station = player.querySelector('[data-fullscreen-nav] > span');
			try {
				return [0, .2, .44, .45, .5, .55, .56, .8, 1].every(progress => {
					player.style.setProperty('--player-open', String(progress));
					const titleOpacity = Number(getComputedStyle(title).opacity);
					const stationOpacity = Number(getComputedStyle(station).opacity);
					return titleOpacity === 0 || stationOpacity === 0;
				});
			} finally {
				player.style.removeProperty('--player-open');
			}
		})()`), true, "Title and station labels must never overlap during either transition direction");
		browser("mouse", "move", "600", "400");
		browser("wait", "250");
		assert.equal(evaluate("getComputedStyle(document.querySelector('[aria-label=\"Collapse player\"] svg')).display"), "none");
		browser("mouse", "move", "600", "30");
		browser("wait", "250");
		assert.equal(evaluate("getComputedStyle(document.querySelector('[aria-label=\"Collapse player\"] span')).display"), "none");
		browser("mouse", "down");
		browser("mouse", "move", "600", "600", "--duration", "800", "--steps", "20");
		assert.equal(evaluate("getComputedStyle(document.querySelector('[data-miniplayer] button[class*=\"expand-handle\"] svg')).display"), "none", "Grabber stays hidden during downward dragging and settling");
		browser("mouse", "up");
		assert.equal(evaluate("getComputedStyle(document.querySelector('[data-miniplayer] button[class*=\"expand-handle\"] svg')).display"), "none", "Grabber stays hidden during downward dragging and settling");
		browser("mouse", "move", "600", "820");
		browser("wait", "600");
		assert.equal(evaluate("document.querySelector('[data-miniplayer]').dataset.presentation"), "compact");
		browser("mouse", "move", "600", "400");
		browser("wait", "50");
		assert.equal(evaluate("document.querySelector('[data-miniplayer] iframe') === window.fullscreenFrame"), true);
	}
}
// The visible mobile expand button shares pointer capture and settling behavior.
browser("set", "viewport", "390", "844");
for (const [distance, expected] of [[0, "fullscreen"], [60, "compact"], [500, "fullscreen"]]) {
	const button = evaluate(`(() => {
		const rect = document.querySelector('[data-player-drag-handle]').getBoundingClientRect();
		return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
	})()`);
	browser("mouse", "move", String(button.x), String(button.y));
	browser("mouse", "down");
	assert.equal(evaluate("getComputedStyle(document.querySelector('[data-player-drag-handle]')).display"), "flex");
	assert.equal(evaluate("document.querySelector('[data-player-drag-handle]').textContent.trim()"), "expand ↑");
	browser("mouse", "move", String(button.x), String(button.y - distance), "--duration", "800", "--steps", "20");
	browser("wait", "150");
	browser("mouse", "up");
	browser("wait", "600");
	assert.equal(evaluate("document.querySelector('[data-miniplayer]').dataset.presentation"), expected);
	assert.equal(evaluate("document.querySelector('[data-miniplayer] iframe') === window.fullscreenFrame"), true);
	if (expected === "fullscreen") {
		evaluate(`(() => {
			window.dismissFrameBounds = [];
			function sample() {
				const player = document.querySelector('[data-miniplayer]');
				if (player.dataset.presentation !== 'fullscreen') { return; }
				const frame = player.querySelector('iframe').getBoundingClientRect();
				window.dismissFrameBounds.push({ bottom: frame.bottom, height: frame.height, viewport: innerHeight });
				requestAnimationFrame(sample);
			}
			document.querySelector('[data-miniplayer] button[aria-label="Close player"]').click();
			requestAnimationFrame(sample);
			return true;
		})()`);
		browser("wait", '[data-presentation="compact"]');
		assert.equal(evaluate("window.dismissFrameBounds.length > 0 && window.dismissFrameBounds.every(frame => frame.height > 0 && frame.bottom <= frame.viewport + 1 && frame.bottom >= frame.viewport - 100)"), true, "Mobile playback controls stay onscreen throughout dismissal");
	}
}
for (const [width, height] of [[320, 844], [332, 844], [390, 844], [600, 844], [601, 844], [750, 844], [840, 782], [1440, 844], [2041, 1352], [2560, 844]]) {
	browser("set", "viewport", String(width), String(height));
	evaluate("window.scrollTo(0, 200); true");
	const savedScrollY = evaluate("window.scrollY");
	const savedBodyStyles = evaluate("document.body.style.cssText");
	const savedNavTop = evaluate("document.querySelector('[data-site-header] nav').getBoundingClientRect().top");
	const savedTabsTop = evaluate("document.querySelector('[data-category-tabs]').getBoundingClientRect().top");
	const compactHeight = evaluate("document.querySelector('[data-miniplayer-bar]').getBoundingClientRect().height");

	const expand = width <= 600
		? '[data-miniplayer] > button[aria-label="Expand player"]'
		: '[data-miniplayer] div > button[aria-label="Expand player"]';
	browser("click", expand);
	browser("wait", '[data-presentation="fullscreen"]');
	browser("wait", "550");
	browser("wait", "--fn", "getComputedStyle(document.documentElement).overflow === 'hidden'");
	assert.equal(evaluate("window.scrollY"), savedScrollY, "Opening must preserve the background scroll timeline");
	assert.equal(evaluate("document.querySelector('[data-site-header] nav').getBoundingClientRect().top"), savedNavTop);
	assert.equal(evaluate("document.querySelector('[data-category-tabs]').getBoundingClientRect().top"), savedTabsTop);
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
		const bookmark = player.querySelector('[class*="fullscreen-bookmark"] button');
		const djLinks = [...player.querySelectorAll('[class*="fullscreen-djs"] a')];
		return {
			x: rect.x, y: rect.y, width: rect.width, height: rect.height,
			viewportWidth: innerWidth, viewportHeight: innerHeight,
			barHeight: document.querySelector('[data-miniplayer-bar]').getBoundingClientRect().height,
			sameFrame: frame === window.fullscreenFrame,
			sameDocument: frame.contentDocument === window.fullscreenDocument,
			frameBottom: frame.getBoundingClientRect().bottom,
			frameLeft: frame.getBoundingClientRect().left,
			frameWidth: frame.getBoundingClientRect().width,
			background: getComputedStyle(player).backgroundColor,
			bookmarkHidden: getComputedStyle(player.querySelector('[class*="desktop-actions"]')).display === 'none',
			fullscreenBookmarkVisible: bookmark.getBoundingClientRect().width > 0,
			djsVisible: djLinks.length > 0 && djLinks.every(link => link.getBoundingClientRect().width > 0),
			djDestinations: djLinks.every(link => link.getAttribute('href').startsWith('/archive/djs/')),
			closeVisible: player.querySelector('[aria-label="Close player"]').getBoundingClientRect().width > 0,
			artworkVisible: artwork.getBoundingClientRect().width > 0 && artwork.getBoundingClientRect().height > 0,
			artworkWidth: artwork.getBoundingClientRect().width,
			artworkHeight: artwork.getBoundingClientRect().height,
			artworkBottom: artwork.getBoundingClientRect().bottom,
			artworkTop: artwork.getBoundingClientRect().top,
			metadataTop: title.parentElement.getBoundingClientRect().top,
			detailGap: parseFloat(getComputedStyle(player.querySelector('[class*="controls"]')).rowGap),
			rowBounds: ['fullscreen-metadata', 'fullscreen-actions'].map(name => {
				const bounds = player.querySelector('[class*="' + name + '"]').getBoundingClientRect();
				return { left: bounds.left, right: bounds.right };
			}),
			controlsLeft: player.querySelector('[class*="controls"]').getBoundingClientRect().left,
			matchingTitle: artwork.alt === title.textContent && title.textContent.length > 0,
			showLink: title.getAttribute('href').startsWith('/archive/shows/'),
			tagsVisible: tagLinks.length > 0 && tagLinks.every(link => link.getBoundingClientRect().height > 0),
			tagDestinations: tagLinks.every(link => link.getAttribute('href').startsWith('/archive/tags/')),
			overflow: document.documentElement.scrollWidth > innerWidth
		};
	})()`);
	assert.equal(fullscreen.x, 0);
	assert.equal(fullscreen.y, 0);
	assert.equal(fullscreen.width, fullscreen.viewportWidth);
	assert.equal(fullscreen.height, fullscreen.viewportHeight);
	assert.ok(Math.abs(fullscreen.barHeight - compactHeight) < 1);
	assert.ok(Math.abs(fullscreen.frameBottom - fullscreen.viewportHeight) < 1);
	assert.ok(Math.abs(fullscreen.frameLeft) < 1);
	assert.ok(Math.abs(fullscreen.frameWidth - fullscreen.viewportWidth) < 1);
	assert.equal(fullscreen.sameFrame, true);
	assert.equal(fullscreen.sameDocument, true);
	assert.equal(fullscreen.background, evaluate("getComputedStyle(document.querySelector('[data-miniplayer-bar]')).backgroundColor"));
	assert.equal(fullscreen.bookmarkHidden, true);
	assert.equal(fullscreen.fullscreenBookmarkVisible, true);
	assert.equal(fullscreen.djsVisible, true);
	assert.equal(fullscreen.djDestinations, true);
	assert.equal(fullscreen.closeVisible, true);
	assert.equal(fullscreen.artworkVisible, true);
	assert.equal(fullscreen.matchingTitle, true);
	assert.equal(fullscreen.showLink, true);
	assert.equal(fullscreen.tagsVisible, true);
	assert.equal(fullscreen.tagDestinations, true);
	if (width <= 1023) {
		assert.ok(Math.abs(fullscreen.metadataTop - fullscreen.artworkBottom - fullscreen.detailGap) < 1, 'Metadata sits one medium gap below artwork');
		assert.ok(Math.abs(fullscreen.frameBottom - fullscreen.viewportHeight) < 1);
	}
	if (width > 1023) {
		assert.ok(Math.abs(fullscreen.artworkTop - fullscreen.metadataTop) < 1, "Artwork and metadata align at the top");
		for (const row of fullscreen.rowBounds) {
			assert.ok(Math.abs(row.left - fullscreen.rowBounds[0].left) < 1);
			assert.ok(Math.abs(row.right - fullscreen.rowBounds[0].right) < 1);
		}
		if (width >= 2560) {
			assert.ok(fullscreen.controlsLeft >= 400, 'Wide screens retain generous side margins');
		}
		assert.ok(Math.abs(fullscreen.artworkWidth - fullscreen.artworkHeight) < 1);
		assert.ok(fullscreen.artworkHeight <= fullscreen.viewportHeight * 0.8);
	}
	assert.equal(fullscreen.overflow, false);
	if (width <= 600) {
		assert.ok(Math.abs(fullscreen.frameBottom - fullscreen.viewportHeight) < 1);
	}
	browser("click", '[data-miniplayer] button[aria-label="Close player"]');
	if (width > 600) {
		browser("mouse", "move", "400", String(height - 20));
	}
	browser("wait", '[data-presentation="compact"]');
	if (width > 600) {
		assert.equal(evaluate("document.querySelector('[data-miniplayer] button[class*=\"expand-handle\"]').getBoundingClientRect().height"), 0, "Click dismissal must not immediately reveal the mound under the pointer");
		browser("mouse", "move", "400", "200");
		assert.equal(evaluate("document.querySelector('[data-miniplayer]').hasAttribute('data-mound-dismissed')"), false);
	}
	browser("wait", "50");
	browser("wait", "--fn", "document.body.style.position !== 'fixed'");
	assert.equal(evaluate("window.scrollY"), savedScrollY);
	assert.equal(evaluate("document.body.style.cssText"), savedBodyStyles);
	browser("scroll", "down", "100");
	assert.ok(evaluate("window.scrollY") > savedScrollY);
	assert.equal(evaluate("document.querySelector('[data-miniplayer] iframe') === window.fullscreenFrame && window.fullscreenFrame.contentDocument === window.fullscreenDocument"), true);
}
console.log("Fullscreen expand/close, scroll restoration and iframe identity pass on mobile and desktop widths.");

// Detail entry and exit preserve the document, including tag-context returns.
function markDocument() {
	evaluate("window.navigationDocumentMarker = true; window.navigationFrame = document.querySelector('[data-miniplayer] iframe'); true");
}
function verifyClientNavigation(destination) {
	browser("wait", "--fn", `location.pathname === ${JSON.stringify(destination)}`);
	browser("wait", "--fn", "document.readyState === 'complete'");
	assert.equal(evaluate("window.navigationDocumentMarker === true"), true);
	assert.equal(evaluate("document.querySelector('[data-miniplayer] iframe') === window.navigationFrame"), true);
	assert.equal(evaluate("document.body.style.position !== 'fixed' && getComputedStyle(document.documentElement).overflow !== 'hidden'"), true);
}
function followLink(selector) {
	const destination = evaluate(`new URL(document.querySelector(${JSON.stringify(selector)}).href).pathname`);
	markDocument();
	evaluate(`document.querySelector(${JSON.stringify(selector)}).click(); true`);
	verifyClientNavigation(destination);
	return destination;
}
for (const [listing, detailSelector] of [
	["", `a[href^='${basePath}/shows/']`],
	["/djs", `a[href^='${basePath}/djs/']`],
	["/explore", `a[href^='${basePath}/tags/']`],
]) {
	browser("open", `${base}${listing}/`);
	browser("wait", detailSelector);
	followLink(detailSelector);
	followLink("nav a.leading-box");
	assert.equal(evaluate("location.pathname.replace(/\\/$/, '')"), `${basePath}${listing}`);
}

browser("open", `${base}/explore`);
browser("wait", `a[href^='${basePath}/tags/']`);
const tagPath = followLink(`a[href='${basePath}/tags/30']`);
for (const kind of ["shows", "djs"]) {
	const selector = `a[href^='${basePath}/${kind}/'][href*='fromTag=']`;
	browser("wait", selector);
	followLink(selector);
	browser("wait", "--fn", `document.querySelector('[data-tag-return]').pathname === ${JSON.stringify(tagPath)}`);
	followLink("[data-tag-return]");
	assert.equal(evaluate("location.pathname"), tagPath);
}
console.log("Show, DJ and tag details preserve the document on entry and return, including fromTag context.");

// Fullscreen archive links preserve playback and release scroll lock.
for (const width of [390, 1440]) {
	browser("set", "viewport", String(width), "844");
	for (const selector of [
		'[class*="fullscreen-tags"] a',
		'[class*="fullscreen-djs"] a',
		'[class*="fullscreen-title"]',
	]) {
		browser("open", `${base}/`);
		browser("wait", "button[aria-label^='Play ']");
		playShowWithDetails();
		browser("wait", "[data-miniplayer] iframe");
		evaluate(`(() => {
			Object.defineProperty(document.documentElement, 'moveBefore', { value: undefined, configurable: true });
			window.scrollTo(0, 200);
			return true;
		})()`);
		const expand = width <= 600
			? '[data-miniplayer] > button[aria-label="Expand player"]'
			: '[data-miniplayer] div > button[aria-label="Expand player"]';
		browser("click", expand);
		browser("wait", '[data-presentation="fullscreen"]');
		browser("wait", "550");
		const destination = evaluate(`new URL(document.querySelector(${JSON.stringify(selector)}).href).pathname`);
		markDocument();
		// Exercise bubbling from nested TagView/DJ content.
		assert.equal(evaluate(`(() => {
			const link = document.querySelector(${JSON.stringify(selector)});
			(link.lastElementChild ?? link).click();
			return document.querySelector('[data-miniplayer]').dataset.presentation === 'compact'
				&& document.body.style.position !== 'fixed'
				&& getComputedStyle(document.documentElement).overflow !== 'hidden';
		})()`), true, "Navigation must synchronously close the player and release scroll lock");
		verifyClientNavigation(destination);
		browser("wait", "600");
		assert.equal(evaluate("window.scrollY"), 0, "Dismiss cleanup must not restore source scroll on the destination");
	}
}
console.log("Fullscreen tag, DJ and show links preserve the document and playback and release scroll lock.");
