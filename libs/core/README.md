# @pidrang/core

Headless contracts for Pidrang. Depends on `@angular/core` only — no UI component library, no other Angular platform package.

## Installation

```bash
npm install @pidrang/core
```

## Documentation

See the [getting started guide](https://github.com/pidrang/pidrang/blob/main/docs/getting-started.md) and the [main repository](https://github.com/pidrang/pidrang).

## Exports

- `Resource`, `Field` (`name`, `label?`, `type`, `hidden?`), `FieldType`
- `DataProvider`, `ListParams`, `ListResult<T>`, `GetOneParams`, `CreateParams<T>`, `UpdateParams<T>`, `DeleteParams`
- `AuthProvider`, `AuthIdentity`, `LoginParams`
- `providePidrang({ dataProvider, resources, authProvider? })`
- `injectDataProvider()`, `injectAuthProvider()`, `injectResources()`, `injectResource(name)`
- `injectResourceList<T>(resourceName, params?)` — signal-based list loader built on Angular's native `resource()`
- `injectAuthSession()` — signal-based current identity (`AuthSessionRef`), built on `resource()`, reloads on session changes, never throws from `value()`

## Running unit tests

Run `nx test core` to execute the unit tests.

## Building

Run `nx build core` to build the publishable package.
