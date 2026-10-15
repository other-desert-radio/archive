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

`BaseLayout.astro` includes Astro's `ClientRouter` only on the four category
pages (Shows, DJs, Explore and History), with root and body transition animations
disabled and an immediate swap fallback. Show, DJ and tag detail pages omit the
router. Links to details use `data-astro-reload` to bypass transition preparation
and navigate directly, including links inside the player.
The site still builds to static HTML; initial visits load a full document.
Tag pages return to Explore. Their show and DJ links carry `fromTag`; shared
navigation resolves known tag IDs in the browser on initial load and
`astro:page-load`, returning to the tag instead of the default listing.
Missing or invalid IDs retain the default SHOWS or DJs return destination.

The shared header mounts a persisted React miniplayer backed by the audio store.
Show selections carry the full Show and a validated playback source. The widget
stays attached between category tabs to avoid interrupting playback;
entering or leaving a detail page, full reloads and navigation outside the archive
end playback. See
[Miniplayer](miniplayer.md) for player data flow, adapter lifecycle, responsive
layout and iframe-preserving navigation.

`ShowsPane` is hydrated with `client:load`; each show card subscribes to playback
state and renders an artwork overlay control. Metadata and detail links retain
their server-rendered HTML. Show URLs are converted to validated Mixcloud keys
by `src/components/shows/show-playback.ts` before publishing playback requests.

The archive listings use `src/pages/index.astro` for SHOWS and
`src/pages/djs.astro` for DJs. Both use `CategoryTabs.astro` to select the
active category. `src/pages/explore.astro` and `src/pages/history.astro`
provide page shells for the remaining tabs, using the shared layout and their
respective active category. Visible category tabs prefetch destination HTML
using Astro's viewport strategy so touch navigation can reuse the HTTP cache
without waiting for desktop hover. Astro retains its reduced-data and slow
connection safeguards. `src/utils/fetch-djs.ts` reads and validates
`src/res/djs_brief.json` at build time. The DJ page passes its summaries
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

Archive JSON is read from `src/res/` during builds and validated in
`src/utils/`. The site has no database connection. Change contracts at these
boundaries rather than introducing backend-only database conventions.

## Archive image fields

Show records, DJ summaries, full DJ profiles, and DJs nested in shows carry
required `image_small` and `image_large` references. DJ listing cards use
`image_small`; DJ profile photos and show detail artwork use `image_large`.
Show cards use `image_small` for artwork and associated DJ photos.
