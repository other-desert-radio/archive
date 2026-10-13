# Miniplayer

## Current design direction

The latest three screenshots supplied by the user replace the original custom
controls for **Mixcloud** playback. Compact Mixcloud UI shows the visible mini
widget beside the fullscreen button; expanded and fullscreen UI keep that same
widget visible and add custom metadata/progress presentation. Retain the
original custom playback controls for **SAMCast** live streaming (called
“samcloud” in the user's latest message; the source discriminator remains
`samcast`). Do not discard the custom control work when adding Mixcloud.

This document records the design and integration contract; the new screenshot
layouts and source switch are not implemented yet. No screenshot files should
be saved in the repository. Do not make more Figma MCP calls or use
agent-browser (including eval). Work in tiny reviewable chunks.

## Review checkpoints

1. Create empty React components and preserve design references (complete).
2. Add the miniplayer container scaffold (complete).
3. Add the fullscreen container scaffold (complete).
4. Add audio integration only after the scaffolds have been reviewed.

Audio integration review chunks:

1. Source contracts, playback requests, and confirmed store state (implemented;
   stop for review before the next chunk).
2. Integrate the Mixcloud widget independently (API loader and standalone host
   subchunks implemented; store adapter not started).
3. Connect the widget to the miniplayer (not started).

Stop for review after each chunk. SAMCast playback and navigation continuity
remain later integration work.

Widget integration is split into smaller review checkpoints:

1. `src/components/mixcloud/mixcloud-api.ts`: typed playback API boundary and browser-only
   script loader (implemented). Concurrent callers share one load; failures
   reject and allow retry. Existing API globals are checked before reuse.
   Importing the module does not access browser globals. Focused tests cover
   shared loading, existing API reuse, network failure/retry, and invalid API.
2. Visible standalone iframe host and widget readiness (implemented; stop
   for review). `MixcloudWidget.tsx` accepts an `initialCloudcastKey` and required
   `iframeParams` widget options, renders
   one labeled dark mini iframe, and keeps its initial `src` stable. Invalid
   show keys are rejected before embedding. Initialization waits for widget
   readiness and validates the required playback methods/events; failure
   leaves the iframe visible and shows a connection message. Effect cleanup
   ignores late readiness results. No autoplay or playback commands are issued.
   Focused tests cover deferred readiness, failures, URL validation/encoding,
   and browser-free server rendering. Real embed readiness and responsive
   sizing still require manual verification when the host is mounted; these
   tests do not run a browser or connect to Mixcloud.
   `mixcloudEmbedUrl(key, params)` accepts typed boolean `mini`, `hide_cover`,
   and `light` options with no defaults. Callers pass all three explicitly via
   `MixcloudWidget`'s `iframeParams` prop. Both the key and options initialize
   the iframe URL once at mount.
3. Shared-store request adapter and widget event confirmations (not started).

The standalone host is not mounted in the site yet. The loader is called only
when that host mounts; shared-store playback requests are not consumed yet.
Stop for review after each subchunk before connecting the miniplayer.

