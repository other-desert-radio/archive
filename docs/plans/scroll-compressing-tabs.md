# Scroll-compressing category tabs

Mode: chunked. Current stage: structure ready for review; scaffolding not started.

## Agreed behavior

- All four categories compress over the first 160px of document scroll and reverse on upward scrolling.
- CSS interpolates font size, gaps, inset and vertical spacing from existing responsive styles to compact styling: `--font-small`, `--space-sm` gaps and title-navigation left alignment.
- At the endpoint, switch to black with white text and active underline.
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
tests/category-tabs.browser.mjs             new: browser regression coverage (currently empty)
docs/css.md                                modified: authoritative styling guidance after integration
docs/plans/scroll-compressing-tabs.md        new: task state and review boundaries
```

Flow: category page → BaseLayout named slot → Navigation sticky header after player → CategoryTabs. Document scroll → frame-scheduled controller → local CSS progress and endpoint state. Detail pages supply no category slot. No dependencies, resource fixtures, exports or package configuration changes are expected.

## Review checkpoints

- [x] Inspect existing components, four callers, layout, lifecycle and verification guidance.
- [x] Record structure and create empty browser test file; leave runtime unchanged.
- [ ] Obtain structure approval and explicit scaffolding request.
- [ ] Scaffold slot flow and controller contracts without activating animation; stop for review.
- [ ] Implement scroll lifecycle and focused behavioral coverage; stop for review.
- [ ] Implement visual compression, responsive integration and documentation; verify and stop for final review.

## Verification

- Browser checks at 0, 80, 160px and beyond, plus reverse scroll and endpoint colors/underline.
- All categories, short/empty content, direct load, restored scroll, category navigation and back/forward.
- Active/inactive player, reduced motion and widths 320, 332, 750, 1440px and wide desktop.
- Check horizontal overflow, touch targets, scroll jumps, cleanup and player persistence.
- Focused tests, player-navigation regression, lint, Astro check, build, documentation check and generated asset budgets.
- Physical iPhone smoothness requires a device check.

## Current validation

Structure stage only: no runtime changes and no runtime tests run. Next action: review structure, then request scaffolding.
