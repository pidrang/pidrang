# Writing a data provider

A data provider connects Pidrang to a backend. It implements the `DataProvider` interface from `@pidrang/core`, and it must behave exactly as described here so that every UI layer and every generated page works the same on any backend. `@pidrang/supabase` is the reference implementation; `createInMemoryDataProvider` in `libs/provider-conformance` is the executable specification.

## The contract

```ts
interface DataProvider {
  getList<T>(resource: string, params?: ListParams): Promise<ListResult<T>>;
  getOne<T>(resource: string, params: { id: string }): Promise<T>;
  create<T>(resource: string, params: { data: Partial<T> }): Promise<T>;
  update<T>(resource: string, params: { id: string; data: Partial<T> }): Promise<T>;
  delete<T>(resource: string, params: { id: string }): Promise<T>;
}
```

`create`, `update` and `delete` resolve with the affected record as stored by the backend, including its generated `id`.

## Listing

```ts
provider.getList('products', {
  pagination: { current: 2, pageSize: 25 },
  sorters: [{ field: 'price', order: 'desc' }],
  filters: [
    { field: 'price', operator: 'gte', value: 10 },
    { field: 'name', operator: 'contains', value: 'mouse' },
  ],
});
// => { data: [...up to 25 rows...], total: 42 }
```

- **Validation first.** Call `validateListParams(params)` before contacting the backend. It rejects a pagination value that is not a positive integer and any malformed filter, with a message that names the problem.
- **Pagination.** `current` is 1-based and defaults to 1; `pageSize` defaults to 10. A page past the end resolves with `data: []` and the full `total`.
- **Total.** `total` counts every row that matches the filters, not only the rows of the returned page.
- **Sorting.** Apply `sorters` in order, then `id` ascending as a final tie-breaker unless a sorter already targets `id`, so that pages never repeat or skip rows.

## Filters

Call `normalizeFilters(params.filters)` to get a `Filter[]`: `{ field, operator, value }`. All filters combine with AND.

| Operator | `value` | Matches |
| --- | --- | --- |
| `eq`, `ne` | string, finite number or boolean | equal / different. `ne` never matches a null value, as in SQL |
| `lt`, `lte`, `gt`, `gte` | string, finite number or boolean | ordered comparison; a null value never matches |
| `in` | array of strings, finite numbers or booleans | the value is one of the array items. An empty array matches nothing |
| `contains` | string | case-insensitive substring. Every character is literal: `%`, `_`, `*` and `.` are never wildcards |
| `null` | boolean | `true`: the value is null; `false`: the value is not null |

A null value is never passed to `eq`, `ne` or a comparison: `validateListParams` rejects it and asks for the `null` operator instead. A filter `value` must have the column's type: `'10'` on a numeric column is cast by Postgres but compared as a string by other backends, so the result is backend-defined. Sort order of text (collation) and of null values is backend-defined too; the conformance suite only sorts numbers.

**Legacy equality records.** `filters: { in_stock: true }` is still accepted and normalized to `[{ field: 'in_stock', operator: 'eq', value: true }]`. A key set to `undefined` is ignored. A key set to `null` becomes `{ operator: 'null', value: true }`. With `@pidrang/supabase` before this contract, such a key sent `= NULL` to Postgres and never matched any row.

**Operators a backend cannot express.** Reject them, never ignore them: call `rejectUnsupportedFilters(filters, supportedOperators)` right after validation. It throws `Unsupported filter operator "contains" on field "name"`, which is better than silently returning unfiltered rows.

## Errors

Backend failures are thrown as a `PidrangError` with a `category` so the UI can react without parsing messages. Invalid or unsupported list parameters (from `validateListParams` and `rejectUnsupportedFilters`) are a programming error, not a backend failure: they are thrown as a plain `Error` before any request.

| Situation | `category` |
| --- | --- |
| The caller is not signed in (HTTP 401) | `unauthenticated` |
| The caller is signed in but not allowed (HTTP 403, row-level security) | `forbidden` |
| `getOne`, `update` or `delete` on an id that does not exist | `not-found` |
| Anything else | `unknown` |

```ts
throw new PidrangError('No products record with id 42', {
  category: 'not-found',
  status: 404,
  cause: backendError,
});
```

Keep the backend error in `cause` and its code in `code` so callers can still inspect it.

## Proving it: the conformance suite

`libs/provider-conformance` runs the same scenarios against any provider: pagination, total, sorting, every filter operator on a fixed seven-row dataset (`CONFORMANCE_ROWS`, including values with `%`, `_`, commas and quotes), legacy records, invalid and unsupported filters, CRUD return values and `not-found` errors.

```ts
import {
  CONFORMANCE_ROWS,
  describeDataProviderConformance,
} from '@pidrang/provider-conformance';

describeDataProviderConformance('rest', {
  resource: 'items',
  setup: async () => {
    await seedBackend(CONFORMANCE_ROWS);
    return createRestDataProvider({ baseUrl: 'http://localhost:3000' });
  },
  teardown: () => clearBackend(),
  unsupported: ['contains'],
});
```

`setup` must return a provider whose `resource` contains exactly `CONFORMANCE_ROWS` (`id`, `name`, `price`, `in_stock`, nullable `note`). Operators listed in `unsupported` are expected to be rejected with `rejectUnsupportedFilters`. The suite lives in its own library, used only by specs, so providers never depend on each other.

`@pidrang/supabase` runs it in `supabase-data-provider.conformance.spec.ts` against a real database when `PIDRANG_CONFORMANCE_SUPABASE_URL` and `PIDRANG_CONFORMANCE_SUPABASE_KEY` point to a project with this table; without them the spec is skipped. It is manual for now: CI will run it once pidrang/supabase ships a test dataset (pidrang/supabase#11).

```sql
create table public.conformance_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price double precision not null,
  in_stock boolean not null,
  note text
);
grant all on public.conformance_items to anon, authenticated, service_role;
```

With a local stack (`supabase start` in the pidrang/supabase repository), create the table, then run `PIDRANG_CONFORMANCE_SUPABASE_URL=http://127.0.0.1:54321 PIDRANG_CONFORMANCE_SUPABASE_KEY=<a key allowed to write the table> pnpm exec nx test supabase`.
