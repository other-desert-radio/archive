# Archive catalog, playlists, history, and local storage intent

Conversation outcomes, 2026-10-29. Use this reference when the user mentions the terms below. **This records design intent, not implemented behavior or authorization to build.** The user requested examples and discussion, then explicitly clarified not to implement the feature.

The original [IndexedDB notes](human/index-db.md) remain human-maintained. This document replaces the earlier client-storage review.

## User goals and constraints

- Expect **600+ shows**, rather than designing only around the current sample catalog.
- Stay on **GitHub Pages with no application server** or live database connection.
- Prioritize mobile download size, memory, responsiveness, and browser compatibility.
- Add search to Shows, DJs, and Explore, plus **pagination on Shows**.
- Introduce a shared **ShowStore**. Avoid fetching or reconstructing the full catalog on every page visit.
- Persist personal playlists, playback history, resume state, and search history locally; these are core design topics alongside catalog search.
- Keep descriptions and proposals concise and easy to scan.

## Terms and intended meanings

| Term | Meaning in this discussion |
| --- | --- |
| Catalog | Public show metadata, with related DJs and tags; not audio files |
| ShowStore | Shared browser catalog state, initialization, show lookup, and search |
| In-memory search | Search precomputed text using JavaScript objects/strings already loaded in this tab |
| Pagination | Search the full catalog, then render only the active page of matches |
| IndexedDB | Browser-local structured storage for personal data and, optionally, a persistent catalog cache |
| Hybrid approach | Persist catalog records in IndexedDB, read them into shared memory once, then search memory |
| `data_versions.json` | Small static manifest identifying revisions of exported datasets |
| Static JSON endpoint | An Astro route executed at build time to emit a JSON file; no runtime server |
| Initialization | One shared catalog load, reused across internal navigation; concurrent callers share the pending load |

## Search scope

| Screen | Search fields |
| --- | --- |
| Shows | Show title, associated DJ names, associated tag names |
| DJs | DJ name and associated tag names |
| Explore | Tag names only |

The user described Shows search as “any text on a show,” specifically title, tags, and DJ name. Biographies, URLs, dates, and user notes were not explicitly included.

Suggested matching behavior, **not yet a confirmed product rule**: trim whitespace, ignore case, fold accents, and require every query word to appear somewhere across the allowed fields. Normalize searchable text once per catalog snapshot, not on every keystroke. Preserve original text for display.

## ShowStore boundaries

Proposed responsibilities:

- Own the full show catalog and one precomputed search representation.
- Initialize lazily when first needed, sharing one pending load between callers.
- Reuse initialized data across Shows, History, and other internal navigation.
- Provide `initialize()`, `getShow(id)`, and `search(query)` or equivalent APIs.
- Permit retry after failed initialization; notify subscribers when the catalog changes.
- Integrate with the existing `createStores()` and store subscription patterns rather than creating a new instance per page.

**No `getTags()` API is needed.** The user challenged that addition. Tag names are inputs to building show search text; that does not make ShowStore the owner of tag data. Cards can continue receiving their tag map separately.

Keep query and page in the Shows view/URL, not global ShowStore state. History needs show lookup, not the Shows screen's query. Store only records and search data, not mounted cards, detached DOM, or decoded artwork.

## Initialization and data flow

Proposed delivery flow:

1. Build-time Astro reads the source catalog and pre-renders the first page of shows.
2. Only that initial slice is passed as Shows component props, rather than all 600+ shows.
3. The browser initializes ShowStore from the full static catalog, optionally using IndexedDB as its persistent cache.
4. Search and pagination reuse that shared in-memory catalog without fetching for each query or page change.
5. History resolves saved show IDs through the same store.

This duplicates metadata for the initial slice between HTML props and the complete catalog. It avoids embedding the entire catalog in hydrated HTML. Loading/error states must preserve the initial usable content.

Current source reads JSON at build time, **but `ShowsPane client:load` serializes its full shows props into browser-delivered HTML**. Adding another full JSON fetch without reducing those props duplicates transfer. Build-time reading alone does not prevent that.

