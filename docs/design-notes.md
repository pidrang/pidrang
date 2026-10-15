# Design notes

The source code contains no comments, so the reasons behind non-obvious choices are recorded here. Each note names the file where the choice lives.

## Core

### `injectAuthProvider()` throws its own error

`libs/core/src/lib/inject-pidrang.ts`

`AUTH_PROVIDER` is an optional token: not every app configures authentication. `injectAuthProvider()` therefore injects it with `{ optional: true }` and throws a Pidrang-specific message (`no auth provider configured, pass authProvider to providePidrang()`) instead of letting the caller hit a generic dependency injection error or a silent `undefined`. Follow the same pattern for any new optional provider.

### `injectResource(name)` throws on an unknown name

`libs/core/src/lib/inject-pidrang.ts`

A typo in a resource name should fail at the call site, not surface later as a confusing runtime error somewhere else. Lookup helpers in core throw instead of returning `undefined`.

### `injectResourceList` accepts a reactive resource name

`libs/core/src/lib/resource-list.ts`

It wraps `DataProvider.getList` in Angular's `resource()` so callers get `value`, `status`, `error` and `reload` as signals without depending on any UI layer. The resource name may be a function (for example a route parameter signal) so one component instance reused across resources still reloads. Returning `undefined` from the `params` function skips loading, which is `resource()`'s own convention.

### `Field.readOnly`, `nullable` and `hasDefault` replace name-based exclusion

`libs/core/src/lib/field.ts`, `libs/demo-shared/src/lib/resource-create-state.ts`, `resource-edit-state.ts`

