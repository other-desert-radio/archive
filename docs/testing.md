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

## Performance regression suite

Run `bun run test:performance`. Install `agent-browser@0.38.1` and run
`agent-browser install` first (Linux CI uses `--with-deps`). The command builds
production output, checks gzip budgets, and runs real Chromium touch input at an
iPhone viewport against its own local fixture server. No preview server or
external artwork service is required. The Performance regressions workflow runs
the unit suite (including image-loading and routing contracts), then this command
on pull requests and pushes to main.

- All four prefetched category tabs must render within 400ms, without another HTML
  request. Timing includes native transition readiness and two animation frames.
  Tap-to-click must stay below 150ms. An unprefetched control verifies the injected
  800ms HTML delay. Both native prefetch and Safari's fetch-prefetch fallback run.
- Cold DJ, show and tag details, and their return links, must load as full
  documents with exactly one HTML request. Main content must reach a render
  opportunity within 1300ms, including the injected 800ms network delay. Artwork
  takes 2000ms; DJ/show content must be visible before it finishes. Prefetching
  is disabled and HTML is not cached for these cases.
- All emitted JS combined has a 100 KiB gzip budget; all CSS combined has a
  5 KiB budget. Root HTML allows 12 KiB, other categories 7 KiB, and each detail
  page 8 KiB. Failures print measurements; investigate growth before raising a
  limit. These are transfer-size guards, not device-speed guarantees.

The suite does not emulate WebKit or replace physical iPhone checks. It measures
render opportunities, not pixel presentation or a Core Web Vitals score. Run it
after build-based unit tests finish; rebuilding removes files while its fixture
server is serving them. For an existing build, run
`bun tests/performance-budget.mjs` and `bun tests/mobile-navigation.browser.mjs`
individually.

## Responsive browser checks

For player navigation and the viewport background, start `bun run preview`
after building, then run `bun tests/player-navigation.browser.mjs` (requires
`agent-browser`). The browser regression uses a same-origin iframe to verify
its document and playback marker survive category-tab and back/forward
navigation without reloading. Detail links must perform full document navigation
and return links must restore the correct category/tag destination.
It also checks viewport background sizing and
horizontal overflow at 320px, 332px, 750px and 1440px. Physical iOS rendering
and external Mixcloud playback require a device check.

For DJ card CSS changes, check `/archive-site/djs` at 320px, 332px, 750px
and desktop widths. Names/tags must wrap without horizontal overflow or page
scale changes when switching from SHOWS to DJs. Server-rendered tests cannot
compute layout. For broader layout changes, use the acceptance guidance in
[CSS](css.md#responsive-density).
