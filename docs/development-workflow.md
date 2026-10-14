# Development workflow

## Development modes

The root [agent entry point](../AGENTS.md#work-scope) owns mode selection.
An explicit request for chunks, incremental implementation, scaffolding,
step-by-step work or pair programming selects **chunked mode**. A complete
implementation request or explicit one-shot choice selects **one-shot mode**.
For small fixes, straightforward refactors and minor edits, proceed normally
unless chunked mode was requested. Do not ask again when a mode is specified;
do not carry it into unrelated future tasks.

In one-shot mode, follow conventions, implement the authorized scope, add
appropriate tests, validate integrated behavior and report the result without
stage interruptions. Keep changes focused and avoid speculative features or
unrelated cleanup.

In chunked mode, never cross a stage or unit review boundary without explicit
user approval. Approval of structure alone does not authorize scaffolding;
wait for a scaffolding request. Approval of scaffolding authorizes the first
implementation unit, not all remaining units. Follow the user's chosen unit
and adjust existing work rather than restarting planning. "Finish the rest"
or "skip ahead and finish" switches the remaining task to one-shot; type or
structure corrections authorize only those corrections.

When a chunk is complete, summarize the result and ask for approval of the
current chunk. After that approval request, briefly describe the next chunk
and its scope, or state that no chunks remain. Describing the next chunk does
not authorize starting it; wait for the required approval or request.

## Chunked stages

### 1. File structure

Before implementation, inspect relevant code and architectural boundaries,
identify reusable modules/functions, and propose the smallest file set.
Show a concise tree marking new and modified files, each responsibility,
dependencies and data-flow direction. Create the files agreed by the task or
user; if the proposal is not yet agreed, obtain agreement before creating them.
New files remain empty; keep existing files functional and unchanged except
for explicitly necessary structural edits. Do not add types, interfaces,
classes, function bodies or substantial scaffolding yet.

Stop for inspection of the structure. If the user changes it, make only those
changes and stop again. Advance only after structure approval and a request
such as "make the scaffolding".

### 2. Types and scaffolding

Establish public contracts, typed signatures, module declarations, named
imports/exports and minimal entry points that reveal call relationships.
Follow [TypeScript conventions](typescript.md), including the repository's
preference for type aliases rather than new interfaces. Use classes only
when state, encapsulation or existing patterns justify them.

Show intended orchestration without business logic. Mark leaf stubs clearly
with `throw new Error("Not implemented")`; do not fabricate results or return
success-shaped placeholders. Keep scaffolded paths disconnected from working
entry points where possible, and identify any temporarily nonfunctional path.
Comments should explain responsibilities, dependencies and why/how calls
connect, rather than narrating syntax.

Present the resulting file tree, important types/contracts, a compact call
flow with inputs, outputs, side effects and error paths, and the unimplemented
functions. Check contracts where practical; report any temporary check failures.
Stop and request approval before implementing behavior in any function body.

### 3. Individual implementation units

Implement one meaningful function or tightly coupled unit at a time, with
small testable dependencies before integration. Before editing, briefly
identify its role and callers. Keep unrelated functions unchanged. Add focused
tests when appropriate and run relevant checks using [Testing](testing.md).
Show the diff or concise change summary and explain inputs, outputs, side
effects and error propagation. Stop for review before the next unit, even if
several remaining functions seem obvious.

Requests such as "implement validation", "change the types" or "show how this
gets called" steer the existing task. Do not generate a new plan or status
document for each turn. Keep flow descriptions short and local to the work;
reuse them instead of repeating them in every file. Once integration is
complete, validate the complete behavior and report remaining limitations.

## Development and formatting

`bun run dev` runs `astro dev --background` and `astro check --watch`.
The script remains attached to the watcher and stops Astro on exit. Manage the
background server with `astro dev status`, `astro dev logs`, and `astro dev stop`.

`bun run format` applies Biome formatting, safe lint fixes and import
organization. The pre-commit hook runs it before staging resulting changes.
Use the [testing reference](testing.md) when selecting verification commands.
The mode and stage sections above own implementation review checkpoints.

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
