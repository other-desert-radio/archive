# Scroll-compressing category tabs

Mode: chunked. Current stage: native CSS and compact category navigation ready for review.

## Agreed behavior

- All four categories compress over a configurable document scroll distance and reverse on upward scrolling. The user tuned the distance from 160px to 40px during integration.
- Tune distance and easing through `--tabs-compression-scroll-px` and `--tabs-ease-out-power` in `src/styles/styles.css`, shared by native CSS and the JavaScript fallback. Power 1 is linear, 2 is gentle ease-out, 3 is stronger.
- CSS interpolates font size, gaps, inset and vertical spacing from existing responsive styles to compact styling: `--font-small`, `--space-sm` gaps and title-navigation left alignment.
- Fade the black background from transparent to opaque throughout the scroll cycle using eased progress. Native colors follow the timeline directly; the fallback retains the user-tuned 120ms smoothing. Switch text/underline to white at 50% opacity. Reduced motion disables animation.
- Compact title-to-tab text spacing is approximately 1.5rem, controlled by `--tabs-title-gap` in `Navigation.astro`.
- Tabs remain sticky below the desktop player and below the title on phones, with comfortable touch targets.
- Switching categories while compact keeps the replacement strip compact before the swap and starts at the compression threshold, rather than carrying a deep listing scroll offset. Short entries reserve sufficient range; Back/Forward and reload retain their saved entry state.
- Reduced motion uses static compact tabs; no JavaScript leaves usable expanded sticky tabs.
- Supported browsers use native CSS timelines, range and typed progress animation without JavaScript scroll listeners. Feature detection includes the CSS math used for easing. Unsupported browsers retain fast snapping within the compression zone and immediate clearing at the expanded endpoint.
- Preserve scroll geometry during compression; handle Astro navigation, restored scroll, responsive resizing and player height changes.

## Structure

Existing production files only:

```text
src/pages/{index,explore,djs,history}.astro   modified: provide named category-tabs slot
src/layouts/BaseLayout.astro                modified: slot forwarding and early compact-entry history reservation
src/components/Navigation.astro             modified: render tabs after player in sticky header
src/components/CategoryTabs.astro           modified: presentation and local scroll lifecycle
src/styles/styles.css                      modified: typed progress registration and shared tuning
src/styles/global.css                      modified: short compact-entry scroll range
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
- [x] Implement visual compression, responsive integration and documentation; verify and stop for final review.

## Verification

- Browser checks at start, halfway, just before the configured endpoint, endpoint and beyond, plus reverse scroll, colors and underline.
- All categories, short/empty content, direct load, restored scroll, category navigation and back/forward.
- Active/inactive player, reduced motion and widths 320, 332, 750, 1440px and wide desktop.
- Check horizontal overflow, touch targets, scroll jumps, cleanup and player persistence.
- Focused tests, player-navigation regression, lint, Astro check, build, documentation check and generated asset budgets.
- Physical iPhone smoothness requires a device check.

## Current validation

All four category pages now supply tabs through the named slot below the player in the sticky header. CSS consumes eased progress for text, spacing, inset and black background opacity. The controller batches passive scroll updates, skips unchanged progress, follows reduced motion and restored scroll, and cleans up on Astro swaps. Expanded flow space remains reserved while the title and tabs compress.

The player-preserving compatibility swap replaces/removes/inserts category tabs without moving the iframe. Focused browser coverage confirms the retained header and iframe document survive compact category switches. The full existing player-navigation suite has not completed in this session.

Final lint, Astro check, documentation check, production build and all 232 Bun tests pass. The combined native/fallback browser run passed responsive compression at 320/332/750/1440/2000px, eased progress, color reversal, compact alignment, hit targets, stable geometry, navigation/restoration and reduced motion. Fallback coverage also passes fast snapping and immediate top clearing. Reload restoration allows less than two pixels of browser rounding while requiring progress to match actual scroll.

User device feedback: opacity-layer/layout-containment optimization felt worse on iOS and was reverted; the JavaScript fast path felt much better. A remaining black-background linger occurs only when returning to the top on iOS. The follow-up disables transitions at the expanded endpoint and preserves the fast bypass across unchanged settling frames. Physical iPhone verification remains pending.

Asset-budget check: total JS (96.0/100 KiB) and CSS (4.1/5 KiB) pass, while DJs HTML (9.5/7 KiB) and Explore HTML (12.6/11 KiB) exceed limits. No budgets were raised; baseline comparison remains unresolved. Build also reports public font/background URL warnings at build time.

Native enhancement: header keyframes animate registered raw progress over the shared distance; CSS computes the same power ease-out and inherits it into tabs. A separate stepped scroll animation switches ink at the matching 50% opacity point. Reduced motion disables native animation; native navigation clears stale fallback inline state and chooses the driver on every page-load. Tests force feature detection off for fallback coverage and exercise actual native support separately. Keep timeline declarations in separate selectors so the minifier cannot fold them into a shorthand unsupported by browsers that support the timeline longhand.

Compact category navigation seeds the next strip before swapping, reserves short-page range using a body attribute, and sets the new entry to the compression distance. A private Astro history-state flag preserves that range on traversal and reload; BaseLayout seeds the body flag before ClientRouter restores reload scroll. Final browser verification passed compact navigation with both drivers, short History, Back/Forward, reload and an iframe-preserving compatibility swap.

Next action: review native iOS scrolling and category switching on-device. Resolve HTML-budget overages separately without raising limits by default.
