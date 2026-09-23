# @pidrang/cli

Provider-agnostic engine behind `pidrang init`: the interactive wizard, the `Resource` codegen, and the contract every schema provider (Supabase today, REST/Strapi/GraphQL later) implements against. Never imports a concrete provider package (e.g. `@pidrang/cli-supabase`) — that wiring happens one level up, in `apps/pidrang-cli`.

## Exports

- `SchemaProvider` — `listTables()`, `introspectTable(table)` — what a concrete provider implements once connected
- `SchemaProviderDefinition<TConnection>` — `id`, `label`, `promptConnection()`, `createSchemaProvider(connection)` — how the wizard discovers and connects to a provider without knowing its connection shape
- `CrudAction` — `'list' | 'create' | 'show' | 'edit' | 'delete'`
- `GenerationPlan`, `TablePlan` — the wizard's output: per selected table, its fields, chosen actions, and fields to hide from list/edit views
- `runInitWizard(providers: SchemaProviderDefinition[])` — drives the interactive flow, returns a `GenerationPlan`
- `generateResourcesFile(plan: GenerationPlan)` — pure string generator, turns a plan into a ready-to-use `resources.ts` (no disk I/O)

## Running unit tests

Run `nx test cli` to execute the unit tests via [Vitest](https://vitest.dev/).

## Building

Run `nx build cli` to build the library.