The existing Astro client navigation can preserve shared state across internal navigation. A full reload, new tab, or navigation outside the site does not preserve that tab's memory. Ensure the actual store lifecycle supports this; do not assume page component state persists.

## Pagination

Required intent: do not display all shows at once. Proposed mechanics:

- **Search all shows → apply ordering → calculate counts → slice the active page.** Never search only the current page.
- Mount only the active page's cards; hiding the others with CSS does not save their DOM/hydration cost.
- Pre-render only the initial page to reduce initial HTML and card hydration.
- Reset to page 1 on query/order changes; clamp invalid pages after catalog updates.
- Preserve query/page in the URL for refresh, sharing, and Back navigation.
- Provide accessible controls, result counts, and a no-results state.

Page size is undecided; **30–50** was an example, not an agreed requirement. Numbered static routes are optional and were not requested. Pagination occurs in the browser in the proposed design; it does not reduce the metadata needed to search the complete catalog.

## Static file generation

Two alternatives remain available:

| Approach | When it fits |
| --- | --- |
| JSON in `public/` | Existing exports already contain exactly the needed data; simplest delivery |
| Astro-generated JSON | Build combines data, removes fields, precomputes search text, or generates revisions |

Both become static files on GitHub Pages. A `GET()` in an Astro static route is not a server endpoint at runtime. Keep one authoritative source, update build-time readers if files move, and respect the `/archive-site/` base path.

Stable filenames such as `shows.json`, `djs.json`, and `tags.json` are acceptable. **Hashed filenames are optional**, not a requirement; the user questioned their necessity.

## Caching and `data_versions.json`

The user explored IndexedDB catalog caching but did not make a final choice. Assistant recommendation: start with shared memory and ordinary HTTP caching; add persistent catalog caching if measurements justify it. Personal-data persistence is a separate decision.

With the hybrid approach, IndexedDB avoids repeat downloads when unchanged, while memory avoids database reads per keystroke. IndexedDB indexes do not automatically provide substring or multiword search across show titles, DJ names, and tags.

A proposed manifest with stable filenames:

```json
{
  "shows": { "revision": "<content hash>" },
  "djs": { "revision": "<content hash>" },
  "tags": { "revision": "<content hash>" }
}
```

Generate revisions from actual exported content during the build. Keep dataset revision, IndexedDB schema version, and optional informational `updatedAt` distinct.

If catalog persistence is adopted:

1. Display cached data immediately; revalidate the manifest once per visit/session in the background.
2. Fetch changed files with revalidation; verify their expected hashes and data format.
3. Fetch/validate before opening the write transaction. Replace related datasets and revisions consistently, including deletions.
4. Keep the previous snapshot if network, validation, deployment mismatch, or transaction failure occurs.
5. Never clear personal data during catalog refresh. Handle blocked schema upgrades and connections from other tabs.

Normal HTTP caching may already avoid retransferring unchanged JSON bodies. The deployed cache behavior must be measured; a manifest also adds a dependent request on cold startup.

## Size and mobile tradeoffs

Measured source sample: **64 shows, 43,514 raw JSON bytes, 5,630 locally gzipped bytes**. At the same average record size, 600 shows would be about **408 KB raw**. This is an extrapolation, not a measured future catalog.

These are different quantities:

| Quantity | What it measures |
| --- | --- |
| Compressed HTTP body | Network transfer when hosting serves compression |
| Raw JSON | Decompressed text before parsing |
| IndexedDB disk use | Browser-managed structured storage; not automatically gzipped JSON |
| JavaScript heap | Parsed objects, strings, search text, and application state |
| Rendering/image memory | Card DOM, framework work, and decoded artwork |

A compressed response is decompressed before JSON parsing. Do not treat the gzip figure as database or memory size. Manual compression of IndexedDB data was not recommended at this scale.

Keep one shared catalog and references/IDs for results instead of cloning records. Pagination reduces card/DOM/image costs; all-record search still retains searchable metadata. Reading everything from IndexedDB on every page mount recreates objects and adds latency. A one-time shared load trades retained metadata memory for less repeated parsing/loading.

DJs and Explore should not fetch all shows solely for their own name/tag searches. Their current panes are not hydrated, so search will need explicit client behavior.

