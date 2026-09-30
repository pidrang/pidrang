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

- **Validation first.** Call `validateListParams(params)` before contacting the backend. It rejects a pagination value that is not a positive integer, a sorter without a non-empty `field` and an `order` of `asc` or `desc`, and any malformed filter, with a message that names the problem.
- **Pagination.** `current` is 1-based and defaults to 1; `pageSize` defaults to 10. A page past the end resolves with `data: []` and the full `total`. A backend may cap the rows of one response: PostgREST's `max_rows` (1000 on hosted Supabase) returns fewer rows than a larger `pageSize` asks for while `total` stays exact, so keep `pageSize` under that cap.
- **Total.** `total` counts every row that matches the filters, not only the rows of the returned page.
- **Sorting.** Apply `sorters` in order, then `id` ascending as a final tie-breaker unless a sorter already targets `id`, so that pages never repeat or skip rows.

## Filters

Call `normalizeFilters(params.filters)` after `validateListParams` to get a `Filter[]`: `{ field, operator, value }`. `Filter` is a union with one member per operator, so the compiler rejects a value that does not fit it (`{ operator: 'in', value: 'x' }`), and a `switch` on `operator` narrows `value`. All filters combine with AND.

| Operator | `value` | Matches |
| --- | --- | --- |
| `eq`, `ne` | string, finite number or boolean | equal / different. `ne` never matches a null value, as in SQL |
| `lt`, `lte`, `gt`, `gte` | string, finite number or boolean | ordered comparison; a null value never matches. On text the order follows the backend's collation (the in-memory provider compares code units) |
| `in` | array of strings, finite numbers or booleans | the value is one of the array items. An empty array matches nothing |
| `contains` | string | case-insensitive substring, on text columns only. Every character is literal: `%`, `_`, `*` and `.` are never wildcards. An empty string matches every non-null value. Case folding of non-ASCII letters is backend-defined (Postgres follows the database locale) |
| `null` | boolean | `true`: the value is null; `false`: the value is not null |

A null value is never passed to `eq`, `ne` or a comparison: `validateListParams` rejects it and asks for the `null` operator instead. A filter `value` must have the column's type: `'10'` on a numeric column is cast by Postgres but compared as a string by other backends, so the result is backend-defined. Sort order of text (collation) and of null values is backend-defined too; the conformance suite only sorts numbers.

**Fields.** A filter or sorter `field` that the backend does not hold is rejected, never answered with an empty page. `contains` on a column that holds anything but text (a number, a boolean) is rejected too. Neither is ever reported as `not-found`: a provider that detects it before querying throws a plain `Error`, a backend that refuses the query gives a `PidrangError` with category `unknown`. Some limits are backend-defined: the in-memory provider cannot see the columns of an empty table, and a backend that stores uuids or dates as text will run `contains` on them. A provider must also reject a field its backend would read as something other than a column: `@pidrang/supabase` rejects `select`, `columns`, `order`, `limit`, `offset`, `on_conflict`, `or`, `and` and any name holding `.`, `,`, `(`, `)` or `->`, since PostgREST reads them as query options or paths (a filter on `limit` would otherwise be dropped and every row returned). A sorter only lands inside the `order` value, so sorting on a column named `order` or `limit` works; a sorter field holding `.`, `,`, `(`, `)` or `->` is rejected.

**Legacy equality records.** `filters: { in_stock: true }` is still accepted and normalized to `[{ field: 'in_stock', operator: 'eq', value: true }]`. A key set to `undefined` is ignored. A key set to `null` becomes `{ operator: 'null', value: true }`. With `@pidrang/supabase` before this contract, such a key sent `eq.null`, which PostgREST compares with the text `'null'`: it matched rows holding that string on a text column and failed with `22P02` on a number or uuid column. `filters` must be an array or a plain object: a string, a `Date`, a `Map` or a class instance is rejected (they used to be read key by key), and a single filter object without brackets is rejected with a hint to wrap it in an array (it also fails to compile). A table with a column named `field` or `operator` must therefore use the array form.

