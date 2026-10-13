# Testing and verification

For features and behavior changes, add or update focused automated tests. If
practical coverage is unavailable, explain why in the handoff. Put headless
tests under `tests/`, mirroring source folders when useful (for example
`tests/components/mixcloud/` or `tests/stores/audio/`); reusable fixtures belong
in `tests/res/`. Run the smallest relevant checks and report results.

## Meaningful coverage

Use the existing Bun test framework and repository fixtures. Test observable
behavior at the appropriate boundary: inputs/outputs, error paths and required
side effects. Avoid assertions tied to private helper ordering or incidental
implementation details. Add focused coverage as implementation units become
functional; scaffolding does not need tests that only assert "Not implemented".
After integration, verify the complete behavior as well as individual units.
Use browser checks where hydration or layout cannot be established headlessly.

## Commands

- Astro pages, layouts or content: `bun run check`.
- TypeScript, CSS, JavaScript or configuration: `bun run lint` (read-only
  Biome, shell syntax, ESLint and TypeScript checks).
- Unit-tested behavior: `bun run test`. The detail-image regression test also
  builds the site and checks large artwork and matching alt text.
- Routing, deployment or production behavior: `bun run build`.
- Broad implementation changes: lint, check and build.
- Documentation only: `bun run docs:check`; no dev server or UI claims needed.

## Dependency-cache regression

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

## Responsive layout verification

For DJ card CSS changes, check `/archive-site/djs` at 320px, 332px, 750px
and desktop widths. Names/tags must wrap without horizontal overflow or page
scale changes when switching from SHOWS to DJs. Server-rendered tests cannot
compute layout. For broader layout changes, use the acceptance guidance in
[CSS](css.md#responsive-density).
