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

### Route order matters

`apps/demo-material/src/app/app.routes.ts`, `apps/demo-tailwind/src/app/app.routes.ts`, `RESOURCE_ROUTES_SNIPPET` in `libs/cli/src/lib/generate-pages-bundle.ts`

Angular matches routes in order and `:resource` matches any single segment. More specific patterns (`:resource/create`, `:resource/:id/edit`) must come before `:resource/:id` and `:resource`, and fixed paths such as `login` must come before `:resource`, or they are captured by it.

### Action flags guard the resource routes

`apps/demo-material/src/app/can-match-resource-action.ts`, `apps/demo-tailwind/src/app/can-match-resource-action.ts`, its generated copy in `libs/cli/src/lib/generated-pages.ts`

`Resource.list`, `create`, `show`, `edit` and `delete` default to enabled when omitted. Each resource route has a `canMatch` guard. For a segment that is not a registered resource, the guard returns `false`, so an app route declared after the resource routes (such as `/settings`) can still match. For a registered resource whose action is disabled, it redirects to `RESOURCE_UNAVAILABLE_PATH` (`resource-unavailable`) with `skipLocationChange`, so `/products/create` with `create: false` does not fall through to the show route with `create` as an id. The path lives in one constant so an app can rename it if it clashes with its own routes. Flags control what the UI offers; they are not authorization, which stays with Row Level Security.

## Demo apps

### Local Supabase key

`apps/demo-material/src/environments/environment.local.ts`, `apps/demo-tailwind/src/environments/environment.local.ts`

The `sb_publishable_...` key in the `local` environment is the default key generated by `supabase start` against the unmodified `config.toml` of the `pidrang/supabase` repository. It is the same for every contributor, is only valid against `127.0.0.1` and requires the local Supabase containers to be running. It is not a secret, and secret scanners that flag it can be ignored for this file.

The key in `environment.ts` is the public anon key of the hosted demo project. It is meant to ship to browsers; what it can do is limited by Row Level Security on that project.
