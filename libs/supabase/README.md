# @pidrang/supabase

`@pidrang/core`'s `DataProvider` implemented against `@supabase/supabase-js`.

## Installation

```bash
npm install @pidrang/supabase @pidrang/core @supabase/supabase-js
```

## Documentation

See the [getting started guide](https://github.com/pidrang/pidrang/blob/main/docs/getting-started.md) and the [main repository](https://github.com/pidrang/pidrang).

## Exports

- `SupabaseDataProvider` — implements `DataProvider` (`getList`, `getOne`, `create`, `update`, `delete`). `getList` maps every `Filter` operator to PostgREST, returns an empty page with the full total past the last row, and rejects a filter field that PostgREST would read as a query option or a path (`order`, `limit`, `a.b`, `a->b`) or a sorter field holding path syntax (see [Writing a data provider](https://github.com/pidrang/pidrang/blob/main/docs/data-providers.md#filters))
- `provideSupabaseDataProvider({ client })` — returns a plain `DataProvider`, passed to `providePidrang({ dataProvider })`
- `SupabaseAuthProvider` — implements `AuthProvider` (`login`, `logout`, `getIdentity`) on Supabase Auth
- `provideSupabaseAuthProvider({ client })` — returns a plain `AuthProvider`, passed to `providePidrang({ authProvider })`

## Running unit tests

Run `nx test supabase` to execute the unit tests.

## Building

Run `nx build supabase` to build the publishable package.
