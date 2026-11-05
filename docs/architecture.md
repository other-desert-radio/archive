# Architecture overview

This repository is a small static Astro site. This reference describes current boundaries and intentional static-first decisions; source and configuration own exact implementation details.

## Runtime and build

- Astro is the application framework and build tool.
- `astro.config.mjs` sets `output: "static"`, so production output is pre-rendered into `dist/` and does not require a server runtime.
- `.github/workflows/deploy-pages.yml` builds the static site with Bun and deploys `dist/` to GitHub Pages on pushes to `main`.
- `@astrojs/react` supports server-rendered archive components and the hydrated
  miniplayer island below the shared navigation.
- The project targets Node.js `>=22.12.0` and uses Bun for package scripts and lockfile management.

## Source layout

```text
src/
├── layouts/            Shared page shells; `BaseLayout.astro` owns global CSS
├── components/         Shared UI; mixcloud/ contains the widget and API helpers
├── stores/             Shared store instances and React context
│   └── audio/          Playback state store and React subscription hook
├── pages/              File-based routes; `index.astro` is `/`
├── styles/             Global stylesheet and shared design tokens
└── utils/              Build-time data readers and validators

public/                 Static assets copied to the site root unchanged
├── assets/icons/       Play and pause SVGs for show-card controls
├── background.jpeg
└── fonts/              WOFF2 webfont files and the Space Mono license

scripts/                Repository maintenance scripts
└── setup-hooks.sh

astro.config.mjs        Astro configuration and integrations
package.json            Commands, dependencies, and runtime requirements
dist/                   Generated static build output (do not edit by hand)
.astro/                 Astro-generated types and development metadata
```

The Mixcloud widget and helpers are exported through
`src/components/mixcloud/index.ts`. Store APIs are exported through
`src/stores/index.ts`, with playback exports also available through
`src/stores/audio/index.ts`. Internal store imports use their defining modules
to avoid circular dependencies through the barrels.

## Request and rendering flow

Store construction is side-effect free during server rendering. `useStores()`
starts shared initialization in a React effect, which runs only in the browser.
The composition root initializes `VersionsStore` first, then ShowStore and TagStore in sequence.
Browser consumers separately initialize PlaybackStore and PlaylistStore so catalog refresh failures
do not prevent reading local playback progress or playlists. The Mixcloud adapter also awaits
that shared local initialization before loading a selection.
VersionsStore fetches and validates the shared manifest and reads locally cached
revisions from metadata. Both dataset stores consume its cached/published revision getters.
After a dataset and revision commit atomically, `VersionsStore.refreshCached()`
reloads the committed revisions; fetching a manifest never advances them. Concurrent consumers share one initialization promise;
a failed attempt rejects and permits a later retry. Individual stores do not
need browser guards in their constructors.

PlaylistStore owns local user playlists in the `playlists` IndexedDB object store,
keyed by UUID strings. It does not participate in catalog revision tracking.
Its methods accept named parameter objects using `playlistId` and `showId`.
Mutations await local initialization and run serially, persisting before publishing
new state; failed writes reject without changing memory and allow later retries.
Playlist and entry types are deeply readonly. Reads share frozen records and a
cached snapshot without copying or sorting; callers choose presentation order.
Entries retain insertion order, UTC ISO timestamps and optional notes. Duplicate
shows reject, and missing catalog references remain stored for callers to resolve
through ShowStore. Storage is local to the browser; remote sync, cross-tab edit
coordination and playlist UI are not implemented.

ShowStore and TagStore first load their cached records into memory, then check
the published revision.
Changed exports replace the dataset and its revision metadata in one transaction; memory is
replaced only after a successful save. Failed refreshes retain cached records while
rejecting initialization. `get()` and `getAll()` read memory synchronously; callers
must await shared initialization when they require fresh data. Browser show and tag fetches
trust the first-party record structure, while checking HTTP status and export revision;
the [publishing gate](deployment.md) validates the built exports before upload
and runs in PR checks.

`BaseLayout.astro` includes Astro's `ClientRouter` on every page, with root
and body transition animations disabled and an immediate swap fallback.
Internal archive links use client routing to preserve playback.
The site still builds to static HTML; initial visits load a full document.
Tag pages return to Explore. Their show and DJ links carry `fromTag`; shared
navigation resolves known tag IDs in the browser on initial load and
`astro:page-load`, returning to the tag instead of the default listing.
Missing or invalid IDs retain the default SHOWS or DJs return destination.

The shared header mounts a persisted React miniplayer backed by the audio store.
Show selections carry the full Show and a validated playback source. The widget
stays attached across category and detail navigation to avoid interrupting playback;
full reloads and navigation outside the archive end playback. See
[Miniplayer](miniplayer.md) for player data flow, adapter lifecycle, responsive
layout and iframe-preserving navigation.