Latest fullscreen direction: Mixcloud fullscreen must include the widget.
Stretching the existing miniplayer into fullscreen may preserve its iframe;
the separate component versus shared host decision remains for that chunk.
A persistent Astro shell is possible using a custom `astro:before-swap`
implementation that replaces page content while keeping the player attached.
See [Astro custom swap guidance](https://docs.astro.build/en/guides/view-transitions/#building-a-custom-swap-function).
Navigation changes and real playback continuity verification remain separate.

Chunk 1 created `src/components/Miniplayer.tsx` and
`src/components/FullscreenPlayer.tsx` as empty components returning `null`.
The navigation integration now mounts `Miniplayer` as a hydrated, persisted
island after the navigation title. It renders a `data-miniplayer` container
inside a right-aligned, width-constrained navigation slot only when the shared
audio store has a selected track; the title comes from that track. Loading and
error states retain the selection as well as playing and paused states.
The miniplayer's Fullscreen button mounts `FullscreenPlayer` with an `onClose`
callback. The view uses a native modal `dialog`, opened via `showModal()`,
with a Close button and native Escape dismissal. It covers the viewport with
a black background and white text, uses shared spacing tokens, and permits
scrolling when future player content exceeds the viewport. Native modal
behavior manages focus and makes the background inert.

The compact player now uses a flex column containing a controls row (track
title and the user's `F` fullscreen button), followed by a decorative progress
track. The future play/pause control belongs before the title; it is not added
in this chunk. The track has no elapsed value or interaction until audio is
wired, and is hidden from assistive technology. `Miniplayer.module.css` owns
the layout and reuses shared spacing and border tokens.

The previous hover-layout implementation was explicitly undone at the user's
request. Hover is still deferred. React and CSS should own the layout; do not
manually reparent React-owned DOM nodes. Use the latest source-specific layouts
below when that chunk is requested.

`FullscreenPlayer.module.css` locks scrolling on `html` and `body` while a
`dialog[data-fullscreen-player][open]` exists. Closing or unmounting it removes
the matching condition and restores existing page styles without inline-style
mutation. `overscroll-behavior: contain` keeps player scrolling from chaining
to the page. Content layout and audio remain deferred.

Scroll-lock verification requires a browser layout engine; lint, Astro checks,
and build validate the source only. Browser automation is disabled at the
user's request. Manual acceptance: open fullscreen on a scrolled archive page,
attempt background scrolling, close via Close or Escape, and confirm normal
scrolling resumes without losing the page position. Repeat open/close.
The user wants to add the UI incrementally and hand it back when ready; do not
add all the buttons or complete the pictured UI without further direction.

## Intended integration

### Shared playback store (implemented)

`src/stores/audio/audio-store.ts` exports the `AudioStore` class and readonly
`AudioTrack` / `AudioState` types. `src/stores/stores.ts` owns shared instance creation
and exports `stores.audioStore` plus `createStores()` for independent instances.
Track metadata consists of `title` and a discriminated source:

```ts
type PlaybackSource =
  | { kind: "mixcloud"; cloudcastKey: string }
  | { kind: "samcast"; streamUrl: string };
```

Mixcloud uses a show key such as `/dj/show/`, not the iframe URL. SAMCast uses
a playable stream URL; its metadata endpoint is separate future work.

- `select(track)` (also `play(track)`) stores an immutable copy of the track,
  changes state to `loading`, and publishes a `load` request. It does not claim
  that playback has started. Reselecting creates a fresh selection identity.
- `play()` and `pause()` publish `play` / `pause` requests for the retained
  track. They keep confirmed state until an adapter reports actual playback.
  Retrying after `error` enters `loading`. Requests without a selection do
  nothing. A newer play/pause request can reverse an unconfirmed earlier one.
- `clear()` publishes a `clear` request, returns to idle, hides the visible
  player, and unmounts fullscreen. The adapter must stop the previous source.
- `confirmPlaying(track)`, `confirmPaused(track)`, and
  `reportError(track, message)` update display state only; they never publish
  another playback request. Pass the exact selected track object from the
  request. Reports from old/cleared selections are ignored.
- `subscribe(callback)` returns an unsubscribe function; callbacks read the
  updated snapshot through `getSnapshot()`. Snapshots stay referentially stable
  until state changes and track metadata is copied/frozen at the boundary.
  Internally each subscription is a listener object with a `notify()` method;
  the public callback API remains compatible with `useSyncExternalStore`.
- `subscribeRequests(callback)` is the separate adapter subscription; read
  `getRequestSnapshot()` for the latest immutable `{ id, action, track }`
  request (`clear` has no track). IDs increase with requests, so an adapter
  can reject stale asynchronous completions. Before any request, it is
  `undefined`. Late-mounting adapters must read the latest request after
  subscribing, and again after widget readiness, rather than replaying an old
  load. For a latest pause/play intent, load its selected source if necessary
  before applying that intent. Confirmations do not change this snapshot.
- `getServerSnapshot()` always returns the same idle snapshot so Astro HTML
  and initial hydration agree, without accessing browser audio APIs.

Publish flow: show button → `select(track)` → load request + loading snapshot
→ adapter loads/plays → source emits play → `confirmPlaying(selectedTrack)`
→ playing snapshot → UI rerenders. Separating request notifications from state
notifications prevents playback confirmation from calling play again.

An Astro page can import `stores` in a browser `<script>` and call `select()`
from a button handler; this shares the same browser instance as the player.
Astro frontmatter runs during the build and cannot notify a visitor's store.
External URLs still need normalization/validation at the future source boundary.
ClientRouter navigation replaces page content; bind future show-button handlers
with an appropriate delegated handler or page lifecycle setup/cleanup so they
still work after navigation without accumulating duplicate listeners.

Both views use `useAudioState()` / `useSyncExternalStore`, which resolves the
audio store through `useStores()`. The context defaults to application stores.
Tests can wrap a React tree in `<StoresProvider stores={createStores()}>` to
inject independent stores into both views. Create that store set once per test
or mounted tree, not during each render. Context overrides apply within one
React tree; separate Astro islands use the same default module instance.
Do not pass class instances as hydrated props from Astro.

Fullscreen visibility is local React state, separate from playback. The
application store set is a module singleton, not created during component
rendering; full document reloads start idle.
No new playback buttons, automatic selection, or sample track are introduced.
The site therefore starts with no visible miniplayer until future source
controls call the store. No adapter consumes requests yet, so selection stays
loading until a confirmation is supplied. Real audio and error presentation
remain deferred.

Store tests cover unconfirmed requests, confirmation without command feedback,
errors/retry, pending intent reversal, old-selection rejection, clearing, source
changes, late readers, stable server snapshots, nested immutable metadata, and
subscription cleanup. The generated-page test checks that the persistent
island still exists but idle UI is absent. Interactive synchronization and
clear/reopen behavior require manual review; do not use agent-browser.

The player belongs in the existing navigation, in this order:

Home link → Other Desert Radio / Archive → source-specific player → fullscreen.

### Source-specific rendering (planned)

Keep a `switch` statement in the miniplayer after its idle guard, narrowing
`track.source.kind`. The branches are:

```text
switch (track.source.kind) {
  case "mixcloud":
    visible Mixcloud mini iframe + fullscreen button
  case "samcast":
    custom play/pause + title + fullscreen button
    custom stream status/progress presentation where meaningful
}
```

The widget supplies Mixcloud's compact play/pause and title UI; do not add a
duplicate custom compact playback row for that source. Fullscreen opening is
an application control outside the iframe. Shared show artwork, genre tags,
DJ information, progress presentation, and fullscreen visibility stay in the
application UI. The original custom controls remain the SAMCast branch.
Both branches use the same `AudioStore`; do not add a second playback store
that independently owns selected-track or playing/paused state.

Use two source adapters: one controls the Mixcloud widget, one controls a
browser `<audio>` element for the SAMCast URL. Adapters consume requests and
publish confirmations into the shared store. On source changes, stop/pause the
previous backend so two sources cannot play simultaneously. The store's source
switch is rendering logic, not the source of playback confirmation.

SAMCast is a live stream. A finite duration or seekable archive-style progress
bar must not be assumed; live now-playing metadata needs a separate endpoint
and contract. Neither the stream URL nor that endpoint has been configured.

Use React for player state and the fullscreen view. The intended host is a
single hydrated React island in `Navigation.astro`, with `client:load` and
`transition:persist="miniplayer"` (now implemented). `BaseLayout.astro` includes Astro's
`ClientRouter`. Internal navigation should retain the island and playback;
full document reloads recreate it. Verify persistence when that integration
is implemented. Both views must share one playback owner so opening or closing
the fullscreen view does not restart audio. Do not create a second player
inside the fullscreen view.

Astro's [view-transition documentation](https://docs.astro.build/en/guides/view-transitions/#maintaining-state)
notes that persisted iframes can still reload during navigation. The island
persistence therefore does not establish uninterrupted Mixcloud playback;
test and resolve that integration when audio is added.

### Mixcloud visibility and continuous playback requirements

Host one Mixcloud widget in the miniplayer and keep it visibly rendered in
the compact state. The existing sticky navigation should keep the widget
visible while the user scrolls. Hover expansion may reveal additional artwork
and information, but must not be required to show or mount the widget. Provide
keyboard-focus and tap access to the expanded view as well.

The [Mixcloud widget API documentation](https://www.mixcloud.com/developers/widget/)
requires the widget to be visible on the page for the API to work; it does not
define whether scrolling offscreen counts as hidden. Do not hide the playing
widget with CSS or render it only inside the hover panel.

The requirement concerns the embedded widget itself. Visible custom controls
do not replace it. `Mixcloud.PlayerWidget(iframeElement)` controls that iframe
via asynchronous `postMessage`; it is not a standalone audio player. Mixcloud's
[REST API documentation](https://www.mixcloud.com/developers/#audio-streams)
states that audio streams are not supplied through the API and directs
third-party sites to embed the player. A completely custom player without
any Mixcloud iframe would require independently hosted audio, not this API.

Adapter facts from the [widget documentation](https://www.mixcloud.com/developers/widget/):

- Load `https://widget.mixcloud.com/media/js/widgetApi.js` once per document.
  Create one widget API object for the one persistent iframe. Wait for
  `widget.ready` before using its API.
- `load(cloudcastKey, true)` selects another show and requests playback after
  loading. Reuse the widget; do not reset iframe `src` for each selection.
- `play()`, `pause()`, `togglePlay()`, `seek(seconds)`, `getPosition()`,
  `getDuration()`, and `getIsPaused()` return promises. Seeking resolves with
  whether the seek was allowed; do not assume every show can seek freely.
- Events are `progress`, `buffering`, `play`, `pause`, `ended`, and `error`.
  Subscribe with `widget.events.<event>.on(listener)` and unsubscribe with
  `.off(listener)`. Progress supplies position and duration.
- Options include `mini`, `hide_cover`, `hide_tracklist`, `hide_artwork`, and
  `light`. Use the mini widget shown by the new design; retain its native
  branding, controls, and metadata. Parent-page CSS cannot restyle the
  cross-origin iframe's internal HTML.
- Playback requests can be blocked by browser autoplay policy. A clicked show
  button is the intended trigger, but mounting/ready/load are asynchronous;
  handle blocked playback and permit interaction with the visible widget.
  Do not claim playing until the widget reports it.

Keep adapter method calls and widget events separate: an emitted `play` updates
the store via `confirmPlaying()`, not another `widget.play()` call. Native
widget interactions must update the shared state too. Read the latest request
again after readiness and reject superseded promise completions using request
IDs. Unsubscribe and cancel pending work on disposal. The store currently has
no progress/buffering fields or seek request; these require a later store chunk
before the pictured custom progress bars can be wired. Map `ended` deliberately
in that integration chunk; do not invent an implemented ended state.

Playback must continue without restarting or interrupting when switching
between SHOWS and DJs, visiting show or DJ detail pages, or using browser
Back/Forward within the archive. Keep the same iframe mounted and attached,
with a stable `src` during playback; opening hover or fullscreen views must
not replace, reparent, or create a second iframe. Both views control the same
playback owner.

The latest fullscreen design contains the visible widget near its top. It
means the **same** iframe must remain visibly rendered, not a second embed
inside `FullscreenPlayer`. The current native fullscreen dialog would cover
an iframe left behind in the navbar. Resolve the shared host/top-layer layout
before implementing fullscreen Mixcloud playback; hiding it behind the modal,
portaling/reparenting it on open, or remounting it on close is not an accepted
solution. That architecture is not solved by the current scaffold.

`transition:persist="miniplayer"` alone does not satisfy this requirement:
Astro documents iframe reloads during view transitions even with persistence.
Verify the real embed before relying on the current navigation mechanism. If
the normal page swap reloads the iframe, use a navigation approach that keeps
the player attached while replacing page content, such as a persistent page
shell. The exact approach remains an integration decision.

Manual acceptance for the audio integration: start a show, scroll the archive,
expand and collapse the miniplayer, open and close fullscreen, navigate through
SHOWS, DJs, and their detail pages, then use Back/Forward. Audio must continue
without a gap or position reset, and the widget must not reload. Full document
reloads and leaving the archive are outside this continuity requirement.

Also verify selecting another show, direct widget pause/resume, loading failure,
blocked autoplay, rapidly changing selection before readiness, clear while
loading, and switching Mixcloud → SAMCast → Mixcloud. Only one backend may play;
old-source callbacks must not overwrite the new selection. Reopening fullscreen
must display current state immediately, including a paused track. Idle means
no selected track and no visible player; paused is a retained selection with
the player and fullscreen access still available.

Future audio sources are Mixcloud widgets for archive shows and a SAMCast live
broadcast with now-playing metadata. The shared source/request contract is
implemented above. Source adapters, live now-playing metadata, playback
controls, and iframe continuity wiring remain deferred; no live stream URL
has been configured.

## Design evidence and limitations

The original Figma file is
[Other Desert Radio](https://www.figma.com/design/BzM2IkYW1taFeepxrz8ue0/Other-Desert-Radio).
The user requested only one Figma MCP call because they use the free plan.
That read attempted all three nodes, but its response exceeded the tool's
20,480-byte limit (154,039 bytes) and returned no usable design capture.
Do not make another Figma MCP call without new authorization.

The user subsequently supplied three screenshots in the conversation. At the
user's request, only their written descriptions are retained in the repository.
Measurements below are approximate screenshot
pixels, not verified Figma dimensions or design tokens. Font appearance is
monospaced and consistent with the site's Space Mono; exact font metrics,
colors, layout constraints, and prototype interactions were not captured.
No reference image files are stored in the repository.

Two sets of screenshots were supplied. The newer widget-based Mixcloud set is
authoritative for Mixcloud. The original Figma images are retained below only
as custom-control references for SAMCast and shared visual cues. They do not
override the visible-widget requirement or imply a seekable live stream.

## Latest Mixcloud designs

These descriptions capture the newer screenshots without saving their files.
Natural raster sizes are recorded for reference, not CSS target sizes. There
is no new Figma node/context capture for this revision, so spacing/color/font
measurements remain approximate. Build responsive layouts with repository
tokens and existing breakpoints.

### Image 1 — compact navbar

- Natural reference size: 2068 × 1604, showing the full archive page. Black
  navigation spans its top; HOME/back link and OTHER DESERT RADIO / ARCHIVE
  remain on the left.
- Right-side player is a single horizontal row: wide, visibly rendered
  Mixcloud mini widget, then a separate white diagonal expand-arrow control.
  The widget uses a dark charcoal rectangle against the black navbar.
- Native widget contents: pause icon at left; bold show title on the upper
  line; “by otherdesertradio” and a FOLLOW control below; Mixcloud branding at
  right. The widget occupies roughly 45% of the screenshot width. It stays
  readable and visible while the underlying archive scrolls.
- There is no separate application title, custom play/pause, favorite button,
  artwork, tags, DJ biography, or application progress bar in compact Mixcloud
  mode. Keep those controls for the appropriate source/expanded views.
- The expand control remains outside the iframe and opens application
  fullscreen. The archive listing, tabs, search, sorting, and DJ cards beneath
  navigation are out of scope.

### Image 2 — expanded on hover

- Natural reference size: 1044 × 1298. Black vertical panel fills the reference
  with a fine pale edge at left/bottom. It is an overlay anchored to the
  compact player's right side, not a page layout that pushes listings aside.
- Top row retains the visible mini widget across almost the entire panel;
  the diagonal expand-arrow control sits separately at the right. The widget
  stays first and is not replaced by custom playback buttons.
- Custom elapsed/progress/duration row sits **below the widget and above the
  artwork**: “15:01” at left, a thin white/gray horizontal track across most
  of the width, and “42:08” at right. Values are illustrative only. Wire it to
  widget progress in a later chunk; seek behavior is not established by the
  picture.
- Large square yellow show poster is centered beneath the progress row,
  approximately three-fifths of the panel's width. Preserve its square ratio
  and use real selected-show artwork, never a screenshot crop.
- Below the poster, two genre chips stack vertically on its left: “Sudanese
  folk” in muted blue, then “Sudanese pop” in tan. Black monospaced text and
  square corners match the site's tags. Large gray-outline heart sits at the
  right of this row; favorite behavior is not implemented.
- Bottom section has a square DJ portrait on the left and a lengthy white
  monospaced biography on the right. It describes Derek Monypeny's Arizona,
  Sahara, and Mojave background and musical interests. Use actual DJ content;
  the screenshot is not an authoritative data source. Let this section scroll
  within the panel when available height is insufficient.
- No separate large show heading or custom pause glyph is drawn between the
  widget and poster; the widget owns title and playback controls here.
- Hover is the desktop trigger. Keyboard focus and a deliberate touch path
  must also expose the information without requiring hover. The touch trigger,
  collapse timing, and exact panel geometry remain for the later hover chunk.

Layout intent:

```text
flex column {
  flex row { same visible Mixcloud widget, fullscreen button }
  flex row { elapsed time, progress track, duration }
  show artwork
  flex row { flex column { genre tags }, spacer, favorite }
  flex row { DJ portrait, DJ biography }
}
```

### Image 3 — fullscreen

- Natural reference size: 2198 × 1426. Black viewport view hides the archive.
  Small OTHER DESERT RADIO label is at upper left; thin white X close control
  is at upper right. Closing returns to the compact/expanded player without
  restarting its audio or losing playback position.
- Below the header, a full-width charcoal mini widget runs across almost all
  of the content width. This is the same playback iframe as the compact view;
  changing presentation must not detach it. It remains visible above the
  artwork/details.
- Main content below is a two-column composition. A large square yellow show
  poster fills most of the left half. Right column starts with a very large
  monospaced title wrapping over three lines: “Freedom Overspill”, “Radio Hour
  #32,”, “Sudanese 60s-70s”. Real title length may change line breaks.
- Blue “Sudanese folk” and tan “Sudanese pop” chips appear side by side under
  the title. The rest of the right column has generous black breathing room;
  there is no large custom pause glyph for Mixcloud.
- Near the bottom of the right column: custom progress row with elapsed time,
  wide white/gray track, and total duration. Below that, an outlined heart at
  left and “Derek Monypeny” in large white type aligned toward the right.
- No DJ portrait or biography appears in this fullscreen screenshot. Narrow
  viewport layouts must stack/reflow without hiding the widget or overflowing;
  no mobile-specific screenshot has been supplied.

Layout intent:

```text
flex column {
  flex row { Other Desert Radio label, spacer, close button }
  same visible Mixcloud widget
  responsive columns {
    show artwork
    flex column {
      show title
      flex row { genre tags }
      flexible space
      flex row { elapsed time, progress track, duration }
      flex row { favorite, spacer, DJ name }
    }
  }
}
```

All three new mockups show a Justin Paszul / Mixed-Up Files title inside the
widget while expanded/fullscreen artwork and metadata describe Derek Monypeny's
Freedom Overspill show. This is a mockup inconsistency, not intended behavior:
the iframe, custom title, artwork, tags, progress, and DJ data must all match
the same selected show in implementation. Do not hardcode either mock title.

## Original custom-control references (SAMCast/shared cues)

The original descriptions below predate the visible-widget revision. Retain
their custom control styling and shared layout cues for the live source; they
are historical Mixcloud layouts and must not be implemented for that source.

### Default miniplayer — node 374:1129

- Reference size: 1296 × 1010. The black navigation is approximately x=8,
  y=14, width=1280, height=67. White text and controls sit on black.
- Left: back arrow and bold uppercase HOME, then OTHER DESERT RADIO / ARCHIVE.
  These are existing navigation elements, not new player controls.
- Compact player occupies the right portion of the bar, beginning around
  x=714. Small pause glyph precedes the single-line title, approximately
  16px tall: “Freedom Overspill Radio Hour #32, Sudanese 60s-70s”.
- Thin light-gray progress line runs under the title/control row, roughly
  x=715–1211 at y=65. A tiny “42:08” duration appears to its right.
- No artwork, tags, heart, or DJ biography is visible in this state. The
  fullscreen button is required by the user's requested order, though it is
  not clearly visible in this screenshot; do not infer an exact compact icon
  position from this image.
- The archive listing remains visible beneath the navigation. Changes to its
  tabs, search field, ordering control, or DJ cards are outside this feature.

### Expanded / mouse-over miniplayer — node 376:1011

- Reference size: 1298 × 1002. Black panel overlays the right side of the
  archive, approximately x=705, y=6, width=590, height=879; it does not push
  the underlying listing aside. Thin pale border is visible at left/bottom.
- Top controls: large white pause glyph near x=731, y=31 (about 47 × 51),
  outlined gray heart beside it, diagonal expand arrows at the top right.
- Title below the controls wraps to two lines, starting near x=731, y=121,
  at approximately 22px with generous line spacing. Same title as default.
- Two small rectangular tags appear below: “Sudanese folk” on muted blue,
  and “Sudanese pop” on tan; black monospaced text, no rounded corners.
- Square yellow show artwork is centered below the title/tags, approximately
  x=781, y=221, size=391 × 391. It contains the radio/show poster, portraits,
  Arabic lettering, and episode/date information. Use actual show artwork in
  a future implementation, not a crop of this screenshot.
- Beneath artwork: thin progress bar with white completed portion and gray
  remainder. Small elapsed “15:01” at left and duration “42:08” at right.
- Bottom section starts around y=690: “Derek Monypeny” above a portrait on the
  left (roughly 140px square), with a multi-line biography to the right in
  smaller white text. Biography describes Arizona origins, Sahara exploration,
  Mojave residence, and desert-related musical interests. Exact copy must
  come from content data rather than this approximate transcription.
- User labels this state “expanded”; the original request says mouse-over.
  Touch, keyboard, dismissal, favorite behavior, and expansion timing are
  unspecified. Resolve these when interaction work is requested.

### Fullscreen player — node 376:1124

- Reference size: 1546 × 990. Black view fills the canvas with a subtle dark
  outer edge; the archive and normal navigation are no longer visible.
- Small OTHER DESERT RADIO label sits near x=51, y=41. Thin white X close
  glyph is at the upper right, around x=1458, y=42, size=28 × 28.
- Main content is two columns. Large square show artwork occupies the left,
  approximately x=51, y=139, size=727 × 727. It is the same yellow poster as
  the expanded view.
- Right column begins near x=835. Title starts around y=220 in roughly 38px
  white monospaced text, wrapping into “Freedom Overspill Radio Hour” and
  “#32, Sudanese 60s-70s”. Blue/tan tags follow at y≈325, about 31px tall.
- Large centered pause glyph appears in the right column around x=1106,
  y=486, size=71 × 100, with substantial open space around it.
- Progress row is near y=764: elapsed “15:01”, wide bar, duration “42:08”.
  Bar is approximately x=893–1380, height=26; white fill covers about a quarter
  of the gray track in the screenshot. Treat this as illustrative, not a
  mathematically specified elapsed-time ratio.
- Outlined heart appears below at left near x=835, y=823. “Derek Monypeny”
  sits at the bottom right of the content column in large white type. No DJ
  portrait or biography is shown in fullscreen.
- Screenshot establishes an expanded viewport view, but does not establish
  browser Fullscreen API behavior. Default to an in-page viewport overlay
  when implementation is requested unless the user asks for native fullscreen.

## Constraints for later chunks

Reuse existing typography, spacing, density variables, tag components, and
content images after inspecting their contracts. Use rem-based sizing and the
breakpoints in `docs/css.md`; do not translate screenshot coordinates directly
into fixed desktop positioning. No mobile reference has been provided.
Future layouts must work at narrow widths and preserve readable title text.
Interactive controls require descriptive `aria-label` values. Native modal
focus/Escape and page scroll locking exist in the current fullscreen scaffold;
any shared-host revision must preserve those behaviors. Keyboard/touch access
to hover expansion, favorite behavior, progress display/seek, and metadata
layout are still deferred. Do not add all pictured UI at once.

Chunk 1 had no rendered behavior to unit-test. The navigation integration is
covered by `tests/miniplayer-navigation.test.ts`, which builds the site and
checks every generated page for exactly one persisted, load-hydrated island
inside navigation, with the idle player container absent. This verifies the
rendered integration; runtime state and audio continuity need browser checks
once state and audio are introduced.

The fullscreen scaffold passed lint and Astro checks. A temporary browser
mount confirmed black background and exact viewport coverage at 1280 × 633
and 320 × 700; the temporary mount was removed afterward. No automated behavior
test was added for this empty, unmounted presentation container. Add interaction
tests when opening and closing are implemented.
