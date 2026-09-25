# @pidrang/supabase

`@pidrang/core`'s `DataProvider` implemented against `@supabase/supabase-js`.

## Installation

```bash
npm install @pidrang/supabase @pidrang/core @supabase/supabase-js
```

## Documentation

See the [getting started guide](https://github.com/pidrang/pidrang/blob/main/docs/getting-started.md) and the [main repository](https://github.com/pidrang/pidrang).

## Exports

- `SupabaseDataProvider` — implements `DataProvider` (`getList`, `getOne`, `create`, `update`, `delete`)
- `provideSupabaseDataProvider({ client })` — returns a plain `DataProvider`, passed to `providePidrang({ dataProvider })`
- `SupabaseAuthProvider` — implements `AuthProvider` (`login`, `logout`, `getIdentity`) on Supabase Auth
- `provideSupabaseAuthProvider({ client })` — returns a plain `AuthProvider`, passed to `providePidrang({ authProvider })`

## Running unit tests

Run `nx test supabase` to execute the unit tests.

## Building

Run `nx build supabase` to build the publishable package.