`ShowsPane` is hydrated with `client:load`; each show card subscribes to playback
state and renders an artwork overlay control. The SHOWS listing renders its first 20 cards in static HTML. After shared
store initialization, an intersection observer appends batches of 20 from
ShowStore in the build-time catalog order. Pending initialization displays
“Loading shows...” below the cards; failed initialization offers a retry.
Only tags used by the first 20 cards are included in the island props;
subsequent cards use the initialized TagStore. Pagination limits rendered cards,
while revision refreshes still download the complete catalog. Before leaving
SHOWS, the island saves its loaded cards, offset and tags in memory per
ClientRouter history entry. On Back/Forward a wrapper around the router swap
mounts those cards synchronously before Astro applies the history scroll
position. Astro skips hydration for that already mounted root; its unmount
event releases the React root when navigating away. The `visits` map is keyed
by Astro’s `history.state.index` and lives only in module memory; scroll
coordinates remain owned by Astro. Refreshing clears these listing snapshots
and starts with 20 cards, independently of the catalog cached in IndexedDB.
The initial metadata and detail links retain their
server-rendered HTML. Show URLs are converted to validated Mixcloud keys
by `src/components/shows/show-playback.ts` before publishing playback requests.

The archive listings use `src/pages/index.astro` for SHOWS and
`src/pages/djs.astro` for DJs. Both use `CategoryTabs.astro` to select the
active category. `src/pages/explore.astro` and `src/pages/history.astro`
provide page shells for the remaining tabs, using the shared layout and their
respective active category. Visible category tabs prefetch destination HTML
using Astro's viewport strategy so touch navigation can reuse the HTTP cache
without waiting for desktop hover. Astro retains its reduced-data and slow
connection safeguards. `src/utils/fetch-djs.ts` reads and validates
`public/resources/djs_brief.json` at build time. The DJ page passes its summaries
to the server-rendered `DJsPane` component, which links each title to its
static detail page. `src/pages/djs/[id].astro` loads the matching full DJ
profile during the build and generates one static detail page per DJ; it
renders the profile image, tags, socials, biography and show information.

For the current site, a browser requests `/`, Astro resolves that URL to `src/pages/index.astro`, and the build emits a static `dist/index.html`. `src/layouts/BaseLayout.astro` provides the document shell and imports `src/styles/global.css`, which registers Space Mono and applies the base font to the page. Files in `public/` are available at root-relative URLs, such as `/background.jpeg` and `/fonts/space-mono-regular.woff2`.

As routes are added, place them under `src/pages/` using Astro's file-based routing and wrap them in `BaseLayout.astro` so the global styles and document metadata are consistently applied. Shared presentation should move into `src/components/`; reusable data or content can live in a dedicated `src/` module or Astro content collection when the project needs one. Keep browser-only interactivity isolated to React components or client-side scripts rather than introducing a runtime dependency for otherwise static pages.

## Related boundaries

Shared density tokens and layout standards live in [CSS](css.md).
Development commands live in [Workflow](development-workflow.md), verification
in [Testing](testing.md), and hosting/base-path behavior in [Deployment](deployment.md).

Archive JSON is read from `public/resources/` during builds and validated in
`src/utils/`. The site has no database connection. Change contracts at these
boundaries rather than introducing backend-only database conventions.

Archive payload files use `{ version, updatedAt, data }` envelopes. Readers
validate and unwrap `data`, preserving array payloads for shows, DJ summaries
and tags, and an object payload for each full DJ profile. The tag reader
returns its existing ID lookup map. Direct JSON imports also read `.data`.
Browser stores use envelope versions and `data_versions.json` to refresh shows
and tags. IndexedDB schema v3 adds a local `playback` store keyed by `showId`,
preserving existing shows, tags, and committed revision metadata during upgrades.
Schema v4 adds `playlists` keyed by `id`, preserving all existing records.
PlaybackStore provides independent local initialization, memory subscriptions,
and serialized retryable saves. A listen counts when the Mixcloud widget emits
`ended`, regardless of the starting position. Its history entry receives
`completedAt`; duplicate completion events count once. Pause, buffering, errors,
selection changes, clear, and reload preserve the unfinished session, including
its original start time and position. Playback after completion creates a new
session. There is no elapsed listening-time accounting or minimum duration.
Progress checkpoints save at five-second intervals; interruption events flush
pending records, and page exit attempts a final save. Initialization loads saved
sessions without closing them. The adapter ignores stale selection events and
trailing progress after completion until playback starts again.
Resume seeks wait for the widget's play event: a seek immediately after load can
report success but reset when audio starts. Tracking waits for the resume seek to
settle and uses actual reported positions. Completed shows start over, preserving
earlier sessions. Mixcloud can omit the play event after seeking from the end;
progress can confirm an explicit replay request, while trailing progress without
that request stays ignored. Replay sends seek and play in order without waiting
for the seek promise, which can remain unsettled after ended. Storage errors are
logged without stopping playback; if the initial read fails, tracking is disabled
for that selection to avoid overwriting unread history. A later selection retries
initialization. Failed saves retain
pending records and retry at subsequent checkpoints or playback boundaries.

## Archive image fields

Show records, DJ summaries, full DJ profiles, and DJs nested in shows carry
required `image_small` and `image_large` references. DJ listing cards use
`image_small`; DJ profile photos and show detail artwork use `image_large`.
Show cards use `image_small` for artwork and associated DJ photos.
