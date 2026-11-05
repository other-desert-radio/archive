# Playlists

Playlists are a local concept for now. In the future, we can consider them being moved to a remote server and kept there.

So, the way that playlists are built need to be future proof and transferable.

```ts
type Playlist = {
  id: uuid; // UUID so if we upload these to a server, the ID are unique
  title: string;
  createdAt: timestamp;
  lastUpdated: timestamp;
  shows: Array<{
    id: number; // show ID
    addedAt: timestamp;
    note: string | undefined; // short note users can add
  }>;
};
```

show's array is sorted by insert date. ordering isn't that important.
