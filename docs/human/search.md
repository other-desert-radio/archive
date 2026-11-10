# Search

Search for explore page, DJs page, shows page, playlist detail page.

There is no global search.

Search bar will live undernearth the Category tabs (for now).

it should compress on scroll. maybe on desktop it should go to the right hand side of the compressed category tabs.

to be determined.

it will have a 2px border black, transparent background, and placeholder text that "SEARCH..."

## Architecture

1. new files
   components/
   search/
   searchbar.tsx
   searchbar.module.css
   // logic files
   index.ts

2. logic

the components we need to search are powered by stores.

Store<T> { getAll(): T[] }

Search<T> { query(search: string): T[] }

if search could be a generic component that returns an array of the type it was given, that'd be ideal.

internally, search will have a transform function which will take in all the elements, stringify them by pulling out specific fields, and search on that.

maybe, in that case it'd be better to have search have access to all the stores instead of reinitializing it? i'm not sure what's best in the react world

```ts

<SearchBar value={query} onChange={setQuery} />

  function filterSearch<T>(
    items: readonly T[],
    query: string,
    getText: (item: T) => string,
  ): readonly T[]
```
