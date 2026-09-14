# Roadmap

Progress tracker for Pidrang. See `CLAUDE.md` for the architecture rules and per-package details behind each item.

| # | Phase | Status |
|---|-------|--------|
| 1 | `@pidrang/core` — contracts, `providePidrang`, signal-based resource state | Done |
| 2 | `@pidrang/supabase` — `SupabaseDataProvider`, `provideSupabaseDataProvider` | Done |
| 3 | `apps/demo` — core + supabase wired together, generic CRUD pages | Done |
| 4 | Auth Provider — sign-in contract, session state, tightens the demo's RLS policies | Next |
| 5 | `@pidrang/material` — first real UI layer (List/Create/Show/Edit/Delete bound to core's resource state) | Planned |
| 6 | `@pidrang/cli` — table → `Resource` → working CRUD generation | Planned |
| 7 | `primeng`, `tailwind`, `rest`, `graphql` packages, without changing core | Planned |

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
- Backed by the `pidrang` Supabase project (see `pidrang-supabase` repo for schema/migrations); no styling (deliberately minimal ahead of `@pidrang/material`)

## Phase 4 — Auth Provider (next)

- README already advertises an Auth Provider; this phase makes that real instead of leaving it undocumented
- Sign-in/sign-out contract in `@pidrang/core`, session state exposed the same way `DataProvider` is (a token + `inject*` functions), so UI packages can read "am I logged in" without depending on Supabase directly
- `@pidrang/supabase` implementation on top of `supabase-js` auth
- Once this exists, the demo's currently-open RLS policies (see `pidrang-supabase`) should be tightened to require authentication for write actions

## Phase 5 — `@pidrang/material`

- Angular Material components consuming core's reactive primitives (`injectResourceList`, `injectDataProvider`) — depends on core only, not on supabase
- Will likely surface the need for a field schema on `Resource` (or a separate concept) to render typed forms instead of demo's raw-JSON textareas — revisit then, not before

## Phase 6 — `@pidrang/cli`

- Table → `Resource` → working CRUD generation (the "30 seconds" demo goal)

## Phase 7 — later, without core changes

- `@pidrang/primeng`, `@pidrang/tailwind`, `@pidrang/rest`, `@pidrang/graphql`, `@pidrang/strapi`

## Not scheduled as a phase, still needed

- CI: lint/test/build checks on every PR (this is what `chore/roadmap-and-ci` adds — checks only, no release/publish automation yet)
- Dependabot alerts and a `SECURITY.md` for the `pidrang` and `pidrang-supabase` repos
- A README section stating plainly that Row Level Security is the integrator's responsibility — `SupabaseDataProvider` performs no authorization of its own
- A clearer error than the raw `supabaseUrl is required` crash when `apps/demo` runs without credentials configured
