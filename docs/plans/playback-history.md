# Playback history and resume

Mode: chunked. Stop at each structure, scaffolding, and implementation review boundary.

## Decisions

- One IndexedDB `playback` object store keyed by `showId`; upgrade schema to v3 without changing existing records.
- Each record is an object with `showId`, `inProgress`, `positionInSeconds`, and a `history` array.
- Document `PlaybackRecord` and `PlaybackSession` in `src/stores/playback/types.ts`.
- Sessions contain Unix-millisecond `startedAt`, checkpoint `updatedAt`, and optional `endedAt`, second-based `startPosition`, `endPosition`, and accumulated `playedSeconds`.
- A listen is a session with more than 10 seconds of playback; retain shorter sessions without counting them.
- Pauses, errors, and archive navigation preserve sessions. Switching shows, finishing, clearing playback, and reloading end sessions.
- Start sessions on advancing playback. Exclude pause and buffering time; seeking must not inflate playback duration.
- Save every five seconds while active and at boundaries. On reload, close previously open sessions at their last persisted checkpoint; do not rely on unload saves.
- Centralize resume in the adapter: initialize playback storage, load without autoplay, apply latest intent, then seek unfinished progress on confirmed play. Live verification found that a seek before play reports success but resets when audio starts. Tracking waits for the seek to settle. Completed shows start at zero.
- PlaybackStore owns records, subscriptions, and serialized saves. Storage failures must not stop playback; retry on subsequent saves.
- Preserve stale-selection protection. Record actual starting positions, including when a seek is refused.
- Defer visible History rows and statistics. Rows may overlap and eventually show each show once.
- No cross-device sync or multi-tab coordination. Abrupt termination may lose five seconds of progress; concurrent tabs may overwrite updates.

## Chunks

1. Structure: empty types, store, and focused test files. Approved.
2. Types and scaffolding: documented types, PlaybackStore signatures, and an extended widget contract. Approved.
3. Storage: implemented additive v3 upgrade, independent initialization, isolated memory reads, subscriptions, set/flush, and serialized retryable writes. Five focused tests, TypeScript checks, and the IndexedDB browser suite passed. Approved.
4. Tracking: implemented session boundaries, monotonic timing, progress-driven five-second checkpoints, and reload recovery using session updatedAt. Removed the redundant clone on IndexedDB load. Twelve focused tests pass. Approved.
5. Resume: implemented store composition and independent initialization, consolidated/validated widget contract, event wiring, seek on confirmed play, lifecycle cleanup/page-exit saves, and storage/seek failure handling. Live playback, saved history, reload recovery, resume, and initial buffering-to-play events verified in Chromium. Mid-show buffering is covered by focused tests; forcing an offline seek did not stall the cached audio. Final checks passed; awaiting review.

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

Final results: 187 tests pass; lint, Astro check (zero diagnostics), production build, documentation checks, IndexedDB browser checks, player navigation browser regression, and transfer-size budgets pass (87.7 KiB JavaScript gzip against 100 KiB). Live reload created a new session starting at the previous session's saved 96-second position. Physical iOS and an actual mid-show network stall were not verified.

## Next action

Review chunk 5. No implementation chunks remain. UI rows and statistics remain deferred. On final approval, archive or remove this task plan under the workflow's plan lifecycle rules.
