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
edge, without a full-width background strip. The button supports tap-to-expand and upward dragging with inertia. It stays labeled expand throughout the upward movement and disappears once fullscreen is reached. At phone widths it is the only upward drag target; the mound is hidden. Fullscreen has no mobile collapse button; use X to dismiss. The compact bookmark opens the playlist modal.

Safe-area padding stays inside the active bar. A border-box ResizeObserver
publishes its height as `--miniplayer-height`; BaseLayout reserves that height in
main padding, using the bottom safe-area inset when idle. The expand button sits
outside the measured bar above its top edge.

## Fullscreen presentation

The compact player also has a curved hover mound that follows the mouse, with an up arrow at its crest. It starts small and grows smoothly as the pointer approaches the top edge, reaching full height at the mound. Clicking the mound opens fullscreen; dragging it reveals the fullscreen player directly. Release distance and recent pointer velocity determine whether it settles open or returns to compact. The fullscreen nav accepts downward drags without a hover nudge or arrow. The compact title fades out before the station name and close control fade in, with a brief gap between labels; pulling down reverses that sequence. Pulling down reverses the gesture; X slides down and the fullscreen button slides up. Empty compact-player space also accepts upward drags, excluding text and interactive controls. Reduced motion disables the settling animation. Pointer tracking applies to the player surface; the cross-origin Mixcloud iframe does not forward pointer movement.

Both expand controls switch local presentation state to fullscreen; the close
button restores compact presentation. Activating the fullscreen show
link uses the immediate-close path and releases scroll locking synchronously before client navigation while playback continues. The X button retains its animated dismissal. During phone dismissal, the existing widget stays anchored above the bottom safe area while the fullscreen panel moves down, avoiding an empty bar before the compact layout returns. The mobile expand button is also visible in its compact position during dismissal. The same player container becomes fixed
and fills the viewport with the miniplayer background, a station header and a close SVG.
Compact metadata and actions are hidden. The existing iframe stays mounted in
its original position in the React tree: across the viewport bottom at every screen width.

Fullscreen uses flexbox stacks: a station/close header, a large linked show title,
then artwork with a playlist save control beneath it. The title spans the full header
width; only the artwork/tracklist row has a centered width cap. When a tracklist is available,
it sits beside the artwork; without one, artwork and its save control are centered.
Above 750px, shows with tracklists use a single static title line that shrinks to
fit the available width. Desktop titles have extra space above the artwork row. Without a
tracklist, three edge-to-edge staggered marquee rows replace the static title and extend behind
the artwork, repeating the title in white and two progressively darker grays.
Pausing restores the single fitted title; playback crossfades it into the marquee
over two seconds. The rows move
only while playback is active, fading in on playback and fading out on pause.
They retain their animation position while paused. Desktop content is
vertically centered when it fits, and remains scrollable when taller. Animated
rows reduce from three to two, one and zero at viewport heights of 750px, 600px
and 400px respectively. Decorative repeats are hidden
from assistive technology, and reduced motion stops the marquee.
At 750px and below, content stacks as artwork, title, save control, then tracklist. Artwork stays square without cropping,
and long titles and tracks wrap. The content scrolls independently above the bottom
widget, with safe-area space reserved. Tags and DJ portraits are omitted.

The fullscreen detail component initializes and subscribes to the existing show-detail
store, so cached and delayed tracklists update the current show. Songs render as
artist — song and chapters retain their text. Detail failures offer a retry without
interrupting playback. The shared playlist control shows an outline bookmark when
unsaved and a filled bookmark with playlist names when saved; it opens the existing
playlist modal. The iframe retains its original React parent in both presentations.

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
