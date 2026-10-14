# Miniplayer

This reference owns player-specific behavior and layout. General styling rules
live in [CSS](css.md); verification commands and the navigation regression live
in [Testing](testing.md). Player implementation and styles live in
`src/components/miniplayer/`; consumers import its public entry point.
Miniplayer composes FullscreenNav, TrackTitle and the compact controls around one
shared widget. These visual components receive props and callbacks;
usePlayerPresentation owns presentation/sizing and delegates scroll locking to
scroll-lock.ts.

## Data and playback

ShowCard passes the full Show to `mixcloudShowTrack`, which validates its Mixcloud
URL and produces an AudioTrack containing the required show and playback source.
The audio store publishes selection, play, pause and clear requests. Miniplayer
subscribes to its state and reads metadata from `track.show`, including the title.
Internal links use the configured archive base path.

The audio store has immutable idle, loading, playing, paused and error snapshots.
Adapter confirmations update state without publishing new commands; callbacks
from old selections are ignored. Mixcloud sources identify a cloudcast key;
SAMCast sources identify a stream URL and currently retain a title/progress scaffold.
`createStores()` provides isolated stores; React consumers use `useStores()` and
can override instances with StoresProvider. The audio subscription uses
`useSyncExternalStore` with an idle server snapshot for static HTML and hydration.

Idle renders no player; clearing the selection unmounts it. The Mixcloud branch
renders one widget, which owns its adapter lifecycle. Later show selections use
`widget.load()` rather than replacing the iframe or changing its original src.
The adapter gates requests on readiness, serializes loads and playback commands,
reports errors, and removes subscriptions and listeners on disposal. Clear,
source changes and disposal request pause. Widget events confirm playback;
command completion alone does not. Events during loads are ignored.

## Responsive layout

The shared sticky header contains navigation followed by a full-width bar using
`--miniplayer-background`. The idle bar collapses; the active player supplies its
height. Metadata aligns with navigation text. Above 1023px, linked DJ names, a
decorative divider and the linked show title sit alongside the widget, followed
by text heart and fullscreen buttons. Each DJ has its own link; shows without
DJs omit the divider. Metadata uses a single line with ellipsis; the iframe has
a maximum width of 40rem.

From above 600px through 1023px, metadata wraps onto its own row. The widget sits
left underneath with the desktop controls aligned right.

At 600px and below, the bar is fixed to the viewport bottom while navigation
stays at the top. Metadata and desktop actions are hidden. A borderless,
content-width “expand ↑” button sits immediately above the widget at its right
edge, without a full-width background strip. The heart remains unwired.

Safe-area padding stays inside the active bar. A border-box ResizeObserver
publishes its height as `--miniplayer-height`; BaseLayout reserves that height in
main padding, using the bottom safe-area inset when idle. The expand button sits
outside the measured bar above its top edge.

## Fullscreen presentation

Both expand controls switch local presentation state to fullscreen; the close
button restores compact presentation. Activating fullscreen show, tag or DJ
links also closes fullscreen and releases scroll locking while normal archive
navigation preserves the playing iframe. The same player container becomes fixed
and fills the viewport with a black background, a station header and a close SVG.
Compact metadata and actions are hidden. The existing iframe stays mounted in
its original position in the React tree: at the viewport bottom on mobile and
in the right-hand content area on desktop.

Fullscreen controls use a grid with large show artwork, a wrapping linked
title, colored tag links, an unwired outline heart button and linked DJ portraits
and names. All DJs render; shows without DJs omit their content and missing
portrait references omit the image. Tags use the existing large TagView inside
archive links and
resolve show tag IDs against the existing catalog, preserving their order and
colors, and link to archive tag pages. Missing IDs use hydrateTags' existing
logging/omission behavior. Above 1023px, artwork
spans the left column and the other slots
occupy the right. At 1023px and below, the slots stack as artwork, metadata,
a shared row with heart left and DJs right, then the bottom widget. Desktop
artwork occupies a 1:1 square bounded by column
width and the content area's height, without cropping. Desktop content is
centered vertically and bounded by 80% of viewport height and 52rem; artwork
and right-hand content are centered within their respective columns. The two equal desktop columns share a centered 100rem maximum-width container.
Metadata, widget and the heart/DJ flex row stretch to the same right-column width. The
stacked grid assigns remaining height to artwork, which shrinks to fit without
overlapping metadata. Content can scroll when it exceeds its height, with the
widget sticky at the bottom. Detail slots are hidden in compact mode; artwork/title mount only
in fullscreen. The widget retains its existing parent in both modes.

A player-shell wrapper reserves the compact height measured on expand, so the
bar's resize observer does not turn fullscreen height into page clearance.
Fullscreen fixes the body at its current scroll offset and hides root overflow to
lock background scrolling, including iOS touch scrolling. Closing or unmounting
restores prior inline styles and scroll position. Scrollbar space is compensated
to avoid shifting page content.

Keyboard shortcuts, focus management and background focus isolation are deferred.
Use the X button to close fullscreen.

## Preserve the iframe

Navigation mounts Miniplayer with `client:load` and the stable
`transition:persist="miniplayer"` name across pages using BaseLayout. Keep the
existing iframe mounted and attached when changing its presentation.

`src/utils/preserve-player-navigation.ts` customizes Astro's swap when the header
contains an iframe and the browser lacks `moveBefore()`. It preserves the body
and header, replacing navigation and surrounding content without detaching the
iframe. Idle navigation and browsers supporting state-preserving moves use
Astro's default swap. Pages without the shared header also use the default swap.
This protects playback in browsers where ordinary DOM moves reload iframes.
Full document reloads and navigation outside the archive still end playback.
