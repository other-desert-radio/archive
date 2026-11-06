# Future plan: shareable playlist URLs

Status: future work; not scheduled. Recorded 2026-11-06. This records agreed design intent, not implemented behavior or authorization to build.

## Goal

Make the address bar on each playlist page contain a shareable snapshot. Users can copy the current URL without a separate sharing step. Keep playlists stored locally and retain static hosting with no application server.

## Snapshot contents

Include a format version, playlist title, and ordered show IDs. Array order is the shared playback/display order.

```json
{"v":1,"title":"Late Night","shows":[215,42,108]}
```

Exclude notes, timestamps, local playlist type, and show metadata. Notes remain local and must never enter the encoded payload. Resolve show details from the recipient's catalog. The recipient's saved copy is a normal user playlist, including when the source is Liked Shows.

Proposed encoding: compact JSON → gzip → base64url without padding. Hashing alone cannot recover a playlist; a short lookup identifier would require server storage. Compression is not encryption and may increase size for very small payloads.

Proposed URL shape, respecting the configured base path:

```text
/archive/playlists/#id=<local-playlist-id>&share=<compressed-snapshot>
```

The local ID is a lookup hint; the snapshot is sufficient to display the playlist in another browser. Keep accepting existing `#<local-playlist-id>` links and upgrade their address-bar representation after the local playlist loads.

## Loading and editing

1. Parse the fragment and initialize local playlists before deciding whether its ID exists.
2. If a matching local playlist exists, use it as the source of truth, even when the URL snapshot differs. Otherwise, decode and preview the snapshot.
3. Viewing a snapshot must not create, overwrite, or modify a local playlist. Offer “Save a copy” to create a new local playlist with its own ID through PlaylistStore.
4. Once a local playlist is loaded, encode its title and ordered show IDs. Update the fragment with `history.replaceState()` after saved changes, preserving existing history state and avoiding new history entries or reloads.
5. Subscribe to PlaylistStore changes so additions, removals, ordering, and title edits refresh the address-bar snapshot. Note-only edits do not change the payload. Avoid encoding loops and redundant URL updates.
6. Handle fragment navigation, back/forward navigation, and Astro client navigation using the page's existing lifecycle. `replaceState()` does not emit `hashchange`; keep the displayed selection and URL synchronized explicitly.

Copied links are snapshots: later edits do not change older links, and copies cannot be revoked. An existing local playlist wins over a differing snapshot with the same ID; never merge them automatically. If a local playlist is deleted while open, show that state rather than silently restoring it from its URL snapshot.

## Recipient experience and failure handling

- Identify a shared preview as a snapshot and offer “Save a copy.” No account or server is required.
- Preserve ordered IDs for unavailable shows and indicate missing entries; do not silently discard them when saving a copy.
- Validate decoded data at the URL boundary: supported version, title, show IDs, and duplicate policy consistent with PlaylistStore. Render titles as text.
- Bound encoded input size, decompressed output size, title length, and show count before accepting a snapshot. Invalid, truncated, oversized, or unsupported payloads show a recoverable error without writing to storage.
- The fragment is not sent to the hosting server in HTTP requests, but anyone with the link can decode its contents. Excluding notes reduces exposure and link length.

## Implementation scope

- `src/pages/playlists/_PlaylistPage.tsx`: parse legacy and snapshot fragments; local-versus-shared selection; preview, save-copy, and URL synchronization.
- `src/stores/playlists/playlist-store.ts` and `types.ts`: reuse existing subscriptions and persistence operations; inspect ordering and creation contracts before changing anything.
- `src/components/playlists/PlaylistCard.tsx`: preserve local links; the destination page enriches the URL once loaded.
- A small playlist URL codec module with focused round-trip, validation, version, and size-limit tests. Choose its exact location during implementation.
- Existing playlist page/store tests and browser navigation coverage. Update architecture guidance only when behavior ships.

## Open implementation choices

- Measure representative playlists, including large collections, to choose practical URL and decompression limits. Excluding notes does not remove URL-length limits.
- Verify browser support and bundle impact before choosing the compression API; use platform capabilities when suitable.
- Confirm whether existing playlist array order is the intended shared order and whether a reorder UI already exists. Sharing order does not authorize building that UI.

## Future implementation checklist

- [ ] Inspect current page lifecycle, initialization, store operations, ordering, and tests.
- [ ] Implement and test the versioned codec with notes explicitly omitted and bounded decoding.
- [ ] Add legacy/local/shared loading and explicit save-copy behavior.
- [ ] Synchronize address-bar snapshots after persisted local changes.
- [ ] Verify reloads, local precedence, missing shows, deletion, malformed links, and storage failures.
- [ ] Verify navigation and copying a link into an independent browser context; measure real URL sizes.

No implementation has started. Select development mode when this feature is picked up, following the development workflow.
