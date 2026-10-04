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

## CLI

### Introspecting Supabase through GraphQL

`libs/cli-supabase/src/lib/graphql-schema-provider.ts`

`pg_graphql` exposes each table as a Relay-style `<table>Collection` field on `Query`, returning `{ edges { node { ...columns, nodeId } } }`. In the introspection result, `edges` is wrapped as `NON_NULL(LIST(NON_NULL(OBJECT)))` and `node` as `NON_NULL(OBJECT)`, and `__Type.fields` is only populated for `OBJECT` and `INTERFACE` kinds (it is `null` on every wrapper). Reaching the columns therefore needs `fields` requested again after each `ofType` unwrap: Query, Collection, edges, Edge, node, Node, columns.

GraphQL has no recursive query syntax, so the query is generated to a fixed depth (8), enough to cover that path with margin. `unwrapObjectFields` walks `ofType` until it finds a level where `fields` is populated.

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

### The demos' sign-in runs one at a time

`libs/demo-shared/src/lib/sign-in.ts`, `sign-in-state.ts`

The sign-in form submits natively, so Enter in either field signs in. While a sign-in runs, a root state, `SIGN_IN_STATE`, disables the form and the demo-account button on every visit of the page and shows "Signing in…". Supabase saves the session of each successful sign-in as it answers, so two sign-ins in flight could end on the older account; one at a time prevents that. Both demos call the same `injectSignIn()`. The lock is released when the request settles, not when the page is left, and a page left before then does not navigate. A failure is kept in the same root state, so a visit that came back while the sign-in ran shows it; it is kept only when a sign-in page is open to show it, and cleared by the next attempt, by a success, and when the last open sign-in page is left, so a later visit never shows an old error. A session change (another tab signing in, a sign-out) clears it too, and a failure from before that change is dropped. After 30 seconds without an answer, the page says to reload it and keeps the form disabled: a late answer would still change the session, so the lock is never released early, but reloading is a safe way out, since the session is saved by the page's own script and a reload drops the request before its answer is saved. The demos' sign-in page is not part of what `pidrang init` generates.

### Local Supabase key

`apps/demo-material/src/environments/environment.local.ts`, `apps/demo-tailwind/src/environments/environment.local.ts`

The `sb_publishable_...` key in the `local` environment is the default key generated by `supabase start` against the unmodified `config.toml` of the `pidrang/supabase` repository. It is the same for every contributor, is only valid against `127.0.0.1` and requires the local Supabase containers to be running. It is not a secret, and secret scanners that flag it can be ignored for this file.

The key in `environment.ts` is the public anon key of the hosted demo project. It is meant to ship to browsers; what it can do is limited by Row Level Security on that project.
