# Page search implementation

Mode: chunked. Stop for review after each chunk. Structure approval requires a
separate scaffolding request before advancing, per the development workflow.

## Decisions

- Search Shows, DJs, Explore, and playlist detail; no global search.
- Each pane owns its query and supplies its dataset and stringify function.
- SearchBar owns accessible input presentation; filterSearch owns matching.
- Search titles only: show titles, DJ names, and tag titles.
- Trim queries and match case-insensitive substrings. Empty queries return the
  original dataset. Preserve object references and input ordering.
- Normal document flow below tabs or above playlist entries. Defer compression.
- No new dependency, search store, fuzzy matching, or relevance ranking.

## Chunks

- [x] 1. Create empty SearchBar.tsx, SearchBar.module.css, filterSearch.ts, and
  tests/search.test.ts. Structure approved.
- [x] 2. Define controlled SearchBar props (value, onChange) and generic
  filterSearch<T>(items: readonly T[], query: string, stringify: (item: T) => string):
  readonly T[]. Keep unfinished code disconnected from working pages.
- [x] 3. Implement SearchBar: accessible label, SEARCH... placeholder, transparent
  background, 2px black border, visible keyboard focus.
- [x] 4. Place SearchBar in all four panes with local query state. Hydrate DJs and
  Explore using existing props. Leave filtering disconnected for placement review.
- [x] 5. Implement shared filtering and focused tests for empty/whitespace queries,
  trimming, case, substrings, no matches, ordering, references, and selected fields.
- [ ] 6. Integrate Shows: filter complete initialized catalog in showIds order
  before pagination, retain batches of 20 and initial server-rendered cards, reset
  on query changes, retain loading/retry, prevent stale observer appends, and save
  query in Back/Forward snapshots. Verify matches beyond initial cards, pagination,
  clearing, initialization failure, and history restoration.
- [ ] 7. Integrate DJs by name, preserving order and links. Verify hydration,
  matching, no matches, and clearing.
- [ ] 8. Integrate Explore by tag title, preserving popularity order and navigation.
  Verify matching, ordering, no matches, and clearing.
- [ ] 9. Integrate playlist resolved rows by show title, retaining notes, playback,
  and edit actions. Unavailable shows appear with empty query and do not match
  nonempty queries. Never mutate stored entries. Verify scope and editing results.
- [ ] 10. Run prescribed checks and focused browser verification; update the
  authoritative architecture reference. Review remaining limitations.

## Integration boundaries

Existing ShowsPane, DJsPane, ExplorePane, and playlist detail own integration.
DJ and Explore Astro shells need hydration. Stores retain existing responsibilities.
No cross-island event bridge. Main risk: Shows pagination and navigation snapshots.

## Next action

Review shared filtering and its focused tests, then integrate Shows in chunk 6.
All four panes have controlled inputs; filtering remains disconnected. Each page
shell explicitly imports search CSS so ClientRouter swaps and manual Shows
history mounts retain styles. Focus thickens the existing border without an
outer outline or layout shift.
