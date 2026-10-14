# Miniplayer redesign

Mode: chunked. Stop for approval at each stage and implementation unit.

## Decisions

- Require the full Show on AudioTrack; read its title from show.title.
- Desktop: linked DJ names, divider, linked show title; ellipsis until marquee work.
- Mobile through 600px: hide metadata when adding the right-aligned expand button.
- Desktop icons: text heart and fullscreen symbols, initially inert.
- Fullscreen expands the existing container without moving/remounting its iframe.
- Fullscreen scope now includes responsive artwork, title, tags, DJ portraits
  and an inert heart alongside the existing header and iframe.

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
- Feature 4: wire expand/close, preserve iframe and lock background scrolling,
  add public/assets/icons/close.svg. Keyboard/focus work is deferred.

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
- Keyboard/focus work removed at user request after Firefox Escape remained
  unreliable. Escape handling, focus guards/restoration, inert background and
  modal semantics are deferred. Expand/X and scroll locking remain functional.
- Previous fullscreen shell/refactor complete. Responsive details are now
  authorized in small chunks; favorites behavior and marquee remain deferred.

## Responsive fullscreen details

- Structure approved: one new FullscreenDetails.tsx for presentational sections;
  compose sections in Miniplayer.tsx, style in Miniplayer.module.css, and use
  FullscreenNav.tsx for header styling hooks. No audio-store/adapter changes.
- Above 1023px: fluid square artwork left; title/tags, widget and heart/DJ row
  spaced vertically right. Preserve artwork aspect ratio without cropping.
- At 1023px and below: DJ, artwork, title, tags, heart. Header and bottom widget
  stay visible while the content scrolls. DJ portraits appear in both layouts.
- Station label and X only; stacked header has larger type and a white bottom
  border. Tags/DJs/title link to archive destinations; heart remains unwired.
- Reuse Show metadata and the existing tag catalog. Render all DJs, omit an
  absent DJ section, and omit missing tag IDs using the existing convention.
- Preserve the iframe's existing parent and React tree position across modes.
- Structure chunk approved; scaffolding requested with "next".
- Scaffolding: FullscreenDetails exports typed artwork, title, tags, DJs and
  heart leaf stubs. Show/base feed metadata sections; tags additionally receives
  TagMap. DJ output permits null for shows without DJs. All stubs throw
  "Not implemented" and remain disconnected from the working player.
- Intended flow: audio track.show + base -> Miniplayer -> detail sections;
  tag catalog -> tags section. Outputs are React elements; no playback or store
  side effects. Miniplayer retains the widget and CSS handles visual ordering.
- Scaffolding approved; grid unit requested. Added persistent empty artwork,
  metadata, heart and DJ slots directly in Miniplayer, hidden in compact mode.
  No extra layout component/helper layer; detail stubs remain disconnected.
- Grid unit: artwork spans the left desktop column; metadata, widget and
  heart/DJs occupy the right. At 1023px and below, slots stack in the chosen
  DJ/artwork/metadata/heart/widget order. Widget parent/tree position is retained.
- Lint/types, six focused player tests, production build and browser regression
  pass, including fullscreen iframe identity, scroll restoration and navigation.
  Await grid
  review; content rendering, scrolling/pinning polish and header remain later units.
- Grid approved; artwork/title chunk requested. Render large artwork and linked
  wrapping title directly inside existing Miniplayer slots, removing their
  unused FullscreenDetails stubs to reduce indirection. Remaining stubs stay
  disconnected. No new rendering abstraction.
- Artwork uses image_large as supplied, matching ShowCard, with object-fit
  contain on desktop and natural height when stacked. Content mounts only in
  fullscreen. Added stacked overflow scrolling and sticky widget positioning
  so real artwork cannot push the player offscreen; alignment polish remains.
- Await artwork/title review. Remaining units: tags; heart/DJs; player
  alignment; header; integrated checks.
- Artwork/title verification: lint/types, six player tests, production build,
  docs and diff checks pass. Browser regression also passes with visible artwork,
  matching alt/title, show link, iframe identity and scroll restoration checks.
- Review correction: desktop content is centered vertically, bounded by 80%
  of viewport height (dynamic viewport when supported) and 52rem. Artwork is
  a 1:1 square bounded by column width and content height after padding, centered
  in its column. RHS metadata/widget share a centered 44rem maximum width
  (increased from 40rem during visual review).
  Stacked artwork keeps its existing natural sizing. Await correction review.
- Layout correction: retain CSS grid, using explicit grid-column/grid-row
  placement instead of named grid areas. Desktop and stacked placements,
  sizing and alignment remain unchanged; no component/tree changes.
- Stop for approval after every unit. Do not advance from structure to
  scaffolding without an explicit request.

## Verification

Run focused playback/player tests and lint/type checks per functional unit.
Verify responsive layout and iframe identity across fullscreen and navigation
in browser checks. Update authoritative player docs as behavior changes.
For responsive fullscreen details, check 320, 332, 600, 750, 1023, 1440 and wide
desktop widths, long titles, multiple DJs, missing images and short viewports.
Verify playback continuity, expand/close, scroll restoration and compact layout.
