# Miniplayer redesign

Mode: chunked. Stop for approval at each stage and implementation unit.

## Decisions

- Require the full Show on AudioTrack; read its title from show.title.
- Desktop: linked DJ names, divider, linked show title; ellipsis until marquee work.
- Mobile through 600px: hide metadata when adding the right-aligned expand button.
- Desktop icons: text heart and fullscreen symbols, initially inert.
- Fullscreen expands the existing container without moving/remounting its iframe.
- Fullscreen scope: black background, station header, close SVG, existing iframe.
  Artwork and other fullscreen metadata are deferred. Heart remains inert.

## Progress and review boundaries

- Structure approved: reuse existing store, show converter, Miniplayer and CSS.
- Contract approved, then revised by request: show is required; remove duplicate title.
- Show now flows through converter and store; existing title rendering reads show.title.
- Desktop DJ/show links and ellipsis implemented; mobile plain title retained.
- Feature 2 implemented: desktop text heart/fullscreen buttons after the iframe,
  accessible labels, hidden through 600px, no handlers. Approved.
- Feature 3 implemented: content-width mobile expand button above the right edge,
  unwired, compact metadata and desktop actions hidden. Desktop wrapping preserved.
  Approved; feature 4 structure review is next.
- Feature 4: wire expand/close, preserve iframe, handle focus/Escape and background
  isolation, add public/assets/icons/close.svg. Stop for evaluation afterward.

## Fullscreen structure

- Miniplayer.tsx: local compact/fullscreen state, header and close control;
  retain the same widget at its existing position in the React tree.
- Miniplayer.module.css: viewport overlay and responsive widget positioning;
  preserve compact desktop wrapping.
- public/assets/icons/close.svg: new empty asset, populate during implementation.
- Existing player tests and miniplayer.md: verify/document implemented behavior.
- Expand controls -> local presentation state -> existing container styling.
  Closing restores compact presentation; no audio-store or adapter changes.
- Keep the outer bar's compact height independent of the expanded container,
  so Navigation's existing observer never reserves a viewport of page padding.
- Structure approved. Scaffolding adds PlayerPresentation (compact/fullscreen),
  compact-initialized local state and a hidden station/close header. No handlers,
  effects or fullscreen styles yet; the SVG remains empty and unreferenced.
- Scaffold approved. Visual expand/close and close SVG implemented. The existing
  iframe stays attached; a shell reserves compact height. Browser coverage passes
  at 390, 600, 601, 750 and 1440px, including iframe document identity and clearance.
- FullscreenNav extracted and conditionally mounted; shared iframe remains mounted.
- Background scroll lock implemented with fixed body, saved styles/scroll position
  and cleanup on close/unmount. Browser tests cover locking, restoration and
  resuming scroll at all five widths. Physical iOS verification remains manual.
- Refactor requested before keyboard/focus work. Approved miniplayer/ structure:
  public index, working Miniplayer and CSS, FullscreenNav, TrackTitle,
  CompactActions, usePlayerPresentation, scroll-lock.
- Scaffolding: moved working player/CSS and updated imports; added typed,
  disconnected extraction stubs. Behavior remains in Miniplayer until reviewed.
  FullscreenDetails/artwork remain deferred.
- Scaffolding approved. Scroll-lock logic extracted unchanged into scroll-lock.ts;
  the existing presentation effect acquires the lock and returns its cleanup.
- Scroll-lock extraction approved. usePlayerPresentation now owns presentation
  state, compact-height measurement, expand/close and scroll-lock cleanup.
  Miniplayer consumes its returned state/ref/callbacks; markup remains unchanged.
- Presentation hook approved. FullscreenNav, TrackTitle, MobileExpand and
  DesktopActions extracted into the scaffolded files, preserving markup/styles.
  Miniplayer now composes these components around the single shared widget.
- Visual extraction approved; refactor complete.
- Keyboard/focus unit implemented: fullscreen-focus helper, inert background,
  close-button initial focus, Tab guards across iframe boundaries, Escape in the
  parent document, and focus restoration to the activating expand control.
  Browser checks cover both close paths, focus containment/restoration, prior
  inert state preservation, scroll restoration and iframe identity at five widths.
- Cross-origin iframe keyboard events do not reach the parent: Escape inside
  Mixcloud is outside parent control. Physical iOS verification remains manual.
- Escape follow-up: moved keyboard listener from document bubbling to window
  capture so child handlers cannot swallow modal shortcuts. Regression reproduced
  the blocked Escape before the change; verification covers child stopPropagation.
- Await final review/evaluation; no more implementation chunks in agreed scope.
  FullscreenDetails/artwork/tags/favorites and marquee remain deferred.

## Verification

Run focused playback/player tests and lint/type checks per functional unit.
Verify responsive layout and iframe identity across fullscreen and navigation
in browser checks. Update authoritative player docs as behavior changes.
