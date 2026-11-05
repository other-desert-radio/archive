# Local playlists

## Decisions

- Chunked implementation; stop for approval at every stage or implementation unit.
- Data layer only: create, read, rename, delete, add/remove shows, edit notes.
- No reordering, UI, import/export, remote sync, or cross-tab coordination.
- Playlist IDs are UUID strings; timestamps are UTC ISO strings.
- Stored playlist key is `id`; function arguments use `playlistId` and `showId`.
- All functions accepting arguments, including constructor dependencies, use named parameter objects. Existing unrelated APIs stay unchanged.
- Entries have `showId`, `addedAt`, and optional `note`; duplicate additions reject.
- Preserve missing catalog references; no dependency on catalog initialization.
- Trim titles and reject blank titles; duplicate titles allowed. Preserve note text; undefined clears it.
- Mutations await initialization, serialize, persist, then publish memory changes. Failed operations reject without changing memory and do not poison the queue.
- Missing playlists/entries reject. Unchanged titles/notes are no-ops.
- Preserve creation/addition timestamps; edits advance `updatedAt`.
- Retrieval returns defensive copies; readonly snapshots stay stable until changes. Lists sort oldest first, then ID.
- No playlist revisions or VersionsStore integration. IndexedDB schema advances from 3 to 4.
- Preserve existing user edits; do not modify docs/human/playlists.md.

## Chunks

- [x] Structure: approved; store and test files created.
- [x] Scaffolding: exported Playlist/PlaylistEntry types, named-argument store signatures, typed schema entry; explicit stubs disconnected from working initialization. Awaiting review.
- [ ] Persistence: playlists object store keyed by id; fresh creation and version-3 migration coverage.
- [ ] Retrieval: SSR-safe construction, shared/retryable initialization, defensive reads, subscriptions and snapshots.
- [ ] Lifecycle: create, rename, delete; validation, timestamps, serialization and save-failure coverage.
- [ ] Entries: add/remove shows and edit notes; duplicate/missing errors and concurrent-edit coverage.
- [ ] Integration: store composition/context, independent initialization, fixtures and architecture documentation.

## Verification

Run focused tests per functional unit. Extend the existing IndexedDB browser harness for migration, preservation and reload persistence. At integration run unit tests, lint, Astro checks, build, database browser checks and documentation checks.

## Next action

Obtain scaffolding approval before implementing persistence. Store construction and methods explicitly throw until their implementation units; app composition remains unchanged. The typed database schema declares playlists, but IndexedDB does not create it until the persistence chunk.

Scaffolding checks: `bun run lint` and `bun run docs:check` passed. No behavior tests added for throwing stubs.
