# Indexed Database

This is a human written document about the indexed database to be used on the client archive page.

This is in service to the user playlists, playback history, and search history.

## Required updates

1. the `shows.json` file needs to be moved into the `public` folder so the front end can source from it.
2. all exported assets need to include a version number and an `updatedAt` field:

```json
{
    version: 1,
    updatedAt: {{ standard_ISO_date }}
}
```

3. version file
   to prevent fetching the whole show object when updating the cache

```json
{
    shows: {
        id: 1,
        updatedAt: {{ standard_ISO_date }}
    },
    djs: {
        ...
    },
    tags: {
        ...
    }
}

```

> data_versions.json

## IndexDB tables

1. Shows

this is a local cache of the shows json export. if the version on the server is the same as the local, dont save anything.

to prevent fetching all of the shows for this comparsion, maybe we should consider a versions json file. see Required Updates 3

2. Playlists

```json
[{
    id: number,
    title: string,
    createdAt: timestamp,
    shows: [{
        id: number,
        addedAt: timestamp,
        note: string // user generated note to appear next to show
    }]
}]
```

3. Currently Playing

```json
[{
    showId: number,
    duration: number,
    startedAt: timestamp
}]
```

4. playback history

```json
[{
    showId: number,
    duration: number,
    startedAt: timestamp
    finishedAt: timestamp
}]
```

Open: for playback in progress vs. playback conclcued, should that just be encoded via duration in Currently Playing?

if duration == show length, it's played.
if duration < show length, it's in progress.
