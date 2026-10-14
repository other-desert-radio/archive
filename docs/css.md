# CSS conventions

- Put shared CSS variables in `src/styles/styles.css` and reuse them across
  components.
- Use `rem` for spacing, typography, and component sizing. Keep the viewport
  breakpoints below in `px`.
- Build highly responsive layouts: adapt to available width, let text and
  controls wrap, and avoid horizontal overflow. Verify narrow phones through
  wide desktops.
- Prefer bounded fluid sizes with `clamp()` and percentage widths over fixed
  sizes at every breakpoint. Cap images at their container width; avoid fixed
  flex bases that become heights when a row stacks into a column.
- Keep wide listing grids aligned with the category tabs; avoid an additional
  width cap or side inset within the shared page container.
- Bottom page spacing belongs to `BaseLayout`'s main container, which adds
  `--container-grid-padding-bottom` and the bottom safe-area inset. Listing
  components must not duplicate that padding.

## Breakpoints

Reuse these viewport widths in CSS media queries. Do not invent new breakpoint
numbers or convert them to nearby `rem` values.

| Size | Breakpoint |
| --- | --- |
| Small phone | `400px` |
| Phone | `600px` |
| Tablet | `750px` |
| Small desktop | `1023px` |
| Large desktop | `1600px` |
| Extra-large desktop | `1800px` |

Use `min-width` for styles at and above a breakpoint, and `max-width` for styles
at and below it.

## Responsive density

Shared presentation tokens live in `src/styles/styles.css`. Keep the root
font size at `100%`; use `--density-unit` and the semantic typography, spacing,
artwork, and border tokens for visible sizes. The density unit is `0.8rem`
through 1600px, grows fluidly between 1600px and 1800px, and is `1rem` at
1800px and above. This approximates an 80% presentation on laptops while
preserving browser font preferences and the existing wide-screen sizes.
Container width caps remain unscaled to preserve large-screen alignment.

Show listings use two columns from 1023px. DJ listings retain two columns
above 1023px and three from 1800px. Phone stacking and title reductions remain
in place. Shared detail classes keep show and DJ artwork, gaps, and wrapping
consistent. Verify these layouts in the browser, including long names and
tags, at 320px, 332px, 750px, 1440px, and wide desktop widths.

Category tabs stay on one row, with smaller fluid text, reduced gaps and no
extra inline padding at 750px and below. They spread across the available width
at 600px and below and form a left-aligned group on larger screens.
Navigation items wrap naturally when
their combined widths exceed the available space. Keep the return link together, and
allow the navigation title to wrap within its own line on tiny screens.
Hover effects are limited to `(hover: hover) and (pointer: fine)`; links and
buttons use `touch-action: manipulation` to avoid waiting for double taps.
The shared layout renders a decorative fixed background layer at z-index 0,
with page content above it. Its height is `100dvh` (`100vh` fallback), so it
tracks the visible viewport as mobile browser controls expand or collapse.
The root canvas uses the same image, and `viewport-fit=cover` allows it to
extend into safe areas; keep safe-area padding on content, not the image.
Use neither fixed background attachment nor a negative-z-index pseudo-element.
Navigation vertical padding belongs to the return link and title text only.
The shared sticky header contains the navigation followed by a full-width
miniplayer bar using `--miniplayer-background` (#25292C). The bar has no minimum height and collapses completely while idle;
only the active player supplies the widget height. Selected metadata aligns with navigation
text. Above 600px, individually linked DJ names precede a decorative divider and
the linked show title. Metadata stays on one line with ellipsis, alongside the
iframe with a maximum width of 40rem. Shows without DJs omit the divider.
At 600px and below, the plain show title and widget stack.
At 600px and below, the miniplayer bar is fixed to the viewport bottom while
navigation stays at the top. Its background extends to the bottom edge, with
safe-area padding inside the active bar. The title remains visible. A
border-box resize observer publishes the full bar height as
`--miniplayer-height`; `BaseLayout` reserves that height in its main padding,
using the bottom safe-area inset when the player is idle. The existing player
stays mounted inside the header to preserve its iframe across navigation.
