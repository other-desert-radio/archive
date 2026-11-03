# Playback history: completed listens

Mode: chunked. This replaces the earlier ten-second/session-per-visit rules.

## Decisions

- A listen counts only when Mixcloud emits ended. Starting at any position and reaching the end counts once, including seeking near the end.
- Pause, buffering, errors, switching shows, clearing playback, and reload preserve the unfinished session. Returning to a show reuses its unfinished entry, even when restarting at zero.
- Only completion closes a session. A replay after completion creates a new one. Duplicate ended events cannot complete the same session twice.
- Keep the existing playback object store and schema version. The user will clear all existing playback data; do not add migration, reset, or legacy compatibility code.
- Keep five-second progress checkpoints, serialized retryable saves, stale-selection protection, and independent local initialization.
- Keep the verified seek on confirmed play: an earlier seek can reset when audio starts. Ignore progress during the seek and record actual reported positions afterward.
- Keep requested console logs for new sessions, show switching, saved-record lookup, resume position, and seek acceptance. Resuming an unfinished session must not log a new session.
- Defer visible History rows and statistics UI. No cross-device sync or multi-tab coordination.

## Contract chunk: proposed types

Implemented in src/stores/playback/types.ts, together with the store and adapter callers.

```ts
/** Saved progress and listen history for one show, keyed by showId. */
export type PlaybackRecord = {
  /** IndexedDB key identifying the show. */
  showId: number;
  /** True while the latest listen is unfinished, including across reloads. */
  inProgress: boolean;
  /** Latest known position in seconds, used for resume. */
  positionInSeconds: number;
  /** Completed listens and, if present, the latest unfinished listen. */
  history: PlaybackSession[];
};

/** One listen attempt, preserved across interruptions until completion. */
export type PlaybackSession = {
  /** First confirmed playback progress, as Unix milliseconds. */
  startedAt: number;
  /** Latest progress checkpoint or completion time, as Unix milliseconds. */
  updatedAt: number;
  /** Unix milliseconds when playback reaches the end; absent while unfinished. */
  completedAt?: number;
  /** Actual reported position where this listen began, in seconds. */
  startPosition: number;
  /** Latest reported position during this listen, in seconds. */
  endPosition: number;
};
```

Remove endedAt and playedSeconds. Derive the listen count from entries with completedAt; do not persist a separate count.

## Contract chunk: store and caller changes

Retain initialize, get, getAll, subscribe, set, and flush with their current contracts. Initialization only loads records; it no longer closes unfinished sessions or writes recovery changes.

- progress(showId: number, positionInSeconds: number): Promise<void> validates input, creates or reuses the latest unfinished session, updates positions and updatedAt, notifies subscribers, and checkpoints periodically. Creating a session saves immediately and logs once.
- complete(showId: number): Promise<void> marks the latest unfinished session completed, sets inProgress false, and flushes. Missing or already completed sessions are no-ops, so duplicate ended events do not create listens.
- flush(): Promise<void> remains the save operation for pauses, buffering, errors, switches, clear, disposal, and page exit. Failures reject to the existing logging boundary and retain pending writes.

Remove suspend, end(completed), elapsed-time accumulation, active-session timing state, and reload closure. Retain only checkpoint scheduling; timestamps no longer measure listening duration.

The adapter sends valid progress after confirmed playback and any pending resume seek. Remove the extra progress sample bookkeeping used to detect elapsed playback. A first valid progress report can now create/reuse the session directly. Keep the existing completion guard and suppress trailing progress after ended until the next confirmed play, preventing duplicate ended/progress events from creating another session.

```text
Widget progress -> PlaybackStore.progress(showId, position)
                            |
                 unfinished entry exists?
                     /              \
                   yes              no
                    |                |
                  reuse         create + log
                     \              /
                      update + checkpoint

Pause / buffer / error / switch / clear / exit -> flush()
Reload -> load unfinished entry unchanged -> resume same entry
Widget ended -> complete(showId) -> completedAt -> one listen
Next confirmed play + progress -> new entry
```

Storage failures continue to leave playback working. If initialization cannot read history, disable tracking for that selection rather than overwrite unread history. No new dependencies, exports, configuration, or files are needed.

## Chunks and status

1. Contracts: simplified types, API, and call flow approved.
2. Implementation: updated the documented types, store, adapter, and page-exit caller. Removed elapsed accounting and automatic session closure. Added idempotent completion and suppression of trailing events. Replaced timing tests with completion, reload continuity, switch/clear continuity, and session-log coverage. Approved.
3. Verification: complete; awaiting final review. Live replay exposed a widget quirk: seeking from the end can restart audio without another play event or settling the seek promise. Replay sends seek and play in order without awaiting seek; progress confirms only the explicit current replay request. Regression tests cover the stalled promise, trailing pause/progress, and a superseding pause request. All 48 focused tests and 189 total tests pass, along with lint, Astro check (zero diagnostics), production build, IndexedDB browser checks, player navigation browser checks, and size budgets (87.7 KiB JavaScript gzip against 100 KiB). Architecture documentation is updated.

## Verification

- Starting from zero or midway and reaching the end records one completion.
- Seeking near the end and finishing counts once without elapsed-time accounting.
- Pause/resume, switch-away-and-back, clear/reselect, and reload/resume retain the same session and original startedAt/startPosition.
- Long unfinished playback counts zero; duplicate ended events count once; trailing progress after ended does not create a new session.
- Replay after completion creates a second session only when playback progresses.
- Retain coverage for invalid progress, five-second checkpoints, write ordering/retries, storage initialization failure, seek refusal/failure, rapid selections, and widget listener cleanup.
- Run focused store/adapter tests, then lint, Astro check, full tests, build, and browser persistence/navigation checks. Confirm new-session and resume logs reflect the new rules.

Live Chromium verification passed: an unfinished listen survived reload and resumed with its original session/start fields and no new-session log; seeking near the end and finishing produced one completion; replay created a second unfinished session and logged it once; subsequent pause/resume continued that second session. The checks used isolated browser storage on a separate preview port. Physical iOS and Firefox were not verified.

## Next action

Review the final verification chunk. No implementation work remains. On approval, archive or remove this task plan under the workflow's lifecycle rules. The user must clear existing playback data before testing the new format. Abrupt termination can lose progress since the last checkpoint; completion depends on the widget ended event.