**Operators a backend cannot express.** Reject them, never ignore them: call `rejectUnsupportedFilters(filters, supportedOperators)` right after validation. It throws `Unsupported filter operator "contains" on field "name"`, which is better than silently returning unfiltered rows.

**Migrating a custom provider.** A provider that reads `params.filters` with `Object.entries` still compiles but breaks on the array form: call `validateListParams(params)`, then `normalizeFilters(params.filters)`, and handle each `Filter`. A legacy record typed `Record<string, unknown>` no longer compiles: its values must be strings, finite numbers, booleans, `null` or `undefined`. Code that builds a `Filter` from an operator held in a variable (`{ field, operator: op, value }` with `op: FilterOperator`) no longer compiles: build the member for that operator instead.

## Errors

Backend failures are thrown as a `PidrangError` with a `category` so the UI can react without parsing messages. Invalid or unsupported list parameters (from `validateListParams` and `rejectUnsupportedFilters`) are a programming error, not a backend failure: they are thrown as a plain `Error` before any request.

| Situation | `category` |
| --- | --- |
| The caller is not signed in (HTTP 401) | `unauthenticated` |
| The caller is signed in but not allowed (HTTP 403) | `forbidden` |
| `getOne`, `update` or `delete` on an id that does not exist | `not-found` |
| A resource (table) that does not exist | `not-found` |
| Anything else | `unknown` |

```ts
throw new PidrangError('No products record with id 42', {
  category: 'not-found',
  status: 404,
  cause: backendError,
});
```

With Supabase, row-level security hides rows rather than refusing: `getOne`, `update` or `delete` on a row the policies hide reports `not-found`, and only a refused insert or a failed `WITH CHECK` gives `forbidden`. An id that is not a valid uuid on a uuid column is rejected by Postgres as `unknown`, not `not-found`.

Keep the backend error in `cause` and its code in `code` so callers can still inspect it.

## Proving it: the conformance suite

`libs/provider-conformance` runs the same scenarios against any provider: pagination, total, sorting, every filter operator on a fixed seven-row dataset (`CONFORMANCE_ROWS`, including values with `%`, `_`, commas and quotes, and two rows listed out of id order so the `id` tie-breaker is really tested), legacy records, invalid and unsupported filters, a `filters` value of the wrong shape, unknown fields, `contains` on a number column, CRUD return values and `not-found` errors.

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

`setup` must return a provider whose `resource` contains exactly `CONFORMANCE_ROWS` (`id`, `name`, `price`, `in_stock`, nullable `note`). Operators listed in `unsupported` are expected to be rejected with `rejectUnsupportedFilters`. The suite lives in its own library, used only by specs, so providers never depend on each other. `supabase-data-provider.conformance.spec.ts` refuses to run against any host but `127.0.0.1` or `localhost`.

`@pidrang/supabase` runs it in `supabase-data-provider.conformance.spec.ts` against a local Supabase stack when `PIDRANG_CONFORMANCE_SUPABASE_URL` and `PIDRANG_CONFORMANCE_SUPABASE_KEY` are set; without them the spec is skipped. It is manual for now: CI will run it once pidrang/supabase ships a test dataset (pidrang/supabase#11).

```sql
create table public.conformance_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price double precision not null,
  in_stock boolean not null,
  note text
);
alter table public.conformance_items enable row level security;
revoke all on public.conformance_items from anon, authenticated;
grant all on public.conformance_items to service_role;
```

This is for a local stack only (`supabase start` in the pidrang/supabase repository), never a hosted project: the suite deletes every row of `conformance_items` before and after each test, and only `service_role` keeps rights on the table: the `revoke` undoes the grants Supabase gives `anon` and `authenticated` on every new table, and RLS with no policy is a second barrier. Create the table, then run `PIDRANG_CONFORMANCE_SUPABASE_URL=http://127.0.0.1:54321 PIDRANG_CONFORMANCE_SUPABASE_KEY=<the local service_role key from supabase status> pnpm exec nx test supabase`.
