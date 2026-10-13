# Agent entry point

## Work scope

- Honor the task's chosen mode: chunked work requires approval at each review
  boundary; one-shot work proceeds through implementation and verification.
  For substantial features, architecture changes or multi-file implementations
  with no mode specified, ask: "Would you like to build this in chunks
  (structure → scaffolding → implementation) or one-shot?" Small fixes/refactors
  proceed normally. Mode applies to the current task only; see
  [Workflow](docs/development-workflow.md#development-modes) for stage rules.
- Keep generated `.astro/` and `dist/` output out of manual edits.
- Use existing scripts and automated checks rather than duplicating their
  rules in prose.

## Selective references

Identify the relevant code first. Follow a known reference directly or consult
[docs/INDEX.md](docs/INDEX.md) when you need guidance. Read only the relevant
sections; reuse unchanged guidance already read during the task. Markdown
links here are navigation, not file imports. Do not preload `docs/`.

| Task | Reference |
| --- | --- |
| TypeScript or component contracts | [TypeScript](docs/typescript.md) |
| CSS or responsive layout | [CSS](docs/css.md) |
| Tests or verification selection | [Testing](docs/testing.md) |
| Routes, rendering, data or service boundaries | [Architecture](docs/architecture.md) |
| Development modes, dev server, hooks or multi-step work | [Workflow](docs/development-workflow.md) |
| Hosting, base paths or deployment | [Deployment](docs/deployment.md) |

When starting Astro, use `astro dev --background`; manage it with
`astro dev stop`, `astro dev status`, and `astro dev logs`. `bun run dev`
uses this mode and adds a foreground type-check watcher.

## Documentation maintenance

- Never modify `docs/human/` or `docs/humans/` unless the user explicitly asks
  for changes there. This includes moving, renaming, deleting or reformatting
  their contents; general documentation work does not authorize those edits.

- Search for an authoritative reference before creating documentation; update
  it when its documented behavior or convention changes.
- Do not create a Markdown summary after every task. Keep temporary progress
  in a relevant plan, never in this file; see the workflow for plan lifecycle.
- Update links and the index when moving or deleting documents.
- Separate stable conventions from temporary details; remove obsolete rules
  instead of appending exceptions or rules for one-time agent errors.
- Add unconditional reading requirements only with a concrete justification.
  Keep agent-specific configuration minimal and do not duplicate these rules.
