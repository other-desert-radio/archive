# Explicit page gutters and horizontal scrolling

Status: paused at the user's request, 2026-11-06. Implementation is in the
working tree; verification and final review remain. No Git commit was requested.

## Agreed direction

- `BaseLayout` main owns the centered width cap and bottom clearance, not
  horizontal content padding.
- Category tabs own their gutters. All other content defines its spacing
  explicitly, using the same shared gutter values as a baseline.
- Ordinary content uses `.page-inset`; horizontal card rows use `.gutter-scroll`
  with internal padding. First/last cards align with headings at rest; cards can
  travel through both gutters while scrolling. No negative-margin cancellation
  of inherited main padding.
- Preserve existing card sizing, grids, safe-area spacing and the width cap.
  Rows reach main's edges, rather than the viewport edges beyond the width cap.
- The user rejected the initial smaller negative-margin approach as too hacky
  and explicitly selected restructuring inset ownership.

## Findings and implementation so far

Agent-browser reproduced the original tag-detail scroller stopping at 1388.8px
in a 1440px viewport, leaving a 51.2px gutter. History had the same boundary.
The second supplied screenshot is a tag-detail page, not the Explore index.

- Removed main's inline padding and added shared safe-area-aware
  `--page-inset-left` / `--page-inset-right` tokens and the two CSS classes.
- CategoryTabs wraps its tabs in `.page-inset`, preserving its existing internal
  phone spacing. Ordinary listing, detail and playlist routes have explicit
  inset wrappers. History insets its heading and playlist section separately.
- History and tag-detail DJ rows use `.gutter-scroll`. Removed the tag row's
  redundant inner wrapper: leaving it caused trailing padding to disappear at
  maximum scroll. Tag show grids/headings keep explicit insets.
- Adjusted LargeTagHeader to account for main no longer having padding. Its
  existing wide-screen viewport breakout remains; this is separate from the
  rejected gutter-cancellation approach.
- Updated `docs/css.md`. Astro formatting was applied to edited Astro files;
  review the diff for unrelated formatting noise before finishing.

## Verification already completed

- Agent-browser regression passed at 320, 332, 750, 1440 and 2000px for populated
  History and tag-detail DJ rows: both boundaries, first/last alignment, card
  sizing versus an inset viewport, no page overflow, and programmatic focus
  bringing the final DJ link into view.
- Regression source: `tests/gutter-scroll.browser.mjs`. It populates playback
  storage only in the dedicated `gutter-analysis` browser session.
- Latest `bun run lint` passed. Latest `bun run check` passed with zero
  diagnostics (130 files).
- `bun run build` passed before the final tag-row-wrapper adjustment. It emitted
  unresolved font URL warnings; investigate separately if they affect visual QA.
- No physical iOS verification or real keyboard traversal has been performed.

## Remaining work when resumed

1. Review current changes and confirm ordinary content retains its previous
   alignment on Shows, DJs, Explore, show/DJ details and playlist detail pages.
2. Extend the browser regression to cover those page types at the same widths,
   empty History and category navigation. An attempt to add this coverage was
   interrupted before execution; it is **not** in the current test file.
3. Verify visible keyboard focus, including outlines at scroll boundaries, and
   inspect screenshots of populated History and tag details at phone/desktop
   widths. Check the tag banner at phone and beyond the maximum page width.
4. Start local Astro using `bunx astro dev --background` and inspect its returned
   port (the last status reported no running server). Run:
   `ARCHIVE_PREVIEW_URL=http://localhost:<port>/archive bun tests/gutter-scroll.browser.mjs`.
   Browser execution requires access to its socket directory outside the sandbox;
   request command escalation if needed. The `agent-browser --session
   gutter-analysis` prefix is already approved.
5. Rerun relevant checks after any changes, and build the final version. Run
   `bun run docs:check` for the documentation changes. Do not claim broader
   regression coverage until it has actually run.
6. Report the final behavior and verification limits. Delete this temporary plan
   on completion unless it retains useful history, per development workflow.

No data/API migrations, new dependencies or unrelated feature work are needed.
