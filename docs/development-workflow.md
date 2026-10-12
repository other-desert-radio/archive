# Development workflow

This repository is intentionally small and static-first. Build changes in
small, reviewable chunks so each change has a clear purpose and can be checked
independently.

## Work in small chunks

- Implement one narrowly scoped feature or behavior at a time.
- Keep unrelated routing, content, styling, and interaction changes separate.
- Add or update documentation in the same chunk when behavior or workflow
  changes.
- Add or update focused automated tests whenever introducing a feature or
  changing existing behavior. If a behavior cannot be tested practically,
  explain why in the handoff.
- Place headless tests in the top-level `tests/` directory.
- Put reusable test fixtures in `tests/res/`.
- Run the smallest relevant verification commands before handing off the
  chunk.
- Stop after the chunk is complete so it can be reviewed before the next
  feature begins.

A good chunk should be understandable from its diff, have a clear acceptance
condition, and leave the site in a buildable state. If a task contains several
independent outcomes, split them into separate chunks rather than hiding them
behind one large implementation.

## Preserve the site boundaries

- Keep the site static unless a concrete requirement needs a server runtime.
- Put routes in `src/pages/` and shared page shells in `src/layouts/`.
- Move genuinely reusable presentation into `src/components/`.
- Keep browser-only behavior in a React component or a small client-side
  script; do not add a runtime dependency for a static page.
- Keep generated `.astro/` and `dist/` output out of manual edits.

Read [`architecture.md`](architecture.md) before making structural changes.
Update it when the routing, rendering flow, source layout, or deployment model
changes materially.

## Verification by change type

Vite dependency caches are separated by command (`node_modules/.vite-serve`
and `node_modules/.vite-build`) in `astro.config.mjs`. This lets production
builds, including build-based tests, run alongside the dev server without
overwriting its React development runtime. A shared cache previously caused
miniplayer text to render on the server and disappear during hydration after
refresh (`jsxDEV is not a function`). After changing this configuration,
restart the background dev server and reload the browser.

For this regression, check the hydrated miniplayer text after a full refresh,
run `bun run build` while dev is running, then refresh again and navigate from
SHOWS to DJs. Text must remain visible and the persisted island must retain
its DOM identity. This browser check passed with the separate caches; the
existing generated-HTML test cannot detect a client runtime hydration failure.

- `bun run format` applies Biome formatting, safe lint fixes, and import
  organization. The pre-commit hook runs it before staging the resulting
  changes.
- Astro pages, layouts, or content: `bun run check`
- TypeScript, CSS, JavaScript, or configuration: `bun run lint`
- Unit-tested behavior: `bun run test`
  The detail-image regression test also builds the site and checks generated
  show and DJ pages for large artwork and matching alt text.
- Routing, deployment configuration, or production behavior: `bun run build`
- Broad changes: run `bun run lint`, `bun run check`, and `bun run build`

Use the existing repository scripts rather than introducing one-off local
commands. Keep the verification result with the handoff so the next review
starts from a known state.

For DJ card CSS changes, also check `/archive-site/djs` in responsive mode
at 320px, 332px, 750px, and desktop widths. Names and tags must wrap within
their cards without horizontal overflow or changing the page scale when
switching from SHOWS to DJs. The mobile cards use smaller titles and gaps;
long unbroken names and tags must remain contained. This requires a browser
check because the current server-rendered unit tests do not compute layout.
