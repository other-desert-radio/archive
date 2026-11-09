# Scroll-compressing category tabs

Mode: chunked. Current stage: scroll controller ready for review; visual integration not started.

## Agreed behavior

- All four categories compress over a configurable document scroll distance and reverse on upward scrolling. The user tuned the distance from 160px to 40px during integration.
- Tune the distance through `compressionScrollPx` and the ease-out curve through `easeOutPower` in `CategoryTabs.astro`. Power 1 is linear, 2 is gentle ease-out, 3 is stronger. Endpoint colors follow raw scroll distance.
- CSS interpolates font size, gaps, inset and vertical spacing from existing responsive styles to compact styling: `--font-small`, `--space-sm` gaps and title-navigation left alignment.
- At the endpoint, fade to black with white text and active underline over 180ms. Reduced motion disables the color transition.
- Before the endpoint, keep the strip transparent so the existing page background shows through.
- Compact title-to-tab text spacing is approximately 1.5rem, controlled by `--tabs-title-gap` in `Navigation.astro`.
- Tabs remain sticky below the desktop player and below the title on phones, with comfortable touch targets.
- Reduced motion uses static compact tabs; no JavaScript leaves usable expanded sticky tabs.
- One JavaScript scroll driver supplies progress to CSS across browsers. Include the agreed comment explaining why CSS scroll-driven animation is not used.
- Preserve scroll geometry during compression; handle Astro navigation, restored scroll, responsive resizing and player height changes.

## Structure

Existing production files only:

```text
src/pages/{index,explore,djs,history}.astro   modified: provide named category-tabs slot
src/layouts/BaseLayout.astro                modified: forward named slot to Navigation
src/components/Navigation.astro             modified: render tabs after player in sticky header
src/components/CategoryTabs.astro           modified: presentation and local scroll lifecycle
src/utils/preserve-player-navigation.ts    modified: swap tabs without detaching the player
tests/category-tabs.browser.mjs             new: browser regression coverage
docs/css.md                                modified: authoritative styling guidance after integration
docs/plans/scroll-compressing-tabs.md        new: task state and review boundaries
```

Flow: category page → BaseLayout named slot → Navigation sticky header after player → CategoryTabs. Document scroll → frame-scheduled controller → local CSS progress and endpoint state. Detail pages supply no category slot. No dependencies, resource fixtures, exports or package configuration changes are expected.

## Review checkpoints

- [x] Inspect existing components, four callers, layout, lifecycle and verification guidance.
- [x] Record structure and create empty browser test file; leave runtime unchanged.
- [x] Obtain structure approval and explicit scaffolding request.
- [x] Scaffold slot flow and controller contracts without activating animation; stop for review.
- [x] Implement scroll lifecycle and focused behavioral coverage; stop for review.
- [ ] Implement visual compression, responsive integration and documentation; verify and stop for final review.

## Verification

- Browser checks at 0, 80, 160px and beyond, plus reverse scroll and endpoint colors/underline.
- All categories, short/empty content, direct load, restored scroll, category navigation and back/forward.
- Active/inactive player, reduced motion and widths 320, 332, 750, 1440px and wide desktop.
- Check horizontal overflow, touch targets, scroll jumps, cleanup and player persistence.
- Focused tests, player-navigation regression, lint, Astro check, build, documentation check and generated asset budgets.
- Physical iPhone smoothness requires a device check.

## Current validation

The named slot is forwarded from BaseLayout to Navigation after the player, but category pages still render tabs in main until integration. `observeCategoryTabs(HTMLElement): () => void` now publishes `--tabs-progress` and `data-compact` on the component wrapper. It batches passive scroll updates in one animation frame, follows reduced-motion changes, initializes from actual scroll, and handles pageshow. Initial load and Astro page-load bind it; before-swap and rebinding remove listeners and cancel pending frames. CSS does not consume the state yet, so no visual animation is active.

Integration must update the compatibility swap in `preserve-player-navigation.ts`: it retains the header and currently replaces only its title nav. Tabs must be replaced/removed/inserted with the destination page without moving the player iframe.

Astro check, lint, production build and focused browser tests pass. Browser coverage includes progress at 0/80/160/320px and reversal, frame batching after repeated initialization, pending-frame cancellation, reduced-motion changes, reload, category navigation, outgoing-element cleanup and Back restoration. Reload restoration shifted by one pixel in Chromium; restoration assertions allow less than two pixels and require progress to match actual scroll exactly. Explicit scroll checks still require exact positions. Build reports unresolved-at-build-time public font/background URL warnings.

Next action: approve controller chunk, then implement visual compression, named-slot adoption, stable scroll geometry, compatibility swaps and integrated responsive/player checks. Physical iPhone behavior and final layout are not yet verified.
