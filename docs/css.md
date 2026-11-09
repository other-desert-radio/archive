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
- `BaseLayout` constrains main width; content owns horizontal spacing through
  `.page-inset`. Horizontal card rows use `.gutter-scroll` for internal padding
  so cards can scroll through both gutters while preserving first/last alignment.
  Both reuse safe-area-aware `--page-inset-left` and `--page-inset-right` tokens.
  Rows normally stay within the centered main container on screens wider than
  its cap. History and tag details use a full-width main: `.page-inset` keeps
  tabs, headings and ordinary content capped, while scrolling rows reach both
  device edges. Their internal padding includes the centered content offset so
  end cards still align with the headings.
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
in place. DJ detail artwork uses a bounded fluid column at 40% of the available
width, with a single-column layout at 600px and below. Verify these layouts in the browser, including long names and
tags, at 320px, 332px, 750px, 1440px, and wide desktop widths.

Category tabs stay on one row, with smaller fluid text, reduced gaps and no
extra inline padding at 750px and below. They spread across the available width
at 600px and below and form a left-aligned group on larger screens.
`--tabs-compression-scroll-px` in `src/styles/styles.css` controls the document
scroll distance in CSS pixels from expanded tabs to fully compact (a bare number,
currently `40`). Increasing it makes compression take more scrolling; decreasing
it reaches the compact state sooner. Progress clamps at the endpoint and reverses
when scrolling back up. Beside it, `--tabs-ease-out-power` controls the curve:
`1` is linear, `2` is a gentle ease-out (75% compressed halfway through the scroll
distance), and `3` is stronger (87.5% halfway through). Keep it at least `1`.
Browsers supporting scroll timelines, animation ranges, typed custom properties
and CSS exponential math use native `animation-timeline: scroll(root block)`.
Registered progress drives the existing styling without JavaScript scroll
listeners. Colors follow scroll directly, with no trailing timed transition.
The JavaScript fallback reads the same distance and curve tokens. Its black
background follows eased progress with 120ms smoothing.
`fastScrollPxPerMs` in `CategoryTabs.astro` controls its fling threshold in CSS pixels per
millisecond. Fast scrolling skips color transitions and snaps to the endpoint
in the scroll direction inside the compression zone. Hold that endpoint until
direction reverses or scrolling leaves the zone; upward scrolling farther down
the page stays compact. Skip unchanged progress after compression finishes.
The fallback's fully expanded endpoint clears color transitions immediately, and unchanged
settling frames retain the fast-scroll bypass to avoid a delayed fade on iOS.
The text and active underline switch to white at 50% opacity so they
remain fully opaque and readable. Reduced motion shows static compact
tabs immediately. The sticky header reserves the expanded tab height to keep
document geometry stable and lets clicks through the transparent remainder.
Compression also reduces title-row bottom padding to leave approximately `1.5rem`
between the title text and compact tab text when the desktop player row is absent.
Tune this with `--tabs-title-gap` in `Navigation.astro`.
Navigation items wrap naturally when
their combined widths exceed the available space. Keep the return link together, and
allow the navigation title to wrap within its own line on tiny screens.
Hover effects are limited to `(hover: hover) and (pointer: fine)`; links and
buttons use `touch-action: manipulation` to avoid waiting for double taps.
The shared layout renders a decorative fixed background layer at z-index 0,
with page content above it. Its height is `100dvh` (`100vh` fallback), so it
tracks the visible viewport as mobile browser controls expand or collapse.
Both layers tile `background2.avif` at its native size, switching to the 90°
clockwise-rotated `background2-vertical.avif` at 600px and below. The root canvas uses
the same image, and `viewport-fit=cover` allows it to
extend into safe areas; keep safe-area padding on content, not the image.
Use neither fixed background attachment nor a negative-z-index pseudo-element.
Navigation vertical padding belongs to the return link and title text only.

Player-specific layout and iframe persistence are documented in
[Miniplayer](miniplayer.md).
