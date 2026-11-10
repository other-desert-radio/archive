# Page search implementation

Status: completed. Current behavior is documented in [Architecture](../../architecture.md).

## Decisions

- Search Shows, DJs, Explore, and playlist detail; no global search.
- Each pane owns its query and supplies its dataset and stringify function.
- SearchBar owns accessible input presentation; filterSearch owns matching.
- Search shows by title, DJ names, and date; DJs by name; Explore by tag title;
  playlist entries by show title and user note.
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
- [x] 6. Integrate Shows: filter complete initialized catalog in showIds order
  before pagination, retain batches of 20 and initial server-rendered cards, reset
  on query changes, retain loading/retry, prevent stale observer appends, and save
  query in Back/Forward snapshots. Verify matches beyond initial cards, pagination,
  clearing, initialization failure, and history restoration.
- [x] 7. Integrate DJs by name, preserving order and links. Verify hydration,
  matching, no matches, and clearing.
- [x] 8. Integrate Explore by tag title, preserving popularity order and navigation.
  Verify matching, ordering, no matches, and clearing.
- [x] 9. Integrate playlist rows by show title and user note, preserving playback
  and edit actions. Unavailable shows can match notes. Never mutate stored entries.
- [x] 10. Run prescribed checks and focused browser verification; update the
  authoritative architecture reference. Review remaining limitations.

## Integration boundaries

Existing ShowsPane, DJsPane, ExplorePane, and playlist detail own integration.
DJ and Explore Astro shells need hydration. Stores retain existing responsibilities.
No cross-island event bridge. Main risk: Shows pagination and navigation snapshots.

## Verification and follow-up

- All 249 unit tests, lint, Astro check, build, documentation checks, and transfer
  budgets pass. Shows pagination/history and focused search navigation regressions pass.
- Explore links remain static; only the input hydrates. Its HTML is 13.1 KiB gzip,
  down from 24.2 KiB with duplicated hydration data, within the original 14 KiB budget.
- DJ props omit undisplayed tags; its HTML is 15.5 KiB gzip. Updated DJ and combined
  JS budgets account for the new search behavior after inspecting payloads.
- Detail visits retain queries; category-tab navigation clears them. iOS focus
  zoom prevention uses a minimum 16px input font on touch devices; physical iOS
  behavior and the full mobile timing suite were not rechecked.
- Future work: [tag service](../future/tag-service.md). Scroll compression remains deferred.
