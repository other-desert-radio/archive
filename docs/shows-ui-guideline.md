# Shows archive: UI and implementation guideline

This document is the durable handoff for agents implementing the SHOWS archive
without Figma access. It specifies the screen below the existing navigation
and category tabs. It is a design and implementation guide, not a claim that
these components or behaviors have already been built.

## Sources and authority

- [Figma: Other Desert Radio, Customer Page - Shows](https://www.figma.com/design/BzM2IkYW1taFeepxrz8ue0/Other-Desert-Radio?node-id=18-2585), node `18:2585`.
- One targeted MCP `get_design_context` read on September 23, 2026 returned
  reference markup, measurements, and a screenshot. No other Figma reads were
  used. Avoid spending additional MCP quota to recover information recorded here.
- User screenshot 1: default listing, both filter menus closed.
- User screenshot 2: TAGS menu open, unchecked options, overlaying the list.
- User screenshot 3: active `world` filter chip; matching show tags stay vivid
  while the other tag on each result is visually subdued.
- Explicit user requirements: the scrolling list is React; each show card is
  its own component; clicking a thumbnail requests miniplayer playback;
  implementing the miniplayer is out of scope. Navigation and category tabs
  already exist.

“Observed” below means visible in those sources. “Proposed” means a concrete
implementation default where the supplied design does not establish behavior.
User requirements take precedence over decorative details in the mockup.
Screenshots are described here in words; their temporary clipboard paths are
not durable repository assets. Figma asset URLs also expire and are not an
asset source to hardcode in production.

## Current implementation status

Cards, build-time JSON validation, detail routes, a hydrated `ShowsPane`, and
store-backed miniplayer playback are implemented. Search, structured filters
and date sorting remain proposals. Exact data/props are owned by `src/utils/`
and the components; the model below is illustrative, not a replacement schema.
The original implementation sequence is historical, not an active task plan.

## Existing repository boundaries

`src/pages/index.astro` is the SHOWS route and renders `ShowsPane`
after `CategoryTabs`. `BaseLayout.astro` supplies the navigation, shared main
container, CSS, and Astro `ClientRouter`. `CategoryTabs.astro` already supports
SHOWS and DJs; `src/pages/djs.astro` is the DJ listing route.

Reuse those components, the Space Mono fonts in `public/fonts/`, and the
existing textured `public/background.jpeg`. The background is already applied
globally. The supplied Figma frame includes HISTORY, while screenshot 2 and
the existing category component contain only SHOWS and DJs. Do not infer a
new HISTORY route from this reference.

The site is static Astro with React already configured. Backend-generated
JSON in `src/res/` is validated at build time by `src/utils/`. Preserve
static hosting and base-path-aware URLs. This guide does not introduce routes,
dependencies, a data service, or a playback implementation.

Use [the documentation index](INDEX.md) to select standards for the changed
boundary; do not load unrelated references.

## Visual structure

The visual language is monochrome, heavy square borders, generous spacing,
large monospaced text, bright rectangular tag labels, and a pale mottled paper
background. There are no rounded card shells or large white panels behind
individual shows. The texture remains visible between and behind card text.

Desktop reading order:

1. Existing black navigation bar and existing category tabs.
2. One horizontal toolbar: a long SEARCH... input, TAGS disclosure, DJ disclosure.
3. A second row: DATE sort button followed by any removable filter chips.
4. A vertical list of shows, inset farther than the toolbar. Each show has
   artwork at left and title, tags, date, and DJ identity at right.

The list continues below the viewport; the second show is partially visible
in the reference. There is no visible pagination, carousel, internal scrollbar,
or sticky toolbar. Proposed default: normal document scrolling, with no fixed
height scroll container and no automatic infinite loading.

### Desktop measurements from MCP

These are design pixels in the 1412px-wide reference, not measurements of the
rescaled user screenshots. Use them as desktop targets, then translate to
normal CSS grid/flex flow and responsive dimensions. Do not copy the generated
absolute positioning or install Tailwind to reproduce its reference markup.

| Element | Reference geometry / typography |
| --- | --- |
| Existing navigation | 74px high; 18px Space Mono; black background, white text |
| Existing categories | 42px text; active SHOWS bold with heavy underline |
| Toolbar | Starts x=114, y=227; right edge approximately x=1297 |
| Search input | 900 × 51px; 5px black border; 28px regular text |
| TAGS trigger | 148 × 51px; x=1028; 5px border; 28px text |
| DJ trigger | 101 × 51px; x=1196; 5px border; 28px text |
| DATE button | 148 × 51px; x=114, y=291; white fill; 5px border |
| Show row | x=199; approximately 1013px wide; first origin y=355, second y=769 |
| Artwork | Approximately 330 × 354px; aspect ratio 395:424; 4px black border; first top y=375 |
| Text column | Approximately x=581, leaving about 52px after the artwork |
| Show title | 48px regular Space Mono; normal line height; wraps across three lines in sample |
| Tags | 20px regular; about 45px high; 3px black borders |
| Date | 24px bold; right aligned in the metadata row |
| DJ badge | Approximately 274 × 62px; 4px border; hard shadow -3px 4px black |
| DJ avatar / name | Approximately 46px square avatar; 24px bold name |

The first row's tags start around y=582 and DJ badge around y=646. Row origins
are 414px apart, leaving approximately 60px between artwork rectangles. Long
content must increase row height naturally rather than overlap the next row.
The existing shell has its own sizes and padding; these reference measurements
do not authorize restyling the completed shell in the listing implementation.

### Color and texture

| Tag | Color evidence |
| --- | --- |
| world | Exact MCP fill `#6e57ff` |
| experimental | Exact MCP fill `#ff03d1` |
| narrative | Pale yellow, screenshot only |
| remix | Vivid red-orange, screenshot only |
| disco | Purple, screenshot only |
| dance | Mint green, screenshot only |
| house | Light cyan-blue, screenshot only |
| trip | Warm orange, screenshot only |

Use one shared tag color mapping so menu options, active chips, and card tags
agree. Exact colors for screenshot-only tags are unconfirmed; any chosen hex
values are implementation approximations. These labels are examples, not an
exhaustive taxonomy. Unknown tags need a readable neutral fallback. Controls
have square corners. Search is transparent over the texture; DATE and the
open dropdown panel are white. Closed TAGS and DJ backgrounds appear light;
use the reference's transparent treatment unless readability requires a fill.

## Search, filters, and sorting

### Text search

Observed: a large input labelled visually by the placeholder `SEARCH...`.
No submit button or separate advanced-search controls are shown.

Proposed behavior:

- Use a controlled `type="search"` input with an accessible name such as
  “Search shows, DJs, and tags”; the placeholder is not its only label.
- Search show titles, associated DJ display names, and associated tag labels.
  `Justin`, `world`, and `#22` should each find the relevant sample show.
- Trim the query, collapse repeated whitespace, and match case-insensitively.
  Normalize diacritics for search so `Mlo` can match `Mlö`, while preserving
  original display text. Treat punctuation literally; do not evaluate regex.
- Split on whitespace. Every query token must occur somewhere in the combined
  searchable fields; tokens may match different fields. This allows
  `Justin world` to match a show by Justin with the world tag.
- Update local results on input without requiring Enter. Prevent form submission
  from navigating. Clearing text retains chosen tags, DJs, and sort order.
- Free text constrains structured filters further; typing `world` does not
  automatically create a selected-tag chip.

### TAGS disclosure

Observed: the closed trigger reads `TAGS` with a solid downward triangle.
When open, the triangle points upward. A white panel with a thick black border
opens directly below it, right aligned with the trigger and wider than it,
extending left over the content. The panel overlays the show title and date
without moving any rows. Screenshot 2 shows, from top to bottom: world,
narrative, remix, disco, dance, house, trip. Each row has an empty square checkbox
at left and a colored, black-bordered label at right. Experimental is visible
on cards but not in that captured menu; do not conclude it is unfilterable.

Proposed behavior:

- Use a multi-select checkbox group derived from the complete tag catalog.
  Selecting a checkbox applies immediately; keep the panel open for more picks.
- Clicking the trigger again, clicking outside, or pressing Escape closes it.
  Opening DJ closes TAGS. Selection survives dismissal and reopening.
- Checkbox and label form one labelled input, with the entire option row a
  comfortable click target. Checked state must remain visible independent of color.
- Keep all catalog options available when results narrow, so filtering does
  not hide selected options or prevent a broader selection.
- Constrain long panels to the viewport with internal overflow scrolling;
  prevent clipping by parent overflow and keep them above cards.

### DJ disclosure

Observed: a `DJ` trigger with the same heavy outline and downward triangle.
No supplied screenshot shows its open panel.

Proposed: mirror the TAGS disclosure behavior using multi-select checkboxes
with DJ names and optional small avatars. Use stable DJ IDs for selection;
names are labels, not identifiers. Derive options from the full DJ catalog.
Do not introduce a second search field inside the dropdown unless catalog
size makes it necessary. DJ names in this menu select filters; DJ badges in
cards navigate to the DJ's page.

### Matching rules

These rules are proposed because screenshots do not establish multi-selection
semantics. Implement them consistently in a pure selector function:

```text
visible(show) = textMatches(show, query)
             AND (no selected tags OR show has ANY selected tag)
             AND (no selected DJs OR show has ANY selected DJ)
```

Selections within one group use OR; the text, tag, and DJ groups use AND.
For example, world + disco returns shows with either tag. Adding Justin as a
DJ restricts that union to Justin's shows. Multiple hosts on a show are allowed.
Empty groups impose no restriction. Filtering precedes sorting and any future
result windowing; never filter just the currently rendered subset.

### Active chips and tag emphasis

Observed: screenshot 3 shows `DATE ↑` followed by a purple `world x` chip on
the second toolbar row. Cards retain both world and experimental tags; world
is vivid while experimental has muted text, border, and fill. The shows are
still visible because they match world.

Proposed: render one removable chip per selected tag and DJ, in selection
order within each group. Tags keep their catalog colors; DJ chips use neutral
styling and a clear DJ label. Clicking a chip's removal button clears only that
selection and updates its menu checkbox. Chips wrap onto extra lines and push
the list down. Give each removal button a name such as “Remove world filter”.

When no tag filter is selected, all card tags use normal colors. When tags
are selected, emphasize matching tags and subdue other tags while keeping
their text readable. Muted tags are not disabled and must not use a disabled
HTML attribute. Proposed shortcut: clicking a card tag toggles that tag in
the shared filter state, using a button with `aria-pressed`. Do not let this
action trigger playback or show-page navigation.

### Date order

Observed: `DATE ↑` accompanies May 25, 2026 above May 11, 2026, so the pictured
default is newest first despite an upward arrow sometimes implying ascending.
DATE is a sort toggle, not a date range filter or calendar.

Proposed: model `newest` and `oldest` explicitly. Preserve `↑` for newest to
match the reference and use `↓` for oldest. Use an accessible label describing
both current order and the action, such as “Newest first; sort oldest first”.
Sort by normalized date values, never formatted strings; break ties by stable
show ID. Put undated entries last in both directions and display “Date unknown”.
Format dates as `May 25, 2026`, taking care not to shift a date-only value into
the previous day through local time conversion. Sort does not clear filters.

## ShowCard anatomy and actions

Each list item contains its own `ShowCard` React component. Use semantic
`article` markup with a heading and independent controls; the entire card
must not be a button or wrap nested buttons in an anchor.

- **Artwork / playback:** tall, nearly square artwork with a black border.
  The reference includes a dark translucent title/creator strip near the top,
  a centered translucent circular play control with a white triangle, and
  Mixcloud branding at bottom left. These appear inside the supplied image
  asset in the MCP output; they are not evidence of multiple live embeds.
  Use actual show artwork with one playback button. If source artwork already
  includes those overlays, do not duplicate them. Do not fabricate interactive
  Mixcloud controls or load an iframe per result. Preserve the reference crop
  when matching its assets; prevent distortion for other artwork.
- **Title:** large regular-weight text, left aligned and fully wrapping.
  Sample: `From the Mixed-Up Files of Axaxaxas Mlö #22`, with #21 on the next
  card. Do not insert fixed line breaks or truncate to the sample's height.
  Existing site intent gives shows detail pages: the title should link to
  a supplied detail URL when one exists. Do not invent an unbuilt route.
- **Tags and date:** tags form a wrapping row beneath the title; the bold date
  aligns to the right of that row on desktop. Allow the date onto another line
  when necessary. Use `<time dateTime="...">` for valid dates.
- **DJ badge:** below the tags, a compact bordered rectangle with a hard black
  offset shadow, small square avatar at left, and bold name. The sample is
  Justin Paszul with a colorful illustrated avatar. Link to a supplied DJ
  detail URL; the current `/djs` listing is not itself a DJ detail route.
  Multiple DJs should produce wrapping badges rather than lose attribution.

The sample #22 artwork is muted olive-gray with handwritten material inside
a white oval; #21 is tan with a cream oval containing writing. Both have
Justin Paszul and show information along the bottom. These are reference
content, not titles, colors, avatars, or dates to hardcode into the component.

### Original playback handoff proposal (superseded)

Current playback uses the shared audio store and validated Mixcloud keys; see
[Architecture](architecture.md#request-and-rendering-flow). The following records
the original callback proposal, not the current card contract.

Thumbnail click or keyboard activation calls `onPlay(show)` exactly once.
The parent passes an adapter to the future shared player boundary. It must
carry a stable show ID and playable Mixcloud URL, plus metadata for display.
It does not navigate, create an inline player, automatically play the next
show, or own global playback state. Filtering or sorting alone never plays.

For this exercise, verify the callback with a spy or development adapter.
Do not claim playback is working until the miniplayer is integrated. Missing
playback URLs need an explicitly unavailable control and explanatory text;
missing imagery needs a stable-size fallback without removing valid playback.
Future player state should live outside cards and the listing so it can
persist across page navigation as described in [Architecture](architecture.md).

## Proposed React boundary and contracts

Use one hydrated React island below `CategoryTabs`, containing filters and the
scrolling list. Its React children share one filter state. Avoid one Astro
island per card. With `client:load`, Astro can render the initial React HTML
and hydrate its interactive behavior; pass serializable data from Astro and
create callback functions inside React. See the official
[Astro framework component guidance](https://docs.astro.build/en/guides/framework-components/).

Suggested decomposition for future filtering work (some responsibilities
already exist in `ShowsPane` and `ShowCard`; do not rename them solely to match):

| Component / module | Responsibility |
| --- | --- |
| `ShowsArchive.tsx` | Island root; query, selections, order, open disclosure, data state, playback adapter |
| `ShowFilters.tsx` | Search, both disclosures, DATE, and active chips; controlled props |
| `ShowsList.tsx` | React list semantics, stable show-ID keys, result/empty presentation |
| `ShowCard.tsx` | One show's presentation and independent play, tag, and navigation actions |
| `TagBadge.tsx` | Shared tag appearance; interactive semantics at the appropriate call site |
| Pure filter/sort helper | Normalization and deterministic visible-show selection |

Extract a shared disclosure only when it removes real duplication. Use
project CSS conventions and shared variables for border widths and tag colors.
The following is an internal normalized model proposal, not the backend JSON
schema. Validate incoming JSON at its boundary and adapt it to this shape.

```ts
type Tag = { id: string; label: string; color?: string };
type DJ = {
  id: string;
  name: string;
  avatarUrl?: string;
  detailUrl?: string;
};
type Show = {
  id: string;
  title: string;
  broadcastDate?: string; // Validated YYYY-MM-DD; retain date-only meaning.
  artworkUrl?: string;
  mixcloudUrl?: string;
  detailUrl?: string;
  tagIds: string[];
  djIds: string[];
};
type ShowFilters = {
  query: string;
  tagIds: string[];
  djIds: string[];
  order: "newest" | "oldest";
};
type OpenFilter = "none" | "tags" | "djs";
type ArchiveData = { shows: Show[]; tags: Tag[]; djs: DJ[] };
type ArchiveState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ArchiveData };
type ShowCardProps = {
  show: Show;
  tags: Tag[]; // Resolved tags for this show.
  djs: DJ[]; // Resolved DJs for this show.
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onPlay: (show: Show) => void;
};
```

Keep filtered results derived from data and filters, rather than a second
independently mutable state. Normalize missing external values to `undefined`.
Resolve missing tag/DJ references explicitly at the data boundary; do not
crash a card through an unchecked cast. Deduplicate shows by stable ID.

Prefer initial build-supplied data when practical. If data must be fetched
from static JSON, distinguish loading, fetch failure with retry, an empty
archive, and zero matches. Zero matches should offer clearing search/filters
while preserving the user's state until they choose that action. Do not show
“no shows” during loading or failure. Defer virtualization, extra libraries,
and pagination until actual dataset size justifies them; lazy-load offscreen
artwork and reserve image dimensions to avoid layout jumps.

Optional later enhancement: encode query, selected IDs, and order in URL
search parameters for shareable searches and Back restoration. This is not
shown in Figma and is a separate reviewable chunk. Ordinary re-renders and
menu dismissal must preserve state regardless of URL support.

## Responsive and accessible behavior

Only desktop references were supplied; these are proposed responsive defaults.
Let the search fill available width on desktop while TAGS/DJ retain readable
sizes. On narrow screens move search to a full-width row, wrap controls and
chips, then stack artwork above show details. Keep artwork within the viewport,
scale large headings with a bounded responsive size, and let tags, date, and
DJ badges wrap. Choose breakpoints based on content fit, not the screenshot's
fixed coordinates, reusing the established breakpoints in
[css.md](css.md). Do not introduce new query numbers.
The existing shell's padding may require a separately
reviewed adjustment if it prevents a usable mobile listing.

Use real labelled inputs and buttons, visible keyboard focus, and at least
44px comfortable touch targets. Disclosure triggers expose `aria-expanded`
and `aria-controls`; panels contain labelled checkbox groups, not ARIA menus
whose keyboard model would conflict with ordinary form inputs. Escape returns
focus to the trigger; outside-click dismissal must not steal focus from the
clicked target. Do not trap keyboard focus in a nonmodal filter panel.

Give the playback button an accessible name such as “Play From the Mixed-Up
Files of Axaxaxas Mlö #22”. Images duplicating adjacent accessible names may
use empty alt text. Use a polite result-count announcement after filter changes
without announcing every card or moving focus out of the search box. Maintain
text contrast even for subdued tags, and make checkmarks/removal controls
understandable without color. No mobile-specific layout or selected checkbox
artwork should be described as Figma-verified.

## Implementation chunks and acceptance checks

Follow the selected mode in [Workflow](development-workflow.md#development-modes). The original
sequence below is historical; cards, data and playback now exist. Use a task
plan for remaining work rather than treating this list as current progress.

1. **Card and list:** normalized representative fixture data, reusable React
   card, scrolling list, responsive CSS, and the playback callback boundary.
   Verify long titles, multiple DJs/tags, missing artwork, and exactly one
   callback per thumbnail activation. No embedded miniplayer.
2. **Search and date:** shared state plus pure text matching and sorting.
   Verify title/DJ/tag queries, case/diacritic normalization, blank queries,
   date-only formatting, equal-date stability, and both date orders.
3. **Structured filters:** disclosures, checkboxes, chips, tag shortcuts, and
   selected-tag emphasis. Verify OR within groups, AND across groups, removal
   synchronization, preserved selections, zero matches, and keyboard dismissal.
4. **Real data adapter:** validate the agreed JSON schema, handle fetch states
   if needed, and verify base-path URLs and realistic archive size. Add URL
   persistence or result windowing only as separate justified follow-ups.

Visual acceptance should reproduce all three supplied states: closed default,
open TAGS overlay, and active world chip with experimental subdued. At the
1412px reference width, check toolbar proportions, artwork ratio, title scale,
metadata alignment, square borders, tag colors, and DJ shadow. Also check a
narrow phone width and enlarged text for overflow and usable controls.

Use meaningful focused behavior tests for filtering and the playback handoff;
inspect layout in the browser. Future code chunks should run the relevant
`bun run lint`, `bun run check`, and `bun run build` checks specified by
[development-workflow.md](development-workflow.md). Start any dev server using
the required background workflow. Documentation-only changes do not require
starting a server or asserting that an unbuilt screen has passed UI tests.

## Remaining decisions not established by the design

The open DJ panel, multi-select logic, card-tag shortcuts, search normalization,
mobile layout, and unavailable-data states use the proposed defaults above.
Exact screenshot-only tag colors and open-panel/mobile design evidence remain
unconfirmed. Data contracts, artwork paths, detail URLs and playback now have
source implementations; reconcile changes at those boundaries. Do not spend Figma quota or expand
scope merely to settle details for which this guide provides a usable default.
