# Roadmap

Progress tracker for Pidrang. See `CLAUDE.md` for the architecture rules and per-package details behind each item.

| #   | Phase                                                                                                   | Status  |
| --- | ------------------------------------------------------------------------------------------------------- | ------- |
| 1   | `@pidrang/core` — contracts, `providePidrang`, signal-based resource state                              | Done    |
| 2   | `@pidrang/supabase` — `SupabaseDataProvider`, `provideSupabaseDataProvider`                             | Done    |
| 3   | `apps/demo-material` — core + supabase wired together, generic CRUD pages                               | Done    |
| 4   | Auth Provider — sign-in contract, session state, tightens the demo's RLS policies                       | Done    |
| 5   | `@pidrang/material` — first real UI layer (List/Create/Show/Edit/Delete bound to core's resource state) | Done    |
| 6   | `@pidrang/cli` — table → `Resource` → working CRUD generation                                           | In progress |
| 7   | `@pidrang/tailwind` — second UI layer (Tailwind CSS utility classes, no component library)              | Done    |
| 8   | `primeng`, `rest`, `graphql` packages, without changing core                                            | Planned |

## Phase 1 — `@pidrang/core`

- `Resource`, `DataProvider`, `ListParams`/`ListResult<T>`, `GetOneParams`/`CreateParams<T>`/`UpdateParams<T>`/`DeleteParams`
- `providePidrang({ dataProvider, resources })`
- `injectDataProvider()`, `injectResources()`, `injectResource(name)`
- `injectResourceList<T>(resourceName, params?)` — signal-based, `resourceName` may be reactive
- `Field`/`FieldType`, an optional `Resource.fields` — added later (ticket #4), ahead of Phase 5, so a UI layer can render a typed form/table without guessing types from the data at runtime

## Phase 2 — `@pidrang/supabase`

- `SupabaseDataProvider implements DataProvider`, mapping `ListParams` to `.eq()`/`.order()`/`.range()`, normalizing `PostgrestError` to a plain `Error`
- `provideSupabaseDataProvider({ client })` — returns a plain `DataProvider`, no Angular DI of its own

## Phase 3 — `apps/demo-material`

- `providePidrang` + `provideSupabaseDataProvider` wired in `app.config.ts` for `users`/`products`/`orders`
- Generic (resource-agnostic) List/Create/Show/Edit pages, driven by the `:resource` route param — raw JSON rendering, since `Resource` has no field schema yet
- Backed by the `pidrang` Supabase project (see `pidrang/supabase` repo for schema/migrations); no styling (deliberately minimal ahead of `@pidrang/material`)

## Phase 4 — Auth Provider

- `AuthProvider` (`login`, `logout`, `getIdentity`) in `@pidrang/core`, `AUTH_PROVIDER` as an optional `providePidrang()` dependency, `injectAuthProvider()`, and `injectAuthSession()` (signal-based, built on `resource()`)
- `SupabaseAuthProvider` / `provideSupabaseAuthProvider({ client })` in `@pidrang/supabase`, wrapping `supabase-js` auth; normalizes `AuthError` to a plain `Error`, treats a missing session as a `null` identity rather than an error
- `apps/demo-material` wires it into `app.config.ts` (one Supabase client shared by both providers), adds a minimal `/login` page, and shows the signed-in identity with sign out on `HomePage`
- `pidrang/supabase`'s RLS policies tightened: `select` stays public, `insert`/`update`/`delete` now require the `authenticated` role (see that repo's migrations)

## Phase 5 — `@pidrang/material`

- `ResourceTable<T>` — renders `Resource.fields` as a `MatTable`; a `#actions` template (`contentChild` + `ngTemplateOutlet`) lets consumers project per-row buttons/links as a real trailing column instead of a separate list underneath
- `ResourceForm<T>` — built on Signal Forms (`@angular/forms/signals`, stable in Angular 22), one `mat-form-field`/`mat-checkbox` per `Field` based on `FieldType`; a `linkedSignal` draft resets whenever the `value` input changes but stays independently writable, without mutating the caller's object
- `apps/demo-material` wired end to end: List/Create/Edit pages use `ResourceTable`/`ResourceForm` instead of raw JSON textareas; Show page still renders a raw JSON dump (not yet typed)
- All buttons/links across the demo (nav, table actions, forms, login) styled with `MatButtonModule`; M3 theming via a single `mat.theme()` mixin (`@angular/material` has no `@angular/animations` dependency anymore) with a scoped `[color="warn"]` override, since M3's single-mixin API doesn't wire the legacy `.mat-warn` class mapping on its own
- Edit/Show page titles show a human-readable label (`recordLabel()`: name → email → shortened id) instead of the raw UUID
- Login keeps a centered `mat-card`; Create/Edit forms are plain wide forms (no card) since they already sit under a page heading

## Phase 6 — `@pidrang/cli`

- Table → `Resource` → working CRUD generation (the "30 seconds" demo goal), shipped as `pidrang` on npm (`npx pidrang init`) rather than an Nx generator, since it targets any Angular app, not just this workspace
- `@pidrang/cli` — provider-agnostic: `SchemaProvider`/`SchemaProviderDefinition` contract, `runInitWizard()` (provider → connection → tables → per-table actions/hidden fields → `GenerationPlan`), `generateResourcesFile(plan)` (pure `resources.ts` codegen, no disk I/O)
- `@pidrang/cli-supabase` — three connection strategies the wizard lets the user pick between, since no single Supabase introspection method is reliably available across projects: `graphql` (`pg_graphql`, anon key), `service-role` (REST OpenAPI schema, secret key), `postgres` (direct `information_schema`, the only one validated against standard Postgres so far)
- `Field.hidden?: boolean` added to `@pidrang/core` so the wizard's "hide from list/edit" choice is real, read by `apps/demo-material`'s generic list/edit pages at runtime (not baked in per table, since those pages are shared across every `Resource`)
- `apps/pidrang-cli` (`pidrang` on npm) — `pidrang init` wires the wizard to `cli-supabase`, writes `resources.ts` + the generic pages bundle (skips any file that already exists, never overwrites), prints the routes/`providePidrang` snippet to paste in rather than editing the target app's files
- pnpm workspace linking (`pnpm-workspace.yaml` `packages:` glob, `workspace:*` protocol) added so `@pidrang/*` cross-package imports resolve locally — needed once a package (`pidrang-cli`) has to actually run as a Node executable, not just get bundled by Angular/webpack like every earlier package
- Still to do: an end-to-end run against a real Supabase project (needed to validate the `graphql`/`service-role` strategies, not yet exercised live, and to exercise `pidrang init` for real). Running the built CLI standalone also still needs either publishing `@pidrang/cli`/`@pidrang/cli-supabase` to npm (#25) or a dev-mode runner — neither exists yet, so `pidrang init`'s logic is unit tested but not yet run end to end

## Phase 7 — `@pidrang/tailwind`

- `ResourceTable<T>` — renders `Resource.fields` as a plain `<table>` styled with Tailwind utility classes; same `#actions`-template projection API as `@pidrang/material`'s
- `ResourceForm<T>` — same Signal Forms base as `@pidrang/material`'s (`linkedSignal` draft, never mutates the caller's object), one labeled `<input>`/checkbox per `Field`; a native `input[type=checkbox]` needs its own `SignalField<boolean>`-typed accessor since Angular's template type-checker enforces `FormCheckboxControl<boolean>` exactly for native checkboxes (loosely typed for `mat-checkbox`, which isn't a native element)
- `apps/demo-tailwind` — same three resources (`users`/`products`/`orders`) as `apps/demo-material`, wired end to end with `ResourceTable`/`ResourceForm`, so the two UI adapters are directly comparable
- Ships no CSS of its own: the library is markup-only utility classes, so the consuming app's Tailwind build must include `libs/tailwind/src` in its `@source` scan or the classes get purged; `apps/demo-tailwind` wires this via a project-local `.postcssrc.json` (`@tailwindcss/postcss`) and a `@source` directive in `styles.css`

## Phase 8 — later, without core changes

- `@pidrang/primeng`, `@pidrang/rest`, `@pidrang/graphql`, `@pidrang/strapi`

## Not scheduled as a phase, still needed

- CI: lint/test/build checks on every PR (this is what `chore/roadmap-and-ci` adds — checks only, no release/publish automation yet)
- Dependabot alerts and a `SECURITY.md` for the `pidrang` and `pidrang/supabase` repos
- A README section stating plainly that Row Level Security is the integrator's responsibility — `SupabaseDataProvider` performs no authorization of its own
- A clearer error than the raw `supabaseUrl is required` crash when `apps/demo-material` runs without credentials configured
