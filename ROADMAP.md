# Roadmap

Progress tracker for Pidrang. See `CLAUDE.md` for the architecture rules and per-package details behind each item.

| # | Phase | Status |
|---|-------|--------|
| 1 | `@pidrang/core` — contracts, `providePidrang`, signal-based resource state | Done |
| 2 | `@pidrang/supabase` — `SupabaseDataProvider`, `provideSupabaseDataProvider` | Done |
| 3 | `apps/demo` — core + supabase wired together, generic CRUD pages | Done (needs a real Supabase project's URL/anon key filled into `apps/demo/src/environments/environment.ts` to run against live data) |
| 4 | `@pidrang/material` — first real UI layer (List/Create/Show/Edit/Delete bound to core's resource state) | Next |
| 5 | `@pidrang/cli` — table → `Resource` → working CRUD generation | Planned |
| 6 | `primeng`, `tailwind`, `rest`, `graphql` packages, without changing core | Planned |

## Phase 1 — `@pidrang/core`

- `Resource`, `DataProvider`, `ListParams`/`ListResult<T>`, `GetOneParams`/`CreateParams<T>`/`UpdateParams<T>`/`DeleteParams`
- `providePidrang({ dataProvider, resources })`
- `injectDataProvider()`, `injectResources()`, `injectResource(name)`
- `injectResourceList<T>(resourceName, params?)` — signal-based, `resourceName` may be reactive

## Phase 2 — `@pidrang/supabase`

- `SupabaseDataProvider implements DataProvider`, mapping `ListParams` to `.eq()`/`.order()`/`.range()`, normalizing `PostgrestError` to a plain `Error`
- `provideSupabaseDataProvider({ client })` — returns a plain `DataProvider`, no Angular DI of its own

## Phase 3 — `apps/demo`

- `providePidrang` + `provideSupabaseDataProvider` wired in `app.config.ts` for `users`/`products`/`orders`
- Generic (resource-agnostic) List/Create/Show/Edit pages, driven by the `:resource` route param — raw JSON rendering, since `Resource` has no field schema yet
- Not yet done: fill in real Supabase credentials and tables to actually exercise it end to end; no styling (deliberately minimal ahead of `@pidrang/material`)

## Phase 4 — `@pidrang/material` (next)

- Angular Material components consuming core's reactive primitives (`injectResourceList`, `injectDataProvider`) — depends on core only, not on supabase
- Will likely surface the need for a field schema on `Resource` (or a separate concept) to render typed forms instead of demo's raw-JSON textareas — revisit then, not before

## Phase 5 — `@pidrang/cli`

- Table → `Resource` → working CRUD generation (the "30 seconds" demo goal)

## Phase 6 — later, without core changes

- `@pidrang/primeng`, `@pidrang/tailwind`, `@pidrang/rest`, `@pidrang/graphql`, `@pidrang/strapi`
