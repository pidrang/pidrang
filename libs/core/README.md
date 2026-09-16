# @pidrang/core

Headless contracts for Pidrang. Depends on `@angular/core` only — no UI component library, no other Angular platform package.

## Exports

- `Resource`, `Field`, `FieldType`
- `DataProvider`, `ListParams`, `ListResult<T>`, `GetOneParams`, `CreateParams<T>`, `UpdateParams<T>`, `DeleteParams`
- `providePidrang({ dataProvider, resources })`
- `injectDataProvider()`, `injectResources()`, `injectResource(name)`
- `injectResourceList<T>(resourceName, params?)` — signal-based list loader built on Angular's native `resource()`

## Running unit tests

Run `nx test core` to execute the unit tests.

## Building

Run `nx build core` to build the publishable package.
