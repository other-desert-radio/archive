# Scroll-compressing category tabs

Mode: chunked. Current stage: native CSS enhancement implemented; verification in progress.

## Agreed behavior

- All four categories compress over a configurable document scroll distance and reverse on upward scrolling. The user tuned the distance from 160px to 40px during integration.
- Tune distance and easing through `--tabs-compression-scroll-px` and `--tabs-ease-out-power` in `src/styles/styles.css`, shared by native CSS and the JavaScript fallback. Power 1 is linear, 2 is gentle ease-out, 3 is stronger.
- CSS interpolates font size, gaps, inset and vertical spacing from existing responsive styles to compact styling: `--font-small`, `--space-sm` gaps and title-navigation left alignment.
- Fade the black background from transparent to opaque throughout the scroll cycle using eased progress. Native colors follow the timeline directly; the fallback retains the user-tuned 120ms smoothing. Switch text/underline to white at 50% opacity. Reduced motion disables animation.
- Compact title-to-tab text spacing is approximately 1.5rem, controlled by `--tabs-title-gap` in `Navigation.astro`.
- Tabs remain sticky below the desktop player and below the title on phones, with comfortable touch targets.
- Reduced motion uses static compact tabs; no JavaScript leaves usable expanded sticky tabs.
- Supported browsers use native CSS timelines, range and typed progress animation without JavaScript scroll listeners. Feature detection includes the CSS math used for easing. Unsupported browsers retain fast snapping within the compression zone and immediate clearing at the expanded endpoint.
- Preserve scroll geometry during compression; handle Astro navigation, restored scroll, responsive resizing and player height changes.

## Structure

Existing production files only:

```text
src/pages/{index,explore,djs,history}.astro   modified: provide named category-tabs slot
src/layouts/BaseLayout.astro                modified: forward named slot to Navigation
src/components/Navigation.astro             modified: render tabs after player in sticky header
src/components/CategoryTabs.astro           modified: presentation and local scroll lifecycle
src/styles/styles.css                      modified: typed progress registration and shared tuning
src/utils/preserve-player-navigation.ts    modified: swap tabs without detaching the player
tests/category-tabs.browser.mjs             new: browser regression coverage
docs/css.md                                modified: authoritative styling guidance after integration
docs/plans/scroll-compressing-tabs.md        new: task state and review boundaries
```

Flow: category page → BaseLayout named slot → Navigation sticky header after player → CategoryTabs. Supported browsers: native root scroll timeline → typed progress → shared styling. Unsupported browsers: frame-scheduled controller → progress and endpoint state. Detail pages supply no category slot. No new dependencies or package configuration changes.

## Review checkpoints

- [x] Inspect existing components, four callers, layout, lifecycle and verification guidance.
- [x] Record structure and create empty browser test file; leave runtime unchanged.
- [x] Obtain structure approval and explicit scaffolding request.
- [x] Scaffold slot flow and controller contracts without activating animation; stop for review.
- [x] Implement scroll lifecycle and focused behavioral coverage; stop for review.
- [ ] Implement visual compression, responsive integration and documentation; verify and stop for final review.

## Verification

- Browser checks at start, halfway, just before the configured endpoint, endpoint and beyond, plus reverse scroll, colors and underline.
- All categories, short/empty content, direct load, restored scroll, category navigation and back/forward.
- Active/inactive player, reduced motion and widths 320, 332, 750, 1440px and wide desktop.
- Check horizontal overflow, touch targets, scroll jumps, cleanup and player persistence.
- Focused tests, player-navigation regression, lint, Astro check, build, documentation check and generated asset budgets.
- Physical iPhone smoothness requires a device check.

## Current validation

All four category pages now supply tabs through the named slot below the player in the sticky header. CSS consumes eased progress for text, spacing, inset and black background opacity. The controller batches passive scroll updates, skips unchanged progress, follows reduced motion and restored scroll, and cleans up on Astro swaps. Expanded flow space remains reserved while the title and tabs compress.

The player-preserving compatibility swap now replaces/removes/inserts category tabs without moving the iframe. Its full browser regression has not completed in this session.

Lint, Astro check, documentation check and production build pass. The focused browser rerun passed responsive compression, 1.5rem text gap, hit targets, stable geometry, navigation/restoration, reduced motion, fast snapping, immediate top clearing and the settling-frame regression. The earlier full Bun suite passed 232 tests. Reload restoration allows less than two pixels of browser rounding while requiring progress to match actual scroll.

User device feedback: opacity-layer/layout-containment optimization felt worse on iOS and was reverted; the JavaScript fast path felt much better. A remaining black-background linger occurs only when returning to the top on iOS. The follow-up disables transitions at the expanded endpoint and preserves the fast bypass across unchanged settling frames. Physical iPhone verification remains pending.

Earlier asset-budget check: total JS/CSS passed, while DJs HTML (8.5/7 KiB) and Explore HTML (11.6/11 KiB) exceeded limits. No budgets were raised; baseline comparison remains unresolved. Build also reports public font/background URL warnings at build time.

Native enhancement: header keyframes animate registered raw progress over the shared distance; CSS computes the same power ease-out and inherits it into tabs. A separate stepped scroll animation switches ink at the matching 50% opacity point. Reduced motion disables native animation; native navigation clears stale fallback inline state and chooses the driver on every page-load. Tests force feature detection off for fallback coverage and exercise actual native support separately.

Next action: complete native/fallback browser verification, then review native iOS scrolling on-device.
