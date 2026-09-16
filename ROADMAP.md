# Roadmap

Progress tracker for Pidrang. See `CLAUDE.md` for the architecture rules and per-package details behind each item.

| # | Phase | Status |
|---|-------|--------|
| 1 | `@pidrang/core` — contracts, `providePidrang`, signal-based resource state | Done |
| 2 | `@pidrang/supabase` — `SupabaseDataProvider`, `provideSupabaseDataProvider` | Done |
| 3 | `apps/demo` — core + supabase wired together, generic CRUD pages | Done |
| 4 | Auth Provider — sign-in contract, session state, tightens the demo's RLS policies | Done |
| 5 | `@pidrang/material` — first real UI layer (List/Create/Show/Edit/Delete bound to core's resource state) | Next |
| 6 | `@pidrang/cli` — table → `Resource` → working CRUD generation | Planned |
| 7 | `primeng`, `tailwind`, `rest`, `graphql` packages, without changing core | Planned |

## Phase 1 — `@pidrang/core`

- `Resource`, `DataProvider`, `ListParams`/`ListResult<T>`, `GetOneParams`/`CreateParams<T>`/`UpdateParams<T>`/`DeleteParams`
- `providePidrang({ dataProvider, resources })`
- `injectDataProvider()`, `injectResources()`, `injectResource(name)`
- `injectResourceList<T>(resourceName, params?)` — signal-based, `resourceName` may be reactive
- `Field`/`FieldType`, an optional `Resource.fields` — added later (ticket #4), ahead of Phase 5, so a UI layer can render a typed form/table without guessing types from the data at runtime

## Phase 2 — `@pidrang/supabase`

- `SupabaseDataProvider implements DataProvider`, mapping `ListParams` to `.eq()`/`.order()`/`.range()`, normalizing `PostgrestError` to a plain `Error`
- `provideSupabaseDataProvider({ client })` — returns a plain `DataProvider`, no Angular DI of its own

## Phase 3 — `apps/demo`

- `providePidrang` + `provideSupabaseDataProvider` wired in `app.config.ts` for `users`/`products`/`orders`
- Generic (resource-agnostic) List/Create/Show/Edit pages, driven by the `:resource` route param — raw JSON rendering, since `Resource` has no field schema yet
- Backed by the `pidrang` Supabase project (see `pidrang/supabase` repo for schema/migrations); no styling (deliberately minimal ahead of `@pidrang/material`)

## Phase 4 — Auth Provider

- `AuthProvider` (`login`, `logout`, `getIdentity`) in `@pidrang/core`, `AUTH_PROVIDER` as an optional `providePidrang()` dependency, `injectAuthProvider()`, and `injectAuthSession()` (signal-based, built on `resource()`)
- `SupabaseAuthProvider` / `provideSupabaseAuthProvider({ client })` in `@pidrang/supabase`, wrapping `supabase-js` auth; normalizes `AuthError` to a plain `Error`, treats a missing session as a `null` identity rather than an error
- `apps/demo` wires it into `app.config.ts` (one Supabase client shared by both providers), adds a minimal `/login` page, and shows the signed-in identity with sign out on `HomePage`
- `pidrang/supabase`'s RLS policies tightened: `select` stays public, `insert`/`update`/`delete` now require the `authenticated` role (see that repo's migrations)

## Phase 5 — `@pidrang/material` (next)

- Angular Material components consuming core's reactive primitives (`injectResourceList`, `injectDataProvider`) — depends on core only, not on supabase
- `Resource.fields` (`Field`/`FieldType`, see Phase 1) already exists for rendering typed forms instead of demo's raw-JSON textareas

## Phase 6 — `@pidrang/cli`

- Table → `Resource` → working CRUD generation (the "30 seconds" demo goal)

## Phase 7 — later, without core changes

- `@pidrang/primeng`, `@pidrang/tailwind`, `@pidrang/rest`, `@pidrang/graphql`, `@pidrang/strapi`

## Not scheduled as a phase, still needed

- CI: lint/test/build checks on every PR (this is what `chore/roadmap-and-ci` adds — checks only, no release/publish automation yet)
- Dependabot alerts and a `SECURITY.md` for the `pidrang` and `pidrang/supabase` repos
- A README section stating plainly that Row Level Security is the integrator's responsibility — `SupabaseDataProvider` performs no authorization of its own
- A clearer error than the raw `supabaseUrl is required` crash when `apps/demo` runs without credentials configured
