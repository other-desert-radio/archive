# Miniplayer redesign

Mode: chunked. Stop for approval at each stage and implementation unit.

## Decisions

- Carry the full Show through AudioTrack; generic tracks may omit it.
- Desktop: linked DJ names, divider, linked show title; ellipsis until marquee work.
- Mobile through 600px: hide metadata when adding the right-aligned expand button.
- Desktop icons: text heart and fullscreen symbols, initially inert.
- Fullscreen expands the existing container without moving/remounting its iframe.
- Fullscreen scope: black background, station header, close SVG, existing iframe.
  Artwork and other fullscreen metadata are deferred. Heart remains inert.

## Progress and review boundaries

- Structure approved: reuse existing store, show converter, Miniplayer and CSS.
- Contract stage: optional AudioTrack.show and full Show converter input.
  Await review before flowing show data.
- Next: flow Show through converter and test store propagation; stop for review.
- Then: render desktop links and ellipsis; stop for review.
- Feature 2: desktop heart/fullscreen buttons, unwired.
- Feature 3: mobile expand button, unwired, hide compact metadata.
- Feature 4: wire expand/close, preserve iframe, handle focus/Escape and background
  isolation, add public/assets/icons/close.svg. Stop for evaluation afterward.

## Verification

Run focused playback/player tests and lint/type checks per functional unit.
Verify responsive layout and iframe identity across fullscreen and navigation
in browser checks. Update authoritative player docs as behavior changes.
