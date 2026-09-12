# @pidrang/supabase

`@pidrang/core`'s `DataProvider` implemented against `@supabase/supabase-js`.

## Exports

- `SupabaseDataProvider` — implements `DataProvider` (`getList`, `getOne`, `create`, `update`, `delete`)
- `provideSupabaseDataProvider({ client })` — registers it under core's `DATA_PROVIDER` token

## Running unit tests

Run `nx test supabase` to execute the unit tests.

## Building

Run `nx build supabase` to build the publishable package.
