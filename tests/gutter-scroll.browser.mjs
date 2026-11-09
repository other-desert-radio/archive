// Run against Astro dev or preview: ARCHIVE_PREVIEW_URL=http://localhost:4321/archive bun tests/gutter-scroll.browser.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import console from "node:console";
import process from "node:process";

const base = process.env["ARCHIVE_PREVIEW_URL"] ?? "http://localhost:4321/archive";
function browser(...args) {
	return execFileSync("agent-browser", ["--session", "gutter-analysis", ...args], {
		encoding: "utf8",
	}).trim();
}
function evaluate(code) {
	return JSON.parse(browser("eval", code));
}
function near(a, b, message) {
	assert.ok(Math.abs(a - b) < 1.5, `${message}: ${a} vs ${b}`);
}
function verifyRow(selector, heading, nested = false, fullWidth = false) {
	const layout = evaluate(`(() => {
		const row = document.querySelector(${JSON.stringify(selector)});
		const cards = ${nested ? "row.firstElementChild" : "row"}.children;
		row.scrollLeft = 0;
		const main = document.querySelector('main').getBoundingClientRect();
		const rect = row.getBoundingClientRect();
		const style = getComputedStyle(row);
		const first = cards[0].getBoundingClientRect();
		const heading = document.querySelector(${JSON.stringify(heading)});
		const titleLeft = heading.getBoundingClientRect().left + parseFloat(getComputedStyle(heading).paddingLeft);
		row.scrollLeft = row.scrollWidth;
		return {left:rect.left, right:rect.right, mainLeft:main.left, mainRight:main.right,
			first:first.left, cardWidth:first.width, titleLeft,
			last:cards[cards.length - 1].getBoundingClientRect().right,
			end:rect.right - parseFloat(style.paddingRight), scrolled:row.scrollLeft,
			pageWidth:document.documentElement.scrollWidth, viewport:innerWidth};
	})()`);
	near(layout.left, layout.mainLeft, "left scroll boundary");
	near(layout.right, layout.mainRight, "right scroll boundary");
    if (fullWidth) {
        near(layout.left, 0, "device left edge");
        near(layout.right, layout.viewport, "device right edge");
    }
	near(layout.first, layout.titleLeft, "first card alignment");
	near(layout.last, layout.end, "last card alignment");
	assert.ok(layout.scrolled > 0, "fixture must overflow");
	assert.ok(layout.pageWidth <= layout.viewport, "no document overflow");
	// Compare with the old inset viewport: extra scroll padding must not resize cards.
	const oldWidth = evaluate(`(() => {
		const row = document.querySelector(${JSON.stringify(selector)});
		const original = row.style.cssText;
		const s = getComputedStyle(row);
		const left = s.paddingLeft, right = s.paddingRight;
		row.style.marginLeft = left; row.style.marginRight = right;
		row.style.paddingLeft = '0'; row.style.paddingRight = '0';
		const width = ${nested ? "row.firstElementChild" : "row"}.firstElementChild.getBoundingClientRect().width;
		row.style.cssText = original;
		row.scrollLeft = 0;
		return width;
	})()`);
	near(layout.cardWidth, oldWidth, "unchanged card width");
}

try {
	browser("open", `${base}/history`);
	browser("wait", '[aria-label="View playlist Liked Shows"]');
	// Only this dedicated browser session's storage is populated.
	evaluate(`(async () => {
		const catalog = await (await fetch('${base}/resources/shows.json')).json();
		const db = await new Promise((resolve, reject) => {
			const r = indexedDB.open('odr-archive', 4);
			r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
		});
		await new Promise((resolve, reject) => {
			const tx = db.transaction('playback', 'readwrite');
			const store = tx.objectStore('playback'); store.clear();
			for (const [i, show] of catalog.data.slice(0, 10).entries()) {
				store.put({showId:show.id, inProgress:true, positionInSeconds:10,
					history:[{startedAt:i + 1, updatedAt:i + 2, startPosition:0, endPosition:10}]});
			}
			tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
		});
		db.close(); return true;
	})()`);
	browser("reload");
	browser("wait", '[aria-label="Recently played shows"] article');
    for (const width of [320, 332, 750, 1440, 2000, 2560]) {
		browser("set", "viewport", String(width), "1000");
        verifyRow('[aria-label="Recently played shows"]', 'main h1', false, true);
	}
	browser("open", `${base}/tags/4`);
	browser("wait", ".dj-explore-card");
	for (const width of [320, 332, 750, 1440, 2000]) {
		browser("set", "viewport", String(width), "1000");
		verifyRow('.gutter-scroll', '#tag-djs-heading');
	}
	// Focus must bring the final link into the scroll viewport.
	evaluate(`document.querySelector('.tag-row').lastElementChild.focus(); true`);
	assert.equal(evaluate(`(() => {
		const r = document.activeElement.getBoundingClientRect();
		const s = document.querySelector('.gutter-scroll').getBoundingClientRect();
		return r.left >= s.left && r.right <= s.right + 1;
	})()`), true);
	console.log("Horizontal row boundaries, alignment, sizing and focus passed at five viewport widths.");
} finally {
	browser("close");
}
