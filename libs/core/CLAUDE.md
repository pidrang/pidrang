# libs/core — CLAUDE.md

Package-specific rules for `@pidrang/core`. The org-wide conventions in the root `CLAUDE.md` (code style, testing, commits) apply here too; this file only covers what's specific to this package.

## Dependency boundary

`@pidrang/core` may depend on `@angular/core` only (see the root doc's "Non-negotiable architecture rule"). Concretely, if a change here needs `@angular/common`, `@angular/forms`, `@angular/platform-browser`, `@angular/router`, `rxjs` beyond what `@angular/core` re-exports, or any UI/data library — stop and flag it; it belongs in `@pidrang/supabase`, `@pidrang/material`, or another package.

## Required vs. optional DI tokens

`DATA_PROVIDER` and `RESOURCES` (`tokens.ts`) are required: `injectDataProvider()`/`injectResources()` call `inject()` plain, and a missing provider surfaces Angular's own DI error. `AUTH_PROVIDER` is optional — not every app configures auth — so `injectAuthProvider()` uses `inject(AUTH_PROVIDER, { optional: true })` and throws a Pidrang-specific message ("no auth provider configured, pass authProvider to providePidrang()") instead of letting a consumer hit a generic or silent failure. When adding a new optional provider/token, follow this same pattern rather than leaving `undefined` for a caller to handle.

## Fail fast, don't return undefined

`injectResource(name)` throws if no resource matches the name, rather than returning `undefined` — a typo in a resource name should fail immediately at the call site, not surface later as a confusing runtime error somewhere else. Keep this fail-fast style for any new lookup helper added to this package.

## `injectResourceList` and Angular's native `resource()`

`resource-list.ts` wraps Angular's own `resource()` API (stable as of `@angular/core` 22 — see ROADMAP.md's "`@publicApi 22.0`" note) rather than reimplementing loading/error/reload state. Prefer building new reactive primitives on top of `resource()`/signals the same way instead of hand-rolling equivalent state.

## Testing

Per the root doc's testing conventions, applied here specifically: tests go through `TestBed.configureTestingModule` plus this package's own `provide*`/`inject*` functions (see `provide-pidrang.spec.ts`, `inject-pidrang.spec.ts`), never by injecting `DATA_PROVIDER`/`RESOURCES`/`AUTH_PROVIDER` directly. When a spec needs a `DataProvider` or `AuthProvider`, fake the whole interface (see `provide-pidrang.spec.ts`'s `noopDataProvider`) instead of mocking individual methods.