## Playlists, playback history, resume, and search history

Personal records are user-authored or user-generated data, not a replaceable catalog cache. ShowStore supplies show metadata by ID; it should not absorb playlist editing, playback-session tracking, or history retention. Use the existing audio store for live playback state. Exact personal-store classes remain undecided.

| Record | Purpose | Suggested fields / behavior |
| --- | --- | --- |
| Playlist | Named, ordered collection of shows with personal notes | Generated ID, title, created/updated timestamps, ordered entries containing `showId`, `addedAt`, and note |
| Current selection | Restore the last selected show after a reload | One record with `showId`; restore as paused/ready rather than claiming audio is playing |
| Resume position | Continue an earlier show after switching away | Key by `showId`; `positionSeconds`, `updatedAt`, optional completion state |
| Playback session | Record repeated visits to the same show separately | Unique session ID, `showId`, `startedAt`, last activity, nullable end/completion timestamps; listening time only if required |
| Search history | Reuse previous committed queries | Query, screen/scope, last-used timestamp; deduplicate and cap entries |

These are proposed field responsibilities, not a finalized schema or a requirement for five separate object stores. Keep timestamp format consistent, distinguish show duration from saved position, and define session boundaries before implementation.

History and playlist screens load their own personal records and resolve referenced shows through the shared catalog. They should not trigger a second catalog download when ShowStore is already initialized. Retain personal entries when a catalog show disappears; optionally save minimal display metadata so unavailable entries remain understandable.

Playlist writes should preserve ordering and use transactions for read-modify-write operations across tabs. A failed save must leave the prior record intact and be visible to the user. Catalog updates must never reset these records. Duplicate playlist entries, session boundaries, retention limits, and backup/export UX remain open choices.

## Personal data and browser reliability

The original proposal includes playlists, current playback, playback history, and search history. Refinements discussed, **still requiring implementation decisions**:

- Keep playlist ordering and stable show IDs; show removed catalog entries as unavailable rather than silently deleting them. Decide duplicate policy and whether to retain a title/URL snapshot.
- Separate resume position (`positionSeconds`) from actual listening time. Exact equality with show duration is not reliable completion detection.
- Give playback sessions unique IDs; define completion and what `finishedAt` means. A singleton current selection does not preserve resume positions for every show.
- Save progress periodically and on meaningful events; avoid per-frame writes and unload-only persistence. Cap history and save committed searches rather than keystrokes.
- Confirm Mixcloud progress/end signals before promising resume/completion behavior.
- Personal data is local to the browser/profile/origin, can be cleared or evicted, and does not sync. Export/import is recommended if playlists should last.
- Use an archive-specific database name: origin storage is not isolated by `/archive-site/`. A custom-domain move does not automatically migrate local data.
- Cached metadata does not make pages, images, or external audio fully offline.

The user raised [WebKit bug 226547](https://bugs.webkit.org/show_bug.cgi?id=226547). It concerned database opens hanging without success/error callbacks on older Safari/iOS; a maintainer reported the fix shipped in iOS 14.7 beta 4. It is not evidence that the same bug affects current Safari.

Design implication: bound database initialization with a timeout, keep browsing/playback independent of storage, and fall back to static JSON for catalog access. A timeout does not cancel the underlying open request; handle late connections safely. Report personal-data saves as unavailable/failed rather than pretending they succeeded. Do not add historical dummy-database workarounds without an explicit old-browser requirement.

## Open choices and verification

Still undecided: catalog persistence versus HTTP cache alone; page size; exact matching/order rules; source/public file layout; retention limits; playlist export/import; progress/completion semantics.

Before choosing extra machinery, test realistic 600+ show data on lower-end Android and iPhone Safari: cold/repeat transfers, heap, search-to-paint latency, mounted cards, and catalog import cost. Verify failed refreshes preserve personal data, search finds off-page matches, URL navigation restores state, and multiple tabs/storage failures recover sensibly.

Production cache headers, physical-device performance, and Mixcloud progress/completion behavior were not verified in this discussion. Sample code was illustrative and omitted complete loading, validation, subscriptions, URL state, and tests; it is not a ready implementation.