`resource-create-state.ts` and `resource-edit-state.ts` used to hardcode `NON_EDITABLE_FIELDS = new Set(['id', 'created_at'])` to keep server-generated columns out of create/edit forms. That breaks for any table whose generated columns are named differently, and it cannot express "generated but still worth showing" separately from "never show." `readOnly` now carries that decision as schema metadata, so any `Resource` (hand-written, like `demo-resources.ts`, or produced by `pidrang init`) must set it on every column the database generates or defaults, or that column becomes editable. `readOnly` stays independent of `hidden`: `hidden` is a list/edit display choice (added for #6), `readOnly` is a write-eligibility choice; a column can be shown on the show page and never writable, or writable but absent from the list. `nullable` and `hasDefault` are consumed by `ResourceForm` (see the UI layers note below), not by the state layer, which only ever sees the final payload.

## Supabase

### `as never` casts in `create` and `update`

`libs/supabase/src/lib/supabase-data-provider.ts`

Without a typed Supabase `Database` schema, `postgrest-js` cannot unify its expected insert and update row type with the unconstrained generic `T` of `DataProvider`. `never` is the narrowest cast that compiles. Removing it properly means adding real `Database` typing support, which is a separate change; do not replace it with `any` or a wider cast.

### Every table needs an `id` primary key

`libs/supabase/src/lib/supabase-data-provider.ts`

`getOne`, `update` and `delete` filter on `id`. Composite or differently named keys are not supported. This is an intentional scope limit, not an oversight.

### `contains` uses `imatch`, not `ilike`

`libs/supabase/src/lib/supabase-data-provider.ts`, `escape-regex.ts`

`contains` must match every character literally. With `ilike`, `%` and `_` are wildcards, and PostgREST also turns `*` into `%`, so a search for a literal `*` cannot be written at all. `imatch` (Postgres `~*`, case-insensitive regex) with every regex metacharacter escaped matches the text as typed; the conformance cases for `%`, `_`, `*` and `.` hold it to that. The cost: like `ilike '%…%'`, a regex search cannot use a btree index, so it scans the table. On a large table, add a trigram index, which serves `~*`: `create extension if not exists pg_trgm; create index on <table> using gin (<column> gin_trgm_ops);`.

## UI layers

### `ResourceForm` looks up fields by runtime name

`libs/material/src/lib/resource-form/resource-form.ts`, `libs/tailwind/src/lib/resource-form/resource-form.ts`

The field name comes from the runtime `Resource.fields` schema, not from the keys of `T`, so it cannot be typed against the form model without losing the dynamic behavior the `fields` input exists for. `fieldTree(name)` therefore casts the model to a record of fields.

### Material warn color

`apps/demo-material/src/theme.scss`

The `color="warn"` support of `mat.theme()` only covers Material 2 compatible themes. With a Material 3 theme the warn palette has to be declared again, scoped to `[color='warn']`, for buttons to render red.

### `timestamp`, `time`, `numeric` and `date` stay text, never `Date` or `Number`

`libs/core/src/lib/field.ts`, `libs/core/src/lib/field-presentation.ts`, `libs/core/src/lib/resource-form-payload.ts`, `libs/material/src/lib/resource-form/resource-form.ts`, `libs/tailwind/src/lib/resource-form/resource-form.ts`

A `timestamptz` rendered through `<input type="date">` silently drops its time of day, and a `bigint`/`numeric` column read through `JS` `Number` silently loses precision past 2^53 or past what a `double` can hold exactly. `timestamp`, `time`, `numeric` and `date` are therefore all bound to a plain `<input type="text">`, never a native `date`/`number` input, so a touched value round-trips byte for byte. `date` used to keep its native `<input type="date">`; it was moved into the same text-bound group because that native input let Signal Forms hand back a `Date` instance instead of a string (see below). Format validation is attached with Signal Forms' `pattern()`, not hand-written parsing: `formatPatternForField()` (in core, shared by both UI layers instead of each keeping its own copy) holds one regex per type — tightened to real calendar/clock bounds (hour `00`–`23`, minute/second `00`–`59`, month `01`–`12`, day `01`–`31`), not just digit counts, so `2024-99-99T99:99` is rejected instead of accepted — and `fieldError()` turns a failed match into a plain-English hint next to the field.

Binding the input to `type="text"` is not enough by itself: Signal Forms chooses how to parse a native input event by inspecting the field's _current value_, not the DOM element's `type` attribute. A `numeric` field whose loaded value happens to be a JS `number` (which is exactly what it is: PostgREST serializes `numeric`/`int8` as a bare, unquoted JSON number — see the CLI note below) gets every subsequent keystroke parsed back through `Number()`, silently reproducing the precision loss the whole `numeric` type exists to avoid; a `date` field starting from `null` similarly came back as a `Date` object once typed into, and a `null` text-bound field never even registered as `dirty()` when typed into (Angular logged `NG01921`, "text inputs should use empty strings to represent null values"). None of this is documented by Signal Forms' types — it was found by writing a failing test against the exact shape real data arrives in (`{ amount: 1 }`, not `{ amount: '1' }`), not by reading the `.d.ts` files. `normalizeResourceValue()` (`resource-form-payload.ts`) fixes it at the boundary: building `draft` from `value()` coerces every text-bound field's value to a string (`''` for `null`/`undefined`) before Signal Forms ever sees it, so the field's value type is always `string` and native parsing never kicks in.

The validators are attached through `applyEach(path, (child) => { pattern(child, ...); required(child, ...); })` instead of a loop over `this.fields()` inside the schema callback. `form()`'s schema callback runs once, synchronously, while the component is still being constructed, before Angular has bound its required inputs (`fields`, `value`) — reading `this.fields()` there throws `NG0950`. `applyEach` attaches one schema entry to every key of the dynamic record without needing to know the keys up front, and both validators' second argument accepts a reactive function instead of a literal value, so `this.fields()` is only read later, each time Signal Forms actually validates a field, by which point the inputs are bound.

`pattern()` alone does not catch an emptied field: Signal Forms treats an empty value as vacuously matching any pattern, the same way HTML's own `pattern` attribute does. A cleared `timestamp`/`time`/`numeric`/`date` field, if the column does not allow `null`, used to pass client-side validation and then fail with a raw Postgres error. `required()` is attached alongside `pattern()`. Its `when` is not just `fieldRequiresValueWhenEmpty(field)` (true for those four types when `!field.nullable`) — it is `!field.hasDefault || ctx.state.dirty()`. A `hasDefault` field left untouched must never be required: it starts at its blank seed value precisely because the client does not know the real default, and on create that untouched state is what tells `buildResourcePayload()` to omit it and let the server's default apply (see below) — requiring it would block every create on that column. Once the user actually dirties a `hasDefault` field, though, `required()` applies again: clearing a field the server would otherwise default is a deliberate edit, not "leave it alone", and an empty value sent at that point would still fail server-side. `ctx.state.dirty()` is read live inside the validator, so the same rule holds for a field dirtied and then cleared back to empty. When the field genuinely is `nullable`, `buildResourcePayload()` converts the text input's `''` to `null` before it reaches the server.

Blocking submit is mode-dependent (`shouldBlockSubmit()` in core): on create, nothing pre-exists yet, so any invalid field blocks, including one the user never touched (otherwise a required field left at its blank seed value would silently submit). On edit, only a field the user actually touched blocks — an untouched, pre-existing invalid value from legacy data must not block an otherwise unrelated save. A blocked submit attempt calls `markAsTouched()` (Signal Forms' own `FieldState` method) on every blocking field, and `fieldError()` shows its hint on `dirty() || touched()`, not `dirty()` alone — otherwise a required field left at its blank seed value blocked `Save` with no visible explanation anywhere on the page.

Payload trimming (`buildResourcePayload()`) sends a touched field on create as much as on edit, and leaves an untouched one out, with one create-only exception described at the end of this paragraph. An earlier version of this omitted a field on create only if it had `hasDefault`, sending every other untouched field at its placeholder seed value (`''`/`0`/`false` from `defaultValueForField()`). That let an untouched, nullable, no-default `text` field reach the server as `""` instead of `NULL` on create — a real bug, since nothing about `''` says "I was never touched," and the client-side placeholder was never a value the user actually chose. The fix removed the asymmetry instead of special-casing nullable fields further: on create as on edit, an untouched field — whatever its `hasDefault`/`nullable` combination — is left out entirely (apart from the create-only `boolean`/`number` exception below), and the database decides what an absent column means (its default, `NULL`, or a `NOT NULL` violation the server reports). An edit where nothing was actually touched produces an empty payload; `onSubmit()` does not call `save.emit()` for mode `'edit'` when that happens, since PostgREST's `.single()` errors on an empty `PATCH` body. Create keeps emitting an empty payload, though — "create a row from nothing but defaults" is still a legitimate action with no pre-existing row to fail against. Sending only touched fields is not just cosmetic: a `numeric`/`bigint` value already arrives from the server JSON-parsed, so by the time it reaches the form it may already have lost precision past `Number`'s safe range (see the normalization note above); re-sending an untouched field on every save would re-serialize that already-lossy value a second time, while an untouched value is now never touched by `JSON.stringify` at all. `ResourceForm` also filters out any `readOnly` field itself, from rendering, from submit blocking and from the payload — it does not just trust that `resource-create-state.ts`/`resource-edit-state.ts` already filtered `fields`, since a consumer that passes the full, unfiltered schema should still not be able to send a read-only column by accident, nor have Save blocked with no visible message by a read-only column it never rendered. `ResourceForm` takes a required `mode: 'create' | 'edit'` input, used by `shouldBlockSubmit()`, the empty-payload-on-edit check and `buildResourcePayload()`. The exception: on create, an untouched `boolean` or `number` without `hasDefault` is sent as shown. An unchecked box reads as `false` and a number input shows its `0` seed, both real answers, not an absence: leaving them out made a `not null` column with no default fail the insert although the form showed a value, and stored `NULL` in a nullable one. An empty text-bound field shows nothing, so leaving it out still matches what the user saw. It is create-only: on edit the box shows the loaded value, re-sending it would make every untouched save a `PATCH` instead of a no-op, and on a column the user cannot update it would fail the same way an untouched `created_at` used to. `save` emits `Partial<T>`, not `T` — on edit (and now on create too) it genuinely can be a partial, and typing it as a full `T` would let a caller write `value.name.toUpperCase()` against a field that was never sent.

A field with `hasDefault` shows its placeholder seed value on create (`defaultValueForField()` in `resource-create-state.ts`), not the database's real default, which the client does not know. Showing it as an ordinary editable value would misleadingly suggest it is what gets saved. `fieldHint()` adds "Leave unchanged to use the database default." under the field (as a `<mat-hint>`/`<span>`, next to `fieldError()`, never both at once) whenever `hasDefault` is set and the field is still untouched.

### `ResourceForm` is remounted per resource and per record, not reused

`apps/demo-material/src/app/pages/resource-create-page.ts`, `resource-edit-page.ts`, `apps/demo-tailwind` equivalents

The generic `:resource/create` and `:resource/:id/edit` routes are matched by the same route config regardless of which resource or id is in the URL, so Angular's router reuses the page component instance across a navigation between them — only its `resource`/`id` inputs change, the component (and everything inside it) survives. `ResourceForm`'s `model = form(this.draft, ...)` is created once, in a field initializer, the first time the component is constructed; Signal Forms keeps each field's `dirty`/`touched` state keyed by field name across the model's lifetime. Navigating `/products/create` → `/orders/create` (or editing one product, then another) without recreating `ResourceForm` therefore left a same-named field (e.g. `status`) marked `dirty` from the previous resource or record, which could make an untouched field on the new one get sent as if the user had edited it. Each page wraps `<lib-resource-form>` in `@for (r of [key]; track r) { ... }`, keyed on `resource()` (create) or `` `${resource()}:${id()}` `` (edit): changing the key changes what `@for` iterates, so Angular destroys and recreates the view — and the `ResourceForm` component inside it, with a fresh `model` — instead of patching it in place.

## CLI

### Introspecting Supabase through GraphQL

`libs/cli-supabase/src/lib/graphql-schema-provider.ts`

`pg_graphql` exposes each table as a Relay-style `<table>Collection` field on `Query`, returning `{ edges { node { ...columns, nodeId } } }`. In the introspection result, `edges` is wrapped as `NON_NULL(LIST(NON_NULL(OBJECT)))` and `node` as `NON_NULL(OBJECT)`, and `__Type.fields` is only populated for `OBJECT` and `INTERFACE` kinds (it is `null` on every wrapper). Reaching the columns therefore needs `fields` requested again after each `ofType` unwrap: Query, Collection, edges, Edge, node, Node, columns.

GraphQL has no recursive query syntax, so the query is generated to a fixed depth (8), enough to cover that path with margin. `unwrapObjectFields` walks `ofType` until it finds a level where `fields` is populated.

### The three schema providers split number/numeric and date/timestamp/time the same way

`libs/cli-supabase/src/lib/postgres-field-type.ts`, `service-role-field-type.ts`, `graphql-field-type.ts`

Each strategy used to fold every Postgres date/time type into `FieldType.date` and every integer/float/bigint/decimal type into `FieldType.number`. A `bigint` primary key (`id` included) then passed through `JS` `Number`, and a `timestamptz` column lost its time of day in the form (see the UI layers note on `timestamp`/`time`/`numeric`). The three mappers now agree on the same split: safe-precision integers and floats stay `number`; `bigint`, `decimal` and `numeric` map to `numeric`; `date` stays `date`; every `timestamp`/`timestamptz` variant maps to `timestamp`; every `time`/`timetz` variant maps to `time` — including the long-form `time without time zone`/`time with time zone` that `service-role-field-type.ts` originally missed (its `TIMESTAMP_FORMATS` had both forms; `TIME_FORMATS` did not). Postgres groups these by type name, PostgREST's OpenAPI schema by `format` string, and `pg_graphql` by scalar name (`BigInt`/`BigFloat`, `Datetime`, `Time`), so each mapper keeps its own lookup tables but the same three-way split.

This is why `postgres-schema-provider.spec.ts`'s fixture for a `bigint` `id` column expects `FieldType.numeric`, not `number`: a `bigint`/`numeric` value already risks losing precision the moment PostgREST's JSON response is parsed (Postgres's own `to_json` writes it as a bare, unquoted JSON number literal, which `JSON.parse` then rounds to a `double`), so treating it as `numeric` end to end (schema, form, payload) at least stops the client from rounding it a second time. (An earlier version of this note claimed PostgREST returns `int8`/`bigint` as JSON _strings_ — that is `pg_graphql`'s behavior, which serializes `BigInt`/`BigFloat` scalars as strings per the GraphQL spec; the two Supabase layers disagree here, which is exactly why `ResourceForm` cannot rely on the wire shape and instead always treats `numeric` as a string it never parses, see the UI layers note above.)

### `readOnly`, `hasDefault` and `nullable` are detected per strategy, to the extent each one can see them

`libs/cli-supabase/src/lib/postgres-schema-provider.ts`, `service-role-schema-provider.ts`, `graphql-schema-provider.ts`

`generate-resources-file.ts` emits `readOnly`, `nullable` and `hasDefault` for a generated column whenever the `Field` carries them, the same way it already did for `hidden`. Leaving every strategy's `introspectTable` returning bare `{ name, type }` meant a table generated by `pidrang init` always came out with its primary key and generated columns editable: the create form then posted an empty `id`/`created_at`, which PostgREST rejects with a `22007` error on a column that cannot take an empty string. Each strategy now sets what it can actually see, rather than all guessing the same hardcoded `id`/`created_at` fallback:

- **Postgres** (`postgres-schema-provider.ts`) has a live connection, so it is exact: `information_schema.columns` is queried for `column_default`, `is_nullable`, `is_identity`, `identity_generation` and `is_generated` alongside `data_type`. `readOnly` is the already-known primary key column, any column with `is_generated = 'ALWAYS'` (a true `GENERATED ALWAYS AS (expr) STORED` column), or any column with `identity_generation = 'ALWAYS'` (`GENERATED ALWAYS AS IDENTITY`, which Postgres rejects an explicit insert value for even on a non-primary-key column — a `GENERATED BY DEFAULT AS IDENTITY` column stays writable, matching Postgres' own distinction). `hasDefault` is a non-null `column_default` or `is_identity = 'YES'`; `nullable` is `is_nullable = 'YES'`.
- **Service role** (`service-role-schema-provider.ts`) only has PostgREST's generated OpenAPI definition. `readOnly` reuses the `<pk/>` marker already parsed out of the column `description` to find the primary key. The first version of this rule assumed `definitions.<table>.required` meant "no default" and derived `hasDefault` from it — checked against the real local stack, that assumption was wrong: PostgREST's `required` array lists every `NOT NULL` column, default or not (`price numeric(10,2) not null default 0` is still `required`), and each property instead carries its own `default` key (`"default": "now()"`, `"default": 0`) when the column has one. So `hasDefault = 'default' in property`, independent of `required`; `nullable = !required.includes(name)`, which is exactly what `required` does mean on its own. Trusting the array's name instead of a real response was the mistake; both signals are reliable once read this way.
- **GraphQL** (`graphql-schema-provider.ts`) only has `pg_graphql`'s introspection of the `<table>Collection` node type. `nullable` is read directly off whether the field's type is wrapped in `NON_NULL`. `readOnly` is set for the `id` field only — the one column every strategy already requires to exist and be the primary key — since `pg_graphql`'s `Node` type does not expose which other columns are generated. `hasDefault` is left undetected: pg_graphql does not expose column defaults on the `Node` type (a sharper signal would mean also introspecting the `<Table>InsertInput` type and checking which of its fields are optional, which is follow-up work, not done here). A defaulted, non-nullable column introspected through this strategy alone therefore still becomes a required input on create — a real, acknowledged gap, not something the `required()`/`hasDefault` interaction above can paper over when the schema layer itself never learned about the default.

Nothing publishes to npm yet, so no running consumer was affected by the gap, but it is now closed for the common case (the primary key, and any Postgres- or service-role-detectable default) across all three strategies, with GraphQL's `hasDefault` gap documented above rather than silently assumed.

### Generated pages copy `apps/demo-material`

`libs/cli/src/lib/pages-bundle-sources.ts`, `libs/cli/src/lib/build-pages-bundle.ts`, `libs/cli/src/lib/generated-pages.ts`, `tools/sync-generated-pages.ts`

The pages written by `pidrang init` are the generic pages of `apps/demo-material`. They are resource-agnostic and shared by every table, so they are generated once, not per table. `pages-bundle-sources.ts` lists which source file becomes which generated file, and `pnpm run sync:pages` rewrites `generated-pages.ts` from those sources. The published CLI only ships `generated-pages.ts`, so it never reads a repository file at run time. After changing a source page, run `pnpm run sync:pages`: the parity test in `generate-pages-bundle.spec.ts` (and `pnpm run sync:pages --check`) fails while the generated file is out of date.

## Routing

### The sign-in link points only to a path the app provides

`libs/demo-shared/src/lib/sign-in-path.ts`, `parse-sign-in-path.ts`, `provide-sign-in-path.ts`, `sign-in-url.ts`; the demos' own route is `sign-in-route.ts`

Generated pages cannot know where a consumer app signs users in, so `SIGN_IN_PATH` defaults to `null` and the pages then say "sign in" as plain text rather than linking to a route that may not exist. Unlike `injectAuthProvider()`, nothing throws when it is missing: no sign-in page is a valid setup. `provideSignInPath` parses the path once, when the app config is built, and the token holds the result, so a malformed value stops the app at startup instead of breaking every page, and pages only read it. It parses with `DefaultUrlSerializer` because it runs before any injector exists. The path is kept as a `UrlTree` resolved from the root: a string `routerLink` would be relative to the current page (`/products/login`). External URLs, `.`/`..` segments, surrounding spaces and the `/your-sign-in-route` placeholder `pidrang init` prints are refused with a clear message; serializing the `UrlTree` already makes every href root-relative, so these refusals are readable errors, not the security boundary. A well-formed path to a route that does not exist cannot be detected there. Dot segments are checked on the parsed segments, after decoding, so `%2e%2e` is refused too. The path is validated with the default serializer, while `RouterLink` renders it with the app's own `UrlSerializer`, so an app with a custom serializer gets the href that serializer writes. The token lives in demo-shared and is copied into apps, not in `@pidrang/core`, which must not depend on the router. Each piece is its own file, following the code style's one export per file.

### `pidrang init` reports kept files by comparing content

`apps/pidrang-cli/src/find-changed-files.ts`, `find-stale-sign-in-files.ts`

`pidrang init` never overwrites a file, so an app generated by an older version keeps its old pages. It lists the kept files whose content differs from what it would write now (ignoring Windows line endings, but not reformatting by the app's own Prettier, which then shows as a difference). Among them, a page or helper whose current version mentions the sign-in URL but whose kept copy does not comes from before #77: it is named separately, because it keeps its `/login` link whatever the app provides, and the advice is to delete `src/app/pages` and `src/app/pidrang` together, since current pages need current helpers.

### Route order matters

`apps/demo-material/src/app/app.routes.ts`, `apps/demo-tailwind/src/app/app.routes.ts`, `RESOURCE_ROUTES_SNIPPET` in `libs/cli/src/lib/generate-pages-bundle.ts`

Angular matches routes in order and `:resource` matches any single segment. More specific patterns (`:resource/create`, `:resource/:id/edit`) must come before `:resource/:id` and `:resource`, and fixed paths such as `login` must come before `:resource`, or they are captured by it.

### Action flags guard the resource routes

`libs/demo-shared/src/lib/can-match-resource-action.ts`, its generated copy in `libs/cli/src/lib/generated-pages.ts`

`Resource.list`, `create`, `show`, `edit` and `delete` default to enabled when omitted. Each resource route has a `canMatch` guard. For a segment that is not a registered resource, the guard returns `false`, so an app route declared after the resource routes (such as `/settings`) can still match. For a registered resource whose action is disabled, it redirects to `RESOURCE_UNAVAILABLE_PATH` (`resource-unavailable`) with `skipLocationChange`, so `/products/create` with `create: false` does not fall through to the show route with `create` as an id. The path lives in one constant so an app can rename it if it clashes with its own routes. Flags control what the UI offers; they are not authorization, which stays with Row Level Security.

## Demo apps

### `price` and `total` stay `number`, and keep no `hasDefault`

`libs/demo-shared/src/lib/demo-resources.ts`, `pidrang/supabase/supabase/migrations/20260914123253_create_demo_tables.sql`

Both columns are declared `numeric(10, 2) not null default 0`, which makes them a candidate for `FieldType.numeric` and `hasDefault: true` by the rules above, but `demo-resources.ts` keeps them `number` with no `hasDefault`, deliberately:

- `numeric(10, 2)` never exceeds 8 integer digits and 2 decimal ones, which a `double` represents exactly; the precision risk `numeric` exists for does not apply here. The three schema providers still map every Postgres `numeric`/`decimal` column to `FieldType.numeric` unconditionally, because `information_schema.columns.data_type` does not carry precision or scale without a further join they do not do today, so a generic, undetected column is treated as unsafe by default. A hand-written `Resource`, which knows the real precision, can make the safer call directly; this is that call, not an inconsistency.
- The `default 0` on both columns is a `not null` safety net, not a value either field should be allowed to default to silently. Price and order total are the values these tables exist to record, so neither shows the "Leave unchanged to use the database default." hint: `hasDefault` is reserved for a column the server, not the user, is expected to own, such as `created_at`. Without `hasDefault`, an untouched price or total is sent as the `0` the form shows (see the payload note above), which is the same value the `default 0` would give.

### The save lock keeps only running saves, with a 30-second timeout

`libs/demo-shared/src/lib/save-lock.ts`, `save-store.ts`

The create and edit pages lock a record while it is saved, across visits, so the user cannot send a second write that could land before the first. The lock lives in a root store, `SAVE_STORE`, that holds only the saves still running: a save removes its record when it settles. A page waiting on someone else's save keeps a reference to that save's entry, so it can still read the outcome after the entry left the store; the entry is collected with the page.

A request that never answers would leave every page of its record waiting with no explanation, so the provider call races a 30-second timer. On timeout the record stays locked, since the write may still land, but every page of that record, including one the user opens later, shows a message saying the save may still be applied above a form that stays disabled, so what the user typed is kept. When the request finally answers, its entry leaves the store, the form comes back and the page says whether that earlier save finished or failed; an edit page reads the record again after a success and keeps what was loaded after a failure. The late answer never opens the next page. The store therefore holds only requests in flight. A request that never settles (a `fetch` has no default timeout, a custom provider may retry forever) keeps its record locked until the page is reloaded, which the message says. The 30 seconds are a constant in the copied `save-lock.ts`: an app whose writes legitimately take longer edits it there. The timeout covers the request only. The navigation that follows keeps the lock until it ends, and a pending navigation ends as soon as another one starts.

The save is recorded as done as soon as the request succeeds, before the next page opens, so a failure in that step is never reported as a failed save to the pages waiting on it. A next page that does not open is reported only when no other navigation replaced it: the router resolves a replaced navigation with `false` too. A create page then shows "Created." instead of its draft, in case that other navigation is cancelled and the user stays.

The store counts session changes reported by the optional `AuthProvider.onSessionChange`. A save started in an earlier session is not reported to a page that was waiting on it, so the next user in the same tab never sees the previous user's error. The lock itself is kept until the save settles, and the page that started the save always shows its own result: hiding it could hide an expired-session error or let a create be sent twice. Supabase reports `USER_UPDATED` for the same user as a session change too, and delivers the event in a `setTimeout`, so a save settling in that same tick still shows its outcome; both are accepted. Without an auth provider nothing is hidden. The store is created in the root injector, so it only sees an `authProvider` passed to `providePidrang` at the root, as the demos and generated apps do; one provided in a lazy route is not seen.

A page learns that an earlier save ended by seeing its "waiting" state go from true to false. The `linkedSignal`s behind it only notice that change when they are read, so a template must read `earlierSave.failure()` and `earlierSave.finished()` on every render, as the shipped pages do, not only under a condition.

The list pages use the same lock for delete, keyed on the resource: one delete runs at a time per resource, as before within a page, but the lock now holds across visits. After A → B → A, or on a list page opened while a delete of that resource runs, every delete button stays disabled and the page says a delete is still running; when it settles, the page says whether it finished or failed (with the same not-allowed or sign-in explanation as its own failures) and reads the list again after a success, or when the outcome is hidden because the session changed. The page that started the delete shows its own failure only while it is still open, on the same resource and in the same session, and a delete message already shown, its own or an earlier one, disappears when the session changes; the list is still read again after a success that settles in a new session. A delete that times out keeps the buttons disabled with a delete-specific message until the server answers. Two limits are shared with create and edit: an outcome is shown only to a page that was waiting when the operation settled, so a delete that finishes while the user is elsewhere is not reported (the list read on return shows its effect), and the key names the resource only, so two `DataProvider`s exposing the same resource name in one app share one lock.

`hold` refuses a record that is already being saved, and a settling save only removes its own entry, so code calling `injectSaveLock` directly cannot unlock a newer save.

When the save succeeds but the next page fails to open, the error goes to Angular's `ErrorHandler` in a `setTimeout`, outside the save: an app whose `ErrorHandler` rethrows would otherwise turn a saved record into a reported save failure.

### Local Supabase key

`apps/demo-material/src/environments/environment.local.ts`, `apps/demo-tailwind/src/environments/environment.local.ts`

The `sb_publishable_...` key in the `local` environment is the default key generated by `supabase start` against the unmodified `config.toml` of the `pidrang/supabase` repository. It is the same for every contributor, is only valid against `127.0.0.1` and requires the local Supabase containers to be running. It is not a secret, and secret scanners that flag it can be ignored for this file.

The key in `environment.ts` is the public anon key of the hosted demo project. It is meant to ship to browsers; what it can do is limited by Row Level Security on that project.
