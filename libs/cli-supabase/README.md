# @pidrang/cli-supabase

`@pidrang/cli`'s `SchemaProviderDefinition` for Supabase. Lets `pidrang init` scaffold from a Supabase project without needing a single introspection method to always be available — real Supabase projects vary in what's exposed (`pg_graphql` can be disabled, the REST OpenAPI schema now requires a secret key on newer projects).

## Connection strategies

The wizard asks which one to use, then only prompts for that strategy's credentials:

- **`graphql`** — introspects via `pg_graphql` (`/graphql/v1`), needs only the project URL and an anon/publishable key. Requires the `pg_graphql` extension to be enabled on the project.
- **`service-role`** — reads the REST OpenAPI schema (`/rest/v1/`), needs the project URL and a secret (`service_role`) key.
- **`postgres`** — connects directly to Postgres and reads `information_schema` (host/port/database/user/password). No Supabase-specific dependency — the most broadly reliable option.

Only `postgres` is validated against standard Postgres behavior. `graphql` and `service-role` are implemented from `pg_graphql`/PostgREST documentation and still need end-to-end verification against a live project with each enabled.

## Exports

- `SupabaseConnection` — discriminated union of the three strategies' connection shapes
- `supabaseSchemaProviderDefinition` — the `SchemaProviderDefinition<SupabaseConnection>` to register with `runInitWizard`

## Running unit tests

Run `nx test cli-supabase` to execute the unit tests via [Vitest](https://vitest.dev/).

## Building

Run `nx build cli-supabase` to build the library.
