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

The shared sticky header contains navigation and a full-width player bar fixed
to the viewport bottom using `--miniplayer-background`. The idle bar collapses; the active player supplies its
height. Metadata aligns with navigation text. Above 1023px, linked DJ names, a
decorative divider and the linked show title sit alongside the widget, followed
by outline bookmark and fullscreen buttons. Each DJ has its own link; shows without
DJs omit the divider. Metadata uses a single line with ellipsis; the iframe has
a maximum width of 40rem.

From above 600px through 1023px, metadata wraps onto its own row. The widget fills
the available width underneath alongside the desktop controls on the right.

At 600px and below, metadata and desktop actions are hidden. A borderless,
content-width “expand ↑” button sits immediately above the widget at its right
edge, without a full-width background strip. The button supports tap-to-expand and upward dragging with inertia. It stays labeled expand throughout the upward movement and disappears once fullscreen is reached. At phone widths it is the only upward drag target; the mound is hidden. Fullscreen has no mobile collapse button; use X to dismiss. The bookmark remains unwired.

Safe-area padding stays inside the active bar. A border-box ResizeObserver
publishes its height as `--miniplayer-height`; BaseLayout reserves that height in
main padding, using the bottom safe-area inset when idle. The expand button sits
outside the measured bar above its top edge.

## Fullscreen presentation

The compact player also has a curved hover mound that follows the mouse, with an up arrow at its crest. It starts small and grows smoothly as the pointer approaches the top edge, reaching full height at the mound. Clicking the mound opens fullscreen; dragging it reveals the fullscreen player directly. Release distance and recent pointer velocity determine whether it settles open or returns to compact. The fullscreen nav accepts downward drags without a hover nudge or arrow. The compact title fades out before the station name and close control fade in, with a brief gap between labels; pulling down reverses that sequence. Pulling down reverses the gesture; X slides down and the fullscreen button slides up. Empty compact-player space also accepts upward drags, excluding text and interactive controls. Reduced motion disables the settling animation. Pointer tracking applies to the player surface; the cross-origin Mixcloud iframe does not forward pointer movement.

Both expand controls switch local presentation state to fullscreen; the close
button restores compact presentation. Activating fullscreen show, tag or DJ
links uses the immediate-close path and releases scroll locking synchronously before client navigation while playback continues. The X button retains its animated dismissal. During phone dismissal, the existing widget stays anchored above the bottom safe area while the fullscreen panel moves down, avoiding an empty bar before the compact layout returns. The mobile expand button is also visible in its compact position during dismissal. The same player container becomes fixed
and fills the viewport with the miniplayer background, a station header and a close SVG.
Compact metadata and actions are hidden. The existing iframe stays mounted in
its original position in the React tree: across the viewport bottom at every screen width.

Fullscreen controls use a grid with large show artwork, a wrapping linked
title, colored tag links, an unwired outline bookmark button and linked DJ portraits
and names. All DJs render; shows without DJs omit their content and missing
portrait references omit the image. Tags use the existing large TagView inside
archive links and
resolve show tag IDs against the existing catalog, preserving their order and
colors, and link to archive tag pages. Missing IDs use hydrateTags' existing
logging/omission behavior. Above 1023px, artwork
spans the left column and the other slots
occupy the right. At 1023px and below, the slots stack as artwork, metadata,
a shared row with bookmark left and DJs right, then the bottom widget. Desktop
artwork occupies a 1:1 square bounded by column
width and the content area's height, without cropping. Desktop content is
centered vertically; artwork is bounded by 80% of viewport height and 52rem.
The artwork determines the row height, with right-hand metadata aligned to its top. The two equal desktop columns share a centered 100rem maximum-width container.
Metadata and the bookmark/DJ flex row stretch to the same right-column width. The
stacked layout caps square artwork at 45% of viewport height and places metadata
one medium spacing token below it; remaining height belongs to the content column. Content can scroll when it exceeds its height, with the
widget anchored full width at the bottom, with its height reserved outside the scrolling content. Detail slots are hidden in compact mode; artwork/title mount only
in fullscreen. The widget retains its existing parent in both modes.

A player-shell wrapper reserves the compact height measured on expand, so the
bar's resize observer does not turn fullscreen height into page clearance.
Fullscreen hides root overflow without fixing the body or creating a body scroll container, preserving sticky navigation and the category tabs’ scroll timeline. A touch guard blocks background gestures while the fullscreen controls retain contained scrolling. Closing or unmounting
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
Navigation between category tabs and show, DJ and tag detail pages preserves
playback. Full reloads and navigation outside the archive end playback.
