# Architecture

Pidrang is an Nx monorepo of small packages with a strict dependency direction: everything depends on `@pidrang/core`, and core depends on nothing but `@angular/core`.

```text
                    @pidrang/core
        (contracts, providePidrang, signals)
                          |
     +----------+---------+----------+
     |          |                    |
@pidrang/    @pidrang/          @pidrang/
supabase     material           tailwind
     |          |                    |
  Supabase   Angular Material   Tailwind CSS
```

## Packages

```text
pidrang/
├── apps/
│   ├── demo-material/   Angular demo (Material UI)
│   ├── demo-tailwind/   Angular demo (Tailwind UI)
│   └── pidrang-cli/     the `pidrang` command line entry point
└── libs/
    ├── core/            headless primitives and contracts (@pidrang/core)
    ├── supabase/        Supabase DataProvider and AuthProvider (@pidrang/supabase)
    ├── material/        Angular Material UI layer (@pidrang/material)
    ├── tailwind/        Tailwind CSS UI layer (@pidrang/tailwind)
    ├── cli/             provider-agnostic wizard and codegen (@pidrang/cli)
    └── cli-supabase/    Supabase schema introspection for the CLI (@pidrang/cli-supabase)
```

## `@pidrang/core`

Framework-native (Angular) but UI-agnostic. It depends on `@angular/core` only, never on a component library, `@angular/common`, `@angular/forms` or `@angular/router`. Subpaths of `@angular/core` are allowed, `rxjs` is not. That boundary is what lets any UI layer or data source be added without touching core.

- `Resource` (optionally described with `Field` and `FieldType` for a typed form or table), `DataProvider`, `ListParams` (with typed `Filter`s: `normalizeFilters`, `validateListParams`, `rejectUnsupportedFilters`) and `ListResult<T>`, `GetOneParams`, `CreateParams<T>`, `UpdateParams<T>`, `DeleteParams`
- `providePidrang({ dataProvider, resources, authProvider? })` for app-wide configuration
- `injectDataProvider()`, `injectAuthProvider()`, `injectResources()`, `injectResource(name)` for reading that configuration
- `injectResourceList<T>(resourceName, params?)`, a signal-based list loader built on Angular's native `resource()`
- `injectAuthSession()`, a signal-based view of the current identity, returned as an `AuthSessionRef`
- `PidrangError`, the error type data and auth providers throw, with a `category` (`unauthenticated`, `forbidden`, `not-found`, `unknown`) plus `code`, `status` and `cause`

`AuthProvider` (`login`, `logout`, `getIdentity`, optional `onSessionChange`) follows the same pattern as `DataProvider`: `providePidrang` registers it, `injectAuthProvider()` reads it, and `injectAuthSession()` returns an `AuthSessionRef` built on `resource()`. Its `value()` is `AuthIdentity | null | undefined` (signed in, signed out, not loaded yet), keeps the previous identity while a session change reloads it, and never throws: a provider failure goes to `error()` and leaves `value()` `undefined`. A provider that implements `onSessionChange(listener)` makes every live `injectAuthSession()` reload on login, logout or an external auth change, and unsubscribes it when destroyed. `reload()` also works for providers without it.

## `@pidrang/supabase`

Implements `DataProvider` and `AuthProvider` against `@supabase/supabase-js`:

- `SupabaseDataProvider` and `provideSupabaseDataProvider({ client })` map `ListParams` to PostgREST filters (`eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `in`, `ilike`, `is`), `.order()` and `.range()` and normalize `PostgrestError` to a `PidrangError` whose `category` comes from the HTTP status, so an app can ask for sign-in on `unauthenticated` only, never on a signed-in user's Row Level Security denial. `getList` always adds `id` ascending as a final sort, unless a sorter already targets `id`, so pages never repeat or skip rows.
- `SupabaseAuthProvider` and `provideSupabaseAuthProvider({ client })` wrap Supabase Auth. A missing session (`AuthSessionMissingError`, `session_not_found`) is a `null` identity; network and server failures are thrown as `PidrangError`. Supabase auth events drive `onSessionChange`, and a repeated `SIGNED_IN` for the same user (sent when a tab regains focus) is ignored.

Both factories return plain objects and do not use Angular DI. The app wires them in through `providePidrang`.

Every table is assumed to have an `id` primary key: `getOne`, `update` and `delete` filter on it.

### Access control is your responsibility

`SupabaseDataProvider` and `SupabaseAuthProvider` perform no authorization. Every access guarantee comes from the Row Level Security policies on your own Supabase project. Pidrang assumes those policies are correctly configured; it does not enforce or verify them.

## UI layers

`@pidrang/material` and `@pidrang/tailwind` expose the same schema-driven components:

- `ResourceTable` renders a `Resource`'s `Field[]` as a table. A projected `#actions` template (`contentChild` and `ngTemplateOutlet`) becomes a trailing column for per-row buttons and links.
- `ResourceForm` renders one input per `Field`, built on Angular Signal Forms (`@angular/forms/signals`). A `linkedSignal` draft resets whenever its `value` input changes and never mutates the caller's original object.

They depend on `@pidrang/core` and their own styling stack, never on a specific `DataProvider`. They therefore work with `@pidrang/supabase` today and any future data provider unchanged.

`@pidrang/tailwind` ships no CSS. The consuming app's Tailwind build, through its own `@source` scan, turns the classes used in the library's templates into styles.

## CLI

`@pidrang/cli` is the provider-agnostic engine behind `pidrang init`: the interactive wizard, the `Resource` codegen and the `SchemaProvider` contract every schema source implements. `@pidrang/cli-supabase` implements it for Supabase with three connection strategies: GraphQL introspection (`pg_graphql`), the REST OpenAPI document (service role key) and direct Postgres (`information_schema`). `apps/pidrang-cli` wires the two together.

## Adding a data source or UI package

New packages such as `@pidrang/rest`, `@pidrang/graphql` or `@pidrang/primeng` depend on `@pidrang/core` only. If adding one requires changing core, treat that as a design smell and re-examine the core contract first.

The reasons behind non-obvious implementation choices are in [Design notes](./design-notes.md). The data provider contract, with its filter semantics and conformance suite, is in [Writing a data provider](./data-providers.md).
