# @pidrang/cli-supabase

`@pidrang/cli`'s `SchemaProviderDefinition` for Supabase. Lets `pidrang init` scaffold from a Supabase project without needing a single introspection method to always be available — real Supabase projects vary in what's exposed (`pg_graphql` can be disabled, the REST OpenAPI schema now requires a secret key on newer projects).

## Connection strategies

The wizard asks which one to use, then only prompts for that strategy's credentials:

- **`graphql`** — introspects via `pg_graphql` (`/graphql/v1`), needs only the project URL and an anon/publishable key. Requires the `pg_graphql` extension to be enabled on the project.
- **`service-role`** — reads the REST OpenAPI schema (`/rest/v1/`), needs the project URL and a secret (`service_role`) key.
- **`postgres`** — connects directly to Postgres and reads `information_schema` (host/port/database/user/password). No Supabase-specific dependency — the most broadly reliable option.

All three are verified against a real local Supabase instance (`supabase start`), listing and introspecting the same three tables, but they do not produce identical `Field[]` output: `postgres` and `service-role` both detect `readOnly`, `hasDefault` and `nullable` (see `docs/design-notes.md`'s "`readOnly`, `hasDefault` and `nullable` are detected per strategy" note for exactly what each one can see), while `graphql` only detects `readOnly` (the `id` primary key) and `nullable` — it has no way to see a column's server default from `pg_graphql`'s `Node` type, so a `graphql`-generated create form still asks the user to fill in a column like `created_at` that the other two strategies correctly omit. The `graphql` strategy's introspection query also needed a real fix during that verification: pg_graphql wraps `edges` as `NON_NULL(LIST(NON_NULL(OBJECT)))` and `node` as `NON_NULL(OBJECT)`, and GraphQL's `__Type.fields` is only populated once you unwrap down to the OBJECT kind — the original query, written from documentation alone, didn't unwrap deep enough and silently returned zero fields.

## Exports

- `SupabaseConnection` — discriminated union of the three strategies' connection shapes
- `supabaseSchemaProviderDefinition` — the `SchemaProviderDefinition<SupabaseConnection>` to register with `runInitWizard`

## Running unit tests

Run `nx test cli-supabase` to execute the unit tests via [Vitest](https://vitest.dev/).

## Building

Run `nx build cli-supabase` to build the library.
