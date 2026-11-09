// Run after bun run build: bun tests/playlist-browsing.browser.mjs (requires agent-browser).
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import console from "node:console";
import { URL } from "node:url";
import { promisify } from "node:util";
import { build, file, serve } from "bun";

const { Response } = globalThis;

const exec = promisify(execFile);
const session = "archive-playlist-browsing";
const bundle = await build({
  entrypoints: ["tests/res/playlist-browsing.tsx"],
  target: "browser",
  define: { "import.meta.env.BASE_URL": JSON.stringify("/") },
});
assert.ok(bundle.success, bundle.logs.join("\n"));
const server = serve({
  port: 0,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/archive/")) {
      if (path === "/archive/history") {
        await new Promise((resolve) => globalThis.setTimeout(resolve, 300));
      }
      const relative = path.slice("/archive/".length);
      const asset = file(`dist/${relative}`);
      return new Response(
        (await asset.exists())
          ? asset
          : file(`dist/${relative.replace(/\/$/, "")}/index.html`),
      );
    }
    const output = bundle.outputs.find(
      (item) => path === `/${item.path.split("/").pop()}`,
    );
    if (output) return new Response(output);
    if (path.startsWith("/assets/")) return new Response(file(`public${path}`));
    return new Response(
      '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/playlist-browsing.css"><div id="root"></div><script type="module" src="/playlist-browsing.js"></script>',
      { headers: { "Content-Type": "text/html" } },
    );
  },
});
async function browser(...args) {
  const { stdout } = await exec(
    "agent-browser",
    ["--session", session, ...args],
    { timeout: 30_000 },
  );
  return stdout.trim();
}
async function evaluate(code) {
  return JSON.parse(await browser("eval", code));
}
try {
  await browser("open", server.url.href);
  await browser("wait", 'a[aria-label="View playlist Liked Shows"]');
  const id = await evaluate(`(async () => {
   const store = playlistFixture.stores.playlistStore;
   const p = await store.create({ title: "Road trip <script> " + "long-name".repeat(30) });
   await store.addShow({ playlistId: p.id, showId: 42 });
   await store.setNote({ playlistId: p.id, showId: 42, note: "Keep <b>raw</b>" });
   return p.id;
 })()`);
  await browser("wait", `a[href="/playlists/?id=${id}"]`);
  assert.ok(
    await evaluate(
      'document.body.textContent.includes("Could not load shows.")',
    ),
  );
  await browser("click", `a[href="/playlists/?id=${id}"]`);
  await browser("wait", 'section[aria-label="Playlist shows"]');
  assert.equal(await evaluate(`document.querySelector('section[aria-label="Playlist shows"]').children.length`), 1);
  assert.equal(await evaluate(`!!document.querySelector('section[aria-label="Playlist shows"] [data-show-playback]')`), true);
  const editButton = 'section[aria-label="Playlist shows"] button.button-secondary';
  const editDialog = 'dialog[aria-label="Playlist"][open]';
  await browser("click", editButton);
  await browser("wait", editDialog);
  assert.equal(await evaluate(`document.querySelector('${editDialog} h1').textContent`), "Edit");
  assert.equal(await evaluate(`document.querySelector('${editDialog} textarea').getAttribute('aria-label')`), "Note");
  await browser("fill", `${editDialog} textarea`, "Edited from the playlist");
  await browser("click", `${editDialog} button[aria-label="Save playlist"]`);
  await browser("wait", "--fn", `!document.querySelector('${editDialog}')`);
  assert.equal(await evaluate(`playlistFixture.stores.playlistStore.get({ playlistId: '${id}' }).shows[0].note`), "Edited from the playlist");
  assert.equal(await evaluate(`document.querySelector('section[aria-label="Playlist shows"]').textContent.includes('Edited from the playlist')`), true);
  await browser("click", editButton);
  await browser("wait", editDialog);
  assert.equal(await evaluate(`document.querySelector('${editDialog} textarea').value`), "Edited from the playlist");
  await browser("click", `${editDialog} button[aria-label="Close playlist"]`);
  await browser("reload");
  await browser("wait", 'section[aria-label="Playlist shows"]');
  assert.equal(
    await evaluate('new URLSearchParams(location.search).get("id")'),
    id,
  );
  await evaluate('location.search = "?id=unknown"; true');
  await browser(
    "wait",
    "--fn",
    'document.body.textContent.includes("Playlist not found in this browser.")',
  );
  await browser("back");
  await browser("wait", 'section[aria-label="Playlist shows"]');
  await evaluate('location.search = ""; true');
  await browser(
    "wait",
    "--fn",
    'document.body.textContent.includes("Choose a playlist from History.")',
  );
  await browser("open", `${server.url}playlists/?fail&id=${id}`);
  await browser("wait", '[role="alert"]');
  assert.equal(await evaluate(`document.querySelector('section[aria-label="Playlist shows"]')`), null);
  await browser("open", `${server.url}?fail`);
  await browser("wait", 'section[aria-label="Playlists"] [role="alert"]');
  // Check the actual static Astro shell and its client router using the same storage.
  await browser("open", `${server.url}archive/history`);
  await browser("wait", `a[href="/archive/playlists/?id=${id}"]`);
  for (const width of [320, 1440]) {
    await browser("set", "viewport", String(width), "900");
    assert.equal(
      await evaluate("document.documentElement.scrollWidth <= innerWidth"),
      true,
    );
  }
  await evaluate(
    `window.navigationMarker = {}; window.playerMarker = document.querySelector('[data-miniplayer]'); true`,
  );
  await evaluate(
    `document.querySelector('a[href="/archive/playlists/?id=${id}"]').focus(); true`,
  );
  await browser("press", "Enter");
  await browser("wait", 'section[aria-label="Playlist shows"]');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("h1").parentElement).display'), "flex");
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('section[aria-label="Playlist shows"]')).display`), "grid");
  assert.equal(
    await evaluate('new URLSearchParams(location.search).get("id")'),
    id,
  );
  assert.equal(
    await evaluate(
      '!!window.navigationMarker && window.playerMarker === document.querySelector("[data-miniplayer]")',
    ),
    true,
  );
  // Query-only navigation must remount the island without reloading the player.
  await evaluate(`(() => {
    const link = document.createElement('a');
    link.href = '/archive/playlists/?id=unknown';
    link.id = 'other-playlist';
    link.textContent = 'Other playlist';
    document.querySelector('main').append(link);
    return true;
  })()`);
  await browser("click", "#other-playlist");
  await browser("wait", "--fn", 'document.body.textContent.includes("Playlist not found in this browser.")');
  await browser("back");
  await browser("wait", 'section[aria-label="Playlist shows"]');
  assert.equal(await evaluate('new URLSearchParams(location.search).get("id")'), id);
  assert.equal(await evaluate('window.playerMarker === document.querySelector("[data-miniplayer]")'), true);
  for (const width of [320, 332, 750, 1440, 1920]) {
    await browser("set", "viewport", String(width), "900");
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('section[aria-label="Playlist shows"]')).gridTemplateColumns.split(' ').length`), width <= 600 ? 1 : width < 1023 ? 2 : width < 1600 ? 3 : 4);
    assert.equal(
      await evaluate("document.documentElement.scrollWidth <= innerWidth"),
      true,
    );
  }
  // Back updates location before Astro finishes loading the destination.
  await evaluate(`(() => {
    const main = document.querySelector('main');
    window.playlistDisappeared = false;
    const observer = new MutationObserver(() => {
      if (main.isConnected && !main.querySelector('section[aria-label="Playlist shows"]')) window.playlistDisappeared = true;
    });
    observer.observe(main, { childList: true, subtree: true });
    document.addEventListener('astro:before-swap', () => observer.disconnect(), { once: true });
    return true;
  })()`);
  await browser("back");
  await browser("wait", `a[href="/archive/playlists/?id=${id}"]`);
  assert.equal(
    await evaluate("window.playlistDisappeared"),
    false,
    "outgoing playlist stays visible until the page swap",
  );
  await browser("forward");
  await browser("wait", 'section[aria-label="Playlist shows"]');
  await browser("click", 'a[aria-label="Return to history"]');
  await browser("wait", `a[href="/archive/playlists/?id=${id}"]`);
  await browser("back");
  await browser("wait", 'section[aria-label="Playlist shows"]');
  await browser("reload");
  await browser("wait", 'section[aria-label="Playlist shows"]');
  assert.equal(
    await evaluate('new URLSearchParams(location.search).get("id")'),
    id,
  );
  console.log(
    "Playlist browsing passed: local lookup, reload, query history, show cards and independent errors.",
  );
} finally {
  await browser("close").catch(() => {});
  server.stop(true);
}
