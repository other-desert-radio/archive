# Development workflow

## Development and formatting

`bun run dev` runs `astro dev --background` and `astro check --watch`.
The script remains attached to the watcher and stops Astro on exit. Manage the
background server with `astro dev status`, `astro dev logs`, and `astro dev stop`.

`bun run format` applies Biome formatting, safe lint fixes and import
organization. The pre-commit hook runs it before staging resulting changes.
Use the [testing reference](testing.md) when selecting verification commands.
The root agent instructions own chunk scope and review checkpoints.

## Persistent plans

For a multi-step task that benefits from persistent state, use one
`docs/plans/<task>.md`. Do not create a plan for trivial work. Read only the
plan for the active task at its start and update it as work progresses.
Record incomplete/completed steps, blockers, decisions and next actions.
Do not use `AGENTS.md` or the documentation index as a task log.

On completion, delete a plan if it has no lasting value; otherwise move it to
`docs/plans/archive/` with a completion/status note. Historical sketches in
that directory are evidence, not current engineering guidance. Create these
directories only when needed. Promote enduring decisions to the authoritative
reference and link it instead of duplicating its rules in the plan.

## Framework reference lookup

Consult official Astro documentation when the task needs framework semantics
that source and local references do not establish; do not fetch it for every edit.

- [Routing](https://docs.astro.build/en/guides/routing/): pages, dynamic routes, middleware.
- [Astro components](https://docs.astro.build/en/basics/astro-components/): component syntax/lifecycle.
- [Framework components](https://docs.astro.build/en/guides/framework-components/): React islands and hydration.
- [Content collections](https://docs.astro.build/en/guides/content-collections/): managed content.
- [Styling](https://docs.astro.build/en/guides/styling/): style integration.
- [Internationalization](https://docs.astro.build/en/guides/internationalization/): language support.
