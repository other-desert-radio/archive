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

Category tabs and navigation items wrap naturally when their combined widths
exceed the available space. Keep each tab and the return link together, and
allow the navigation title to wrap within its own line on tiny screens.
Navigation vertical padding belongs to the return link and title text only.
The shared sticky header contains the navigation followed by a full-width
miniplayer bar using `--miniplayer-background` (#25292C). The bar has no minimum height and collapses completely while idle;
only the active player supplies the widget height. Selected titles align with navigation text;
the iframe sits flush right with a maximum width of 40rem. The title has a
20rem minimum width capped at 100%, so controls wrap before the title becomes
a narrow column. At 750px and below,
title and widget stack to fit narrow screens without horizontal overflow.
