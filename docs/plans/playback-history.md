# Playback history and resume

Mode: chunked. Stop at each structure, scaffolding, and implementation review boundary.

## Decisions

- One IndexedDB `playback` object store keyed by `showId`; upgrade schema to v3 without changing existing records.
- Each record is an object with `showId`, `inProgress`, `positionInSeconds`, and a `history` array.
- Document `PlaybackRecord` and `PlaybackSession` in `src/stores/playback/types.ts`.
- Sessions contain Unix-millisecond `startedAt` and optional `endedAt`, second-based `startPosition`, `endPosition`, and accumulated `playedSeconds`.
- A listen is a session with more than 10 seconds of playback; retain shorter sessions without counting them.
- Pauses, errors, and archive navigation preserve sessions. Switching shows, finishing, clearing playback, and reloading end sessions.
- Start sessions on advancing playback. Exclude pause and buffering time; seeking must not inflate playback duration.
- Save every five seconds while active and at boundaries. On reload, close previously open sessions at their last persisted checkpoint; do not rely on unload saves.
- Centralize resume in the adapter: initialize playback storage, load without autoplay, seek unfinished progress, then apply latest intent. Completed shows start at zero.
- PlaybackStore owns records, subscriptions, and serialized saves. Storage failures must not stop playback; retry on subsequent saves.
- Preserve stale-selection protection. Record actual starting positions, including when a seek is refused.
- Defer visible History rows and statistics. Rows may overlap and eventually show each show once.
- No cross-device sync or multi-tab coordination. Abrupt termination may lose five seconds of progress; concurrent tabs may overwrite updates.

## Chunks

1. Structure: empty types, store, and focused test files. Approved.
2. Types and scaffolding: documented types, PlaybackStore signatures, and an extended widget contract. Disconnected from working playback; awaiting review.
3. Storage: additive upgrade, independent initialization, reads, subscriptions, serialized writes, and focused tests. Pending.
4. Tracking: session boundaries, timing, checkpoints, reload recovery, and real Mixcloud buffering/recovery verification. Pending.
5. Resume: central adapter integration, failure handling, and complete verification. Pending.

## Flow

```text
Show card -> AudioStore -> MixcloudAdapter -> widget
                                ^              |
                                |       playback events
                                |              v
                                +------- PlaybackStore
                                           |       |
                                     subscribers   serialized saves
                                                       |
                                                IndexedDB: playback
```

## Verification

Cover upgrade preservation, record round trips, repeat sessions, strict 10-second threshold, pause continuity, buffering exclusion, seeks, reload recovery, write ordering, storage errors, and rapid selection changes.

Run focused checks per functional chunk. Finish with repository lint, check, test, and build commands, plus browser resume/navigation checks. Update the architecture reference after integration.

## Next action

Review scaffolding. Approval authorizes chunk 3 (storage), not later integration chunks.
