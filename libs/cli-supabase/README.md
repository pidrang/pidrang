# @pidrang/cli-supabase

`@pidrang/cli`'s `SchemaProviderDefinition` for Supabase. Lets `pidrang init` scaffold from a Supabase project without needing a single introspection method to always be available — real Supabase projects vary in what's exposed (`pg_graphql` can be disabled, the REST OpenAPI schema now requires a secret key on newer projects).

## Connection strategies

The wizard asks which one to use, then only prompts for that strategy's credentials:

- **`graphql`** — introspects via `pg_graphql` (`/graphql/v1`), needs only the project URL and an anon/publishable key. Requires the `pg_graphql` extension to be enabled on the project.
- **`service-role`** — reads the REST OpenAPI schema (`/rest/v1/`), needs the project URL and a secret (`service_role`) key.
- **`postgres`** — connects directly to Postgres and reads `information_schema` (host/port/database/user/password). No Supabase-specific dependency — the most broadly reliable option.

All three are verified against a real local Supabase instance (`supabase start`), but they do not see the same things (`docs/design-notes.md` has the details):

- **`postgres`** sees every type, default, identity and generated column, and refuses views and functions. It is the recommended strategy.
- **`service-role`** cannot see generated columns, identity defaults or a default like `'{}'::jsonb`. A table with a generated number column cannot be created through the generated pages. Views that PostgREST serves only with `GET` get list and show only.
- **`graphql`** cannot see any default, so create is unavailable for a table with a writable `NOT NULL` column. Every table and column name is checked against the REST API with the same key, and a name pg_graphql renamed refuses the table.

With every strategy, a column of an unsupported type (`json`, `jsonb`, arrays, enums, other user-defined types, `bytea`, ...) is left out of the generated resource. If it needs a value on insert, create is unavailable for that table. If no column is left that a form can edit, edit is unavailable. The wizard shows both. A table with a name PostgREST would read as syntax is refused before anything is written. `postgres` and `service-role` also refuse a table without a primary key, with a composite one or with one not named `id`; `graphql` cannot see primary keys and only checks that an `id` column exists, so a composite key that includes `id` gets through it.

The connection settings are checked before any request. TLS for `postgres` always verifies the certificate, against the CA file you give or, if you leave the path empty, the system certificates.

## Exports

- `SupabaseConnection` — discriminated union of the three strategies' connection shapes
- `supabaseSchemaProviderDefinition` — the `SchemaProviderDefinition<SupabaseConnection>` to register with `runInitWizard`

## Running unit tests

Run `nx test cli-supabase` to execute the unit tests via [Vitest](https://vitest.dev/).

## Building

Run `nx build cli-supabase` to build the library.
