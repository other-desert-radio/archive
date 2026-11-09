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
  external: ["astro:transitions/client"],
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
  const titleInput = 'input[aria-label="Playlist title"]';
  const originalTitle = await evaluate('document.querySelector("h1").textContent');
  await browser("click", 'button[aria-label="Rename playlist"]');
  await browser("wait", titleInput);
  assert.equal(await evaluate(`document.activeElement.getAttribute('aria-label')`), "Playlist title");
  assert.equal(await evaluate(`document.querySelector('${titleInput}').value`), originalTitle);
  await browser("fill", titleInput, "Discard this");
  await browser("click", 'button[aria-label="Cancel playlist rename"]');
  assert.equal(await evaluate('document.querySelector("h1").textContent'), originalTitle);
  await browser("click", 'button[aria-label="Rename playlist"]');
  await browser("fill", titleInput, "Escape this");
  await browser("press", "Escape");
  assert.equal(await evaluate('document.querySelector("h1").textContent'), originalTitle);
  await browser("click", 'button[aria-label="Rename playlist"]');
  await browser("fill", titleInput, "   ");
  assert.equal(await evaluate(`document.querySelector('button[aria-label="Save playlist title"]').disabled`), true);
  await evaluate(`(() => {
    const store = playlistFixture.stores.playlistStore;
    const rename = store.rename.bind(store);
    store.rename = async (args) => {
      store.rename = rename;
      throw new Error("disk full");
    };
    return true;
  })()`);
  await browser("fill", titleInput, "  Renamed playlist  ");
  await browser("click", 'button[aria-label="Save playlist title"]');
  await browser("wait", '[role="alert"]');
  assert.equal(await evaluate(`document.querySelector('${titleInput}').value`), "  Renamed playlist  ");
  assert.equal(await evaluate(`playlistFixture.stores.playlistStore.get({ playlistId: '${id}' }).title`), originalTitle);
  await browser("click", titleInput);
  await browser("press", "Enter");
  await browser("wait", "--fn", `document.querySelector('h1')?.textContent === 'Renamed playlist'`);
  await browser("reload");
  await browser("wait", 'section[aria-label="Playlist shows"]');
  assert.equal(await evaluate('document.querySelector("h1").textContent'), "Renamed playlist");
  const confirmation = 'dialog[aria-labelledby][open]';
  await browser("click", 'button[aria-label="Delete playlist"]');
  await browser("wait", confirmation);
  assert.equal(await evaluate(`document.activeElement.textContent.trim()`), "Cancel");
  assert.equal(await evaluate(`document.querySelector('${confirmation}').textContent.includes('Renamed playlist')`), true);
  await browser("mouse", "move", "1", "1");
  await browser("mouse", "down");
  await browser("mouse", "up");
  await browser("wait", "--fn", `!document.querySelector('${confirmation}')`);
  assert.equal(await evaluate(`!!playlistFixture.stores.playlistStore.get({ playlistId: '${id}' })`), true);
  await browser("click", 'button[aria-label="Delete playlist"]');
  await browser("press", "Escape");
  await browser("wait", "--fn", `!document.querySelector('${confirmation}')`);
  await evaluate(`(() => {
    const store = playlistFixture.stores.playlistStore;
    const remove = store.delete.bind(store);
    store.delete = () => new Promise((resolve, reject) => {
      window.rejectDelete = () => { store.delete = remove; reject(new Error('disk full')); };
    });
    return true;
  })()`);
  await browser("click", 'button[aria-label="Delete playlist"]');
  await browser("click", `${confirmation} button[aria-label="Delete playlist"]`);
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('${confirmation} button')).every(button => button.disabled)`), true);
  await browser("press", "Escape");
  assert.equal(await evaluate(`!!document.querySelector('${confirmation}')`), true);
  await browser("mouse", "move", "1", "1");
  await browser("mouse", "down");
  await browser("mouse", "up");
  assert.equal(await evaluate(`!!document.querySelector('${confirmation}')`), true);
  await evaluate('window.rejectDelete(); true');
  await browser("wait", `${confirmation} [role="alert"]`);
  assert.equal(await evaluate(`!!playlistFixture.stores.playlistStore.get({ playlistId: '${id}' })`), true);
  await browser("click", `${confirmation} button[aria-label="Cancel"]`);
  await browser("click", 'button[aria-label="Delete playlist"]');
  assert.equal(await evaluate(`!!document.querySelector('${confirmation} [role="alert"]')`), false);
  await browser("click", `${confirmation} button[aria-label="Cancel"]`);
  const editButton = 'section[aria-label="Playlist shows"] button[aria-label^="Edit note for "]';
  const editDialog = 'dialog[aria-label="Playlist"][open]';
  await evaluate(`document.querySelector('${editButton}').focus(); true`);
  await browser("press", "Enter");
  await browser("wait", editDialog);
  assert.equal(await evaluate(`document.querySelector('${editDialog} h1').textContent`), "Edit");
  assert.equal(await evaluate(`document.querySelector('${editDialog} textarea').getAttribute('aria-label')`), "Note");
  await browser("fill", `${editDialog} textarea`, "Edited from the playlist");
  await browser("click", `${editDialog} button[aria-label="Save playlist"]`);
  await browser("wait", "--fn", `!document.querySelector('${editDialog}')`);
  assert.equal(await evaluate(`playlistFixture.stores.playlistStore.get({ playlistId: '${id}' }).shows[0].note`), "Edited from the playlist");
  assert.equal(await evaluate(`document.querySelector('section[aria-label="Playlist shows"]').textContent.includes('Edited from the playlist')`), true);
  await evaluate(`document.querySelector('${editButton}').focus(); true`);
  await browser("press", "Enter");
  await browser("wait", editDialog);
  assert.equal(await evaluate(`document.querySelector('${editDialog} textarea').value`), "Edited from the playlist");
  await browser("click", `${editDialog} button[aria-label="Close playlist"]`);
  // Removing the visible card must leave the dialog alive for a later write failure.
  const targetId = await evaluate(`(async () => {
    const store = playlistFixture.stores.playlistStore;
    await store.rename({ playlistId: "${id}", title: "Road trip" });
    const target = await store.create({ title: "Retry destination" });
    const addShow = store.addShow.bind(store);
    store.addShow = async (args) => {
      if (args.playlistId === target.id) {
        store.addShow = addShow;
        throw new Error("disk full");
      }
      return addShow(args);
    };
    return target.id;
  })()`);
  await evaluate(`document.querySelector('${editButton}').focus(); true`);
  await browser("press", "Enter");
  await browser("wait", editDialog);
  await browser("uncheck", `${editDialog} input[value="${id}"]`);
  await browser("check", `${editDialog} input[value="${targetId}"]`);
  await browser("fill", `${editDialog} textarea`, "Retained for retry");
  await browser("click", `${editDialog} button[aria-label="Save playlist"]`);
  await browser("wait", `${editDialog} [role="alert"]`);
  assert.equal(await evaluate(`document.querySelector('section[aria-label="Playlist shows"]')`), null);
  assert.equal(await evaluate(`document.querySelector('${editDialog} textarea').value`), "Retained for retry");
  await browser("click", `${editDialog} button[aria-label="Save playlist"]`);
  await browser("wait", "--fn", `!document.querySelector('${editDialog}')`);
  assert.equal(await evaluate(`playlistFixture.stores.playlistStore.get({ playlistId: '${targetId}' }).shows[0].note`), "Retained for retry");
  // Restore the viewed playlist for the navigation checks below.
  await evaluate(`playlistFixture.stores.playlistStore.addShow({ playlistId: '${id}', showId: 42 }).then(() => true)`);
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
  await browser("click", 'button[aria-label="Rename playlist"]');
  await browser("wait", titleInput);
  for (const width of [320, 332, 750, 1440, 1920]) {
    await browser("set", "viewport", String(width), "900");
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('section[aria-label="Playlist shows"]')).gridTemplateColumns.split(' ').length`), width <= 600 ? 1 : width < 1023 ? 2 : width < 1600 ? 3 : 4);
    assert.equal(
      await evaluate("document.documentElement.scrollWidth <= innerWidth"),
      true,
    );
  }
  assert.equal(await evaluate(`(() => {
    const input = document.querySelector('${titleInput}');
    const style = getComputedStyle(input);
    const form = input.closest('form');
    const button = form.querySelector('button');
    const icon = button.querySelector('svg');
    const buttonRect = button.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    return style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.borderTopWidth === '0px'
      && style.outlineStyle === 'none' && getComputedStyle(form).borderBottomStyle === 'solid'
      && Math.abs((buttonRect.left + buttonRect.right) - (iconRect.left + iconRect.right)) < 1
      && Math.abs((buttonRect.top + buttonRect.bottom) - (iconRect.top + iconRect.bottom)) < 1;
  })()`), true);
  assert.equal(await evaluate(`(() => {
    const heading = document.createElement('h1');
    document.body.append(heading);
    const matches = getComputedStyle(document.querySelector('${titleInput}')).fontSize === getComputedStyle(heading).fontSize;
    heading.remove();
    return matches;
  })()`), true);
  await browser("click", 'button[aria-label="Cancel playlist rename"]');
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
  await browser("click", 'button[aria-label="Delete playlist"]');
  await browser("wait", confirmation);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('${confirmation} button[aria-label="Delete playlist"]')).color`), "rgb(204, 0, 0)");
  await browser("hover", `${confirmation} button[aria-label="Delete playlist"]`);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('${confirmation} button[aria-label="Delete playlist"]')).backgroundColor`), "rgb(204, 0, 0)");
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('${confirmation} button[aria-label="Delete playlist"]')).color`), "rgb(255, 255, 255)");
  for (const width of [320, 750, 1440]) {
    await browser("set", "viewport", String(width), "900");
    assert.equal(await evaluate(`(() => {
      const rect = document.querySelector('${confirmation}').getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth;
    })()`), true);
  }
  await browser("click", `${confirmation} button[aria-label="Delete playlist"]`);
  await browser("wait", 'section[aria-label="Playlists"]');
  assert.equal(await evaluate(`!!document.querySelector('a[href="/archive/playlists/?id=${id}"]')`), false);
  assert.equal(await evaluate('window.playerMarker === document.querySelector("[data-miniplayer]")'), true);
  await browser("reload");
  await browser("wait", 'a[aria-label="View playlist Liked Shows"]');
  assert.equal(await evaluate(`!!document.querySelector('a[href="/archive/playlists/?id=${id}"]')`), false);
  await browser("click", 'a[aria-label="View playlist Liked Shows"]');
  await browser("wait", "--fn", 'document.querySelector("h1")?.textContent === "Liked Shows"');
  assert.equal(await evaluate(`!!document.querySelector('button[aria-label="Delete playlist"], button[aria-label="Rename playlist"]')`), false);
  console.log(
    "Playlist browsing passed: local lookup, reload, query history, show cards and independent errors.",
  );
} catch (error) {
  console.error(await browser("eval", "({url:location.href,text:document.body.innerText.slice(0,2500)})"));
  console.error(await browser("errors"));
  throw error;
} finally {
  await browser("close").catch(() => {});
  server.stop(true);
}
