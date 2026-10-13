# TypeScript conventions

These conventions adapt the backend TypeScript guidance to Astro components,
React components, and static-site data. The checked-in Biome and TypeScript
configuration are the source of truth when a rule is enforced automatically.

## Prefer type aliases

Use `type` aliases for object shapes, component props, unions, and other new
type definitions. Do not add new `interface` declarations.

```ts
type ArchiveEntry = {
	id: number;
	title: string;
};
```

Astro component props should be explicit and defined near the component:

```astro
---
type Props = {
	title: string;
	description?: string;
};

const { title, description } = Astro.props;
---
```

## Contracts and functions

Use meaningful parameter and return types at public module boundaries when
helpful; infer local values where that improves readability. Use generics only
for an actual shared contract. Avoid `any` without a justified integration
reason, unsafe casts and unnecessary non-null assertions; narrow or validate
values instead.

Give functions one understandable responsibility and consistent names across
the call chain. Prefer simple functions over classes unless state,
encapsulation or existing conventions justify a class. Make dependencies and
data flow explicit through parameters or existing dependency-injection
patterns; keep hidden state and side effects minimal. Separate pure transforms
from I/O where useful, without adding needless helpers, files or layers.

Reuse existing modules, patterns and dependencies before introducing new
abstractions. Preserve architectural decisions unless a concrete requirement
justifies a change. Propagate errors to the boundary that can handle them;
catch only to recover or add useful context, never to silently report success.
Prefer readable code over cleverness or speculative flexibility.

## Make finite states explicit

Use braces for conditional branches, including early returns and `continue`.
Keep the condition and its body on separate lines rather than writing a
single-line guard:

```ts
if (this.disposed) {
	return;
}
```

Use discriminated unions for component state and `switch` statements when
branching over a finite set of known cases. This keeps loading, empty, error,
and success states visible in the type system and makes new cases harder to
forget.

```ts
type LoadState =
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "ready"; entries: ArchiveEntry[] };
```

Use exhaustive handling where practical. Keep the data and the branch that
renders it together instead of passing loosely typed flags through several
components.

## Respect optional values

Use bracket access for CSS module classes, such as `styles["image"]`. Their
types use an index signature, and `noPropertyAccessFromIndexSignature` requires
this syntax. Biome's `useLiteralKeys` rule is disabled so formatting preserves it.

Prefer `undefined` and optional properties when a value is absent. Do not add
`null` as a second representation of absence without an integration reason.
When data comes from an API, CMS, or content source that uses `null`, normalize
it at that boundary before passing it through the site.

Do not use unchecked casts to make external data fit a type. Validate or
normalize external data at the boundary, then keep internal component props
strongly typed. Use `unknown` when the shape is not yet trusted.

Use `ts-pattern`'s `isMatching` and `P` patterns for runtime validation of
external JSON when the dependency is available. This validates the value and
narrows its TypeScript type in the same branch.

```ts
import { isMatching, P } from "ts-pattern";

const entryPattern = P.array({ id: P.number, title: P.string });

if (!isMatching(entryPattern, data)) {
	throw new Error("Archive data has an unexpected format.");
}
```

## Keep module boundaries intentional

Import shared components and helpers from stable module paths. A barrel
`index.ts` is appropriate for a coherent public module with multiple exports,
but it is not required for every directory. Prefer direct imports for a small
private component or when a barrel would obscure ownership or create a cycle.

Do not copy backend-only patterns into the site automatically. Fastify route
generics, Kysely database types, and PostgreSQL `NULL` handling belong at
their respective integration boundaries. Add an equivalent site convention
only when the site gains that kind of boundary.

## Label interactive components

Always include an `aria-label` when building an interactive component, such as
a link, button, input, or custom control. Make the label describe the action
or destination, rather than relying on visual context alone.

```tsx
<a href={detailUrl} aria-label={`View ${title}`}>
	{title}
</a>
```

## Tag sizing

`TagContainer` and both React and Astro `TagView` components require an explicit
`size: "normal" | "large"` prop. Archive cards and DJ detail pages use `normal`; show detail
pages use `large`, which adds `tag-large` alongside the base `tag` class.
