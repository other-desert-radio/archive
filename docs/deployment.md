# Deployment

The site is static Astro hosted on GitHub Pages. `astro.config.mjs` owns
`output`, `site` and the `/archive` base path. Preserve base-path-aware
internal and asset URLs; do not introduce a server runtime without a concrete
requirement.

`.github/workflows/deploy-pages.yml` is authoritative for deployment: pushes
to `main` and manual dispatch install with Bun's frozen lockfile, build, validate
`dist/resources/`, upload `dist/`, then deploy the Pages artifact. Runtime/dependency versions belong in
`package.json` and `bun.lock`, not a second list here.

Before changing deployment/routing, run `bun run build` and inspect the relevant
generated URLs under the configured base. For broader verification consult
[Testing](testing.md#commands). Do not edit generated output manually.

## Resource validation gate

`bun run validate:resources` validates the actual built files after the build and
before artifact upload. A validation failure blocks publishing for main pushes
and manual dispatch. PR and merge-group checks run the same command after building
for early feedback.

The validator reuses the build-time record patterns for shows, brief DJs, tags
and full DJ profiles. It checks envelopes, supported ISO dates/timestamps, finite
numeric revisions, unique catalog IDs, profile filenames and coverage, and known
DJ/tag references. Show, tag and brief-DJ revisions must match the manifest; all
full DJ profiles must share the brief-DJ revision. Errors name the file and
offending record or field.

Existing optional fields, extra properties and permissive profile `shows`
contents remain supported. The gate does not fetch remote assets or compare
historical contents, so it cannot detect changed content with an unchanged
revision. Browser stores retain HTTP/JSON and revision checks while trusting the
published record structure.
