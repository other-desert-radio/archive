# Deployment

The site is static Astro hosted on GitHub Pages. `astro.config.mjs` owns
`output`, `site` and the `/archive` base path. Preserve base-path-aware
internal and asset URLs; do not introduce a server runtime without a concrete
requirement.

`.github/workflows/deploy-pages.yml` is authoritative for deployment: pushes
to `main` and manual dispatch install with Bun's frozen lockfile, build, upload
`dist/`, then deploy the Pages artifact. Runtime/dependency versions belong in
`package.json` and `bun.lock`, not a second list here.

Before changing deployment/routing, run `bun run build` and inspect the relevant
generated URLs under the configured base. For broader verification consult
[Testing](testing.md#commands). Do not edit generated output manually.
