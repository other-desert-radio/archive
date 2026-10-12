# Miniplayer

## Review checkpoints

1. Create empty React components and preserve design references (current chunk).
2. Add the miniplayer container scaffold, then stop for review.
3. Add the fullscreen container scaffold, then stop for review.
4. Add audio integration only after the scaffolds have been reviewed.

Chunk 1 created `src/components/Miniplayer.tsx` and
`src/components/FullscreenPlayer.tsx` as empty components returning `null`.
The navigation integration now mounts `Miniplayer` as a hydrated, persisted
island after the navigation title. It renders an empty `data-miniplayer`
container inside a right-aligned, width-constrained navigation slot.
`FullscreenPlayer` still returns `null` and remains unmounted. No props,
controls, playback behavior, or dependencies have been introduced.
The user wants to add the UI incrementally and hand it back when ready; do not
add all the buttons or complete the pictured UI without further direction.

## Intended integration

The player belongs in the existing navigation, in this order:

Home link → Other Desert Radio / Archive → play/pause → title → fullscreen.

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

Future audio sources are Mixcloud widgets for archive shows and a SAMCast live
broadcast with now-playing metadata. Source adapters, metadata contracts,
playback controls, and persistence wiring are deferred; no integration choices
or stream URLs have been established yet.

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
Interactive controls require descriptive `aria-label` values. Modal focus,
Escape handling, and keyboard/touch access belong to the later interaction
chunk, not these file placeholders.

Chunk 1 had no rendered behavior to unit-test. The navigation integration is
covered by `tests/miniplayer-navigation.test.ts`, which builds the site and
checks every generated page for exactly one persisted, load-hydrated island
inside navigation, with the player container present. This verifies the
rendered integration; runtime state and audio continuity need browser checks
once state and audio are introduced.
