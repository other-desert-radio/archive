# Future plan: validate archive resources before publishing

Status: proposed; not implemented. Requested 2026-11-02.

## Decision

Validate first-party show structure during publishing, not on every browser load. ShowStore will trust the published show contract instead of scanning every downloaded record with a runtime schema validator. TypeScript types describe that contract; they do not validate JSON at runtime.

Keep HTTP/JSON error handling and the cheap check that the downloaded export's revision matches the manifest. Those protect against failed requests and stale/mixed deployment files, even when each published artifact is structurally valid.

## Existing gate

[The Pages workflow](../../../.github/workflows/deploy-pages.yml) builds the site before uploading `dist/`, and deployment depends on that build job. Build-time readers in `src/utils/fetch-*.ts` already validate parts of the archive, but do not comprehensively validate every published resource or revision relationship.

Extend that workflow rather than adding a separate optional validation workflow. Validation must fail the publishing job before artifact upload, for pushes and manual dispatch alike.

## Implementation steps

- [ ] Add one reusable resource-validation command, using the existing patterns/readers and installed dependencies. Avoid maintaining separate competing schemas for the same records.
- [ ] Validate the built `dist/resources/` files after `bun run build` and before `upload-pages-artifact`. Check the actual files being published, not only source inputs.
- [ ] Cover `shows.json`, `djs_brief.json`, every `djs/*.json` profile, `tags.json`, and `data_versions.json`.
- [ ] Check record/envelope structure, required fields, optional fields, unique stable IDs within each dataset, and valid references to DJs/tags. Match the existing supported data contract; explicitly decide any additional restrictions.
- [ ] Require readable numeric dataset revisions, valid timestamps, and agreement between manifest `id` and export `version` for shows/DJs/tags. Ensure brief and full DJ exports have a defined revision relationship.
- [ ] Report the filename and offending field/record clearly and exit nonzero on failure.
- [ ] Test valid exports, malformed/missing files, duplicate IDs, broken references, and mismatched revisions. Verify a failing validation blocks artifact upload/deploy.
- [ ] Document the command in the testing/deployment references and run it in PR checks for early feedback, while keeping the deploy gate authoritative.

## Acceptance

Malformed archive resources cannot be uploaded through the Pages workflow. Valid resources publish normally. The browser show fetch does not perform full record-shape validation. Download failures or revision mismatches never replace a usable local catalog or advance its cached revision.

## Open choices and limits

Decide how revision increments are generated and how to detect content changes with an unchanged revision; that requires a previous-content baseline beyond structural validation. Do not assume increasing numbers alone prove content changed correctly.

CI validates the published artifact, not browser storage or arbitrary third-party data. Existing VersionsStore manifest validation remains unchanged by this plan. No workflow, validator, or runtime code is implemented here.
