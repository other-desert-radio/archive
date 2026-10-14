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
  accessible labels, hidden through 600px, no handlers. Await review.
- Feature 3: mobile expand button, unwired, hide compact metadata.
- Feature 4: wire expand/close, preserve iframe, handle focus/Escape and background
  isolation, add public/assets/icons/close.svg. Stop for evaluation afterward.

## Verification

Run focused playback/player tests and lint/type checks per functional unit.
Verify responsive layout and iframe identity across fullscreen and navigation
in browser checks. Update authoritative player docs as behavior changes.
