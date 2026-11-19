// bun tests/square-show-card.browser.mjs (requires agent-browser).
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import console from "node:console";
import { URL } from "node:url";
import { promisify } from "node:util";
import { build, file, serve } from "bun";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import SquareShowCard from "../src/components/shows/SquareShowCard";
import fixture from "./res/shows.json";

const { Response } = globalThis;
const exec = promisify(execFile);
const show = fixture.data[0];
assert.ok(show);
const bundle = await build({
  entrypoints: ["tests/res/square-show-card.tsx"],
  target: "browser",
  define: { "import.meta.env.BASE_URL": JSON.stringify("/") },
});
assert.ok(bundle.success, bundle.logs.join("\n"));
const markup = ["playback", "details"].map(mode =>
  `<div id="${mode}">${renderToString(createElement(SquareShowCard, {
    mode, show, ...(mode === "details" ? { fromTag: 7, tags: [{id: 1, title: "Ambient", color: "#ff0000"}] } : {}),
  }))}</div>`,
).join("");
const server = serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const output = bundle.outputs.find(item => path === `/${item.path.split("/").pop()}`);
    if (output) return new Response(output);
    if (path.startsWith("/assets/")) return new Response(file(`public${path}`));
    if (path !== "/" && !path.startsWith("/square-show-card.")) {
      const relative = path.slice("/".length);
      const asset = file(`dist/${relative}`);
      const page = await asset.exists() ? asset : file(`dist/${relative.replace(/\/$/, "")}/index.html`);
      return await page.exists() ? new Response(page) : new Response("Show detail fixture", { headers: { "Content-Type": "text/html" } });
    }
    return new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
      <link rel="stylesheet" href="/square-show-card.css">
      <style>#root { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;max-width:50rem }</style>
      <div id="root">${markup}</div><script type="module" src="/square-show-card.js"></script>`,
      { headers: { "Content-Type": "text/html" } });
  },
});
async function browser(...args) {
  const { stdout } = await exec("agent-browser", ["--session", "square-show-card", ...args], { timeout: 30_000 });
  return stdout.trim();
}
async function evaluate(code) { return JSON.parse(await browser("eval", code)); }
try {
  await browser("open", server.url.href);
  await browser("wait", "--fn", "!!window.cardFixture");
  await evaluate(`(async () => {
    await cardFixture.stores.playbackStore.initialize();
    await cardFixture.stores.playbackStore.progress(cardFixture.show.id, cardFixture.show.duration / 4);
    return true;
  })()`);
  await browser("wait", '[aria-valuenow="25"]');
  assert.equal(await evaluate("document.querySelectorAll('[aria-valuenow=\"25\"]').length"), 2);
  assert.equal(await evaluate("document.querySelector('#details button') === null"), true);
  assert.equal(await evaluate("document.querySelector('#details .tag').textContent"), "Ambient");
  assert.equal(await evaluate("document.querySelector('#details a a') === null"), true);
  for (const width of [320, 750, 1440]) {
    await browser("set", "viewport", String(width), "900");
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"));
    await browser("click", "#playback button");
    await browser("wait", "--fn", `document.querySelector('#playback button').dataset.selected === "true" && getComputedStyle(document.querySelector('#playback button')).opacity === "1"`);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('#playback button')).opacity"), "1");
    await browser("press", "Tab");
    assert.equal(await evaluate("document.activeElement === document.querySelector('#details a')"), true);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('#details a span')).opacity"), "1");
  }
  await evaluate("cardFixture.stores.playbackStore.complete(cardFixture.show.id).then(() => true)");
  await browser("wait", "--fn", "document.querySelectorAll('svg use[href$=\"check.svg#check\"]').length === 2");
  assert.equal(await evaluate("document.querySelectorAll('[role=progressbar]').length"), 0);
  await browser("hover", "#details a");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#details a span')).opacity"), "1");
  assert.ok(await evaluate(`(() => {
    const badge = document.querySelector('#details svg').parentElement;
    const rect = badge.getBoundingClientRect();
    return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2).closest('a') !== null;
  })()`));
  await browser("reload");
  await browser("wait", "--fn", "document.querySelectorAll('svg use[href$=\"check.svg#check\"]').length === 2");
  const errors = await browser("errors");
  assert.doesNotMatch(errors, /hydrat|mismatch|Minified React error/i);
  const catalog = await file("public/resources/shows.json").json();
  const realShow = catalog.data.find(item => item.djs.length && item.tagIds.length);
  assert.ok(realShow);
  await evaluate(`(async () => {
    cardFixture.stores.playbackStore.set(${JSON.stringify({ showId: realShow.id, positionInSeconds: realShow.duration / 4, inProgress: true, history: [] })});
    await cardFixture.stores.playbackStore.flush();
    return true;
  })()`);
  await browser("click", "#details a");
  assert.equal(new URL(await browser("get", "url")).pathname, `/shows/${show.id}`);
  assert.equal(new URL(await browser("get", "url")).search, "?fromTag=7");
  for (const [page, suffix] of [
    [`djs/${realShow.djs[0].id}`, ""],
    [`tags/${realShow.tagIds[0]}`, `?fromTag=${realShow.tagIds[0]}`],
  ]) {
    await browser("open", new URL(`/${page}`, server.url).href);
    const href = `/shows/${realShow.id}${suffix}`;
    const selector = `a[href="${href}"]`;
    await browser("wait", "--fn", `document.querySelector(${JSON.stringify(selector)})?.parentElement.querySelector('[aria-valuenow="25"]') !== null && !!document.querySelector(${JSON.stringify(selector)})`);
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector)}).parentElement.querySelector('button') === null`), true);
    for (const width of [320, 1440]) {
      await browser("set", "viewport", String(width), "900");
      assert.ok(await evaluate(`(() => { const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return rect.width > 0 && rect.left >= 0 && rect.right <= innerWidth; })()`));
    }
    await browser("click", selector);
    await browser("wait", 'main .show-artwork [aria-valuenow="25"]');
    assert.equal(new URL(await browser("get", "url")).search, suffix);
  }
  console.log("Square show cards: hydration, live progress, completion, focus, hover, responsive layout, and navigation passed.");
} finally {
  await browser("close");
  server.stop(true);
}
