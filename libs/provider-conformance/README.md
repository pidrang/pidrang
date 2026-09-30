# @pidrang/provider-conformance

Private test library, never published. It turns the data provider contract (`docs/data-providers.md`) into runnable scenarios so every provider (`@pidrang/supabase` today, then REST, GraphQL and Strapi) is held to the same behavior.

- `describeDataProviderConformance(name, target)` registers the scenarios: pagination and total, sorting with the `id` tie-breaker, every filter operator on `CONFORMANCE_ROWS`, legacy equality records, invalid and unsupported filters, invalid sorters, a `filters` value of the wrong shape, unknown fields, `contains` on a number column, CRUD return values and `not-found` errors.
- `createInMemoryDataProvider(seed)` is the reference implementation; it runs the suite in CI on every change.
- `CONFORMANCE_ROWS` and `ConformanceRow` are the fixed dataset a provider's `setup` must load, in the listed order (two rows are out of id order on purpose).

Only specs import this library, so providers never depend on each other. `nx test provider-conformance` runs a TypeScript check (`typecheck`) before the tests.
