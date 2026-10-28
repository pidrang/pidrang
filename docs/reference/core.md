# Core reference

Everything is exported by `@pidrang/core`, which depends only on `@angular/core`. Read `libs/core/src/index.ts` for the full list of re-exports.

## Configuration

`providePidrang(config: PidrangConfig): EnvironmentProviders` registers three providers:

| Property | Type | Required | What it does |
|----------|------|----------|-------------|
| `dataProvider` | `DataProvider` | Yes | Register as `DATA_PROVIDER` token; every page reads through it. Source: `libs/core/src/lib/provide-pidrang.ts` lines 48–50. |
| `resources` | `Resource[]` | Yes | Register as `RESOURCES` token; pages read resource definitions from here. Source: same file, line 50. |
| `authProvider` | `AuthProvider` | No | When present, register as `AUTH_PROVIDER` token and provide `SESSION_IDENTITY` (a writable signal driven by `watchIdentity`). Without it, `injectAuthSession()` throws. Source: same file, lines 53–62, `watchIdentity` function at lines 23–45. |

## Reading the configuration

| Function | Returns | Throws when | Source |
|----------|---------|------------|--------|
| `injectDataProvider(): DataProvider` | The configured `DataProvider`. | Never — `DATA_PROVIDER` is required. | `libs/core/src/lib/inject-pidrang.ts` lines 8–9. |
| `injectAuthProvider(): AuthProvider` | The configured `AuthProvider`. | When no auth provider was passed to `providePidrang()`. Error message: `Pidrang: no auth provider configured, pass authProvider to providePidrang()`. Source: same file, lines 12–17. |
| `injectResources(): Resource[]` | The registered resources array. | Never — `RESOURCES` is required. | Same file, lines 20–21. |
| `injectResource(name: string): Resource` | The single resource matching `name`. | When no resource has that name. Error message: `Pidrang: no resource registered with name "<name>"`. Source: same file, lines 24–29. |

All functions use Angular's `inject()` and must be called in an injection context (component constructor, field initializer, factory).

## Loading a list

`injectResourceList<T>(resourceName: string \| (() => string), params?: () => ListParams \| undefined): ResourceRef<ListResult<T> \| undefined>` wraps `DataProvider.getList` in Angular's native `resource()` API, returning a `ResourceRef` with the following members (documented under `ResourceRef` in `@angular/core`):

| Member | Type | What it holds |
|--------|------|---------------|
| `value` | `Signal<ListResult<T> \| undefined>` | The loaded result. `undefined` while loading, populated when done, kept across status changes. |
| `status` | `Signal<ResourceStatus>` | `'loading'`, `'reloading'`, `'error'`, or `'success'`. |
| `error` | `Signal<Error \| undefined>` | The error if status is `'error'`. |
| `isLoading` | `Signal<boolean>` | Shortcut for loading/reloading. |
| `reload()` | `() => void` | Triggers a new load. |

Two notes:
- The resource name may be a function (e.g. a route parameter signal); changing the return value reloads automatically.
- When `params` returns `undefined`, loading is skipped entirely per `resource()`'s own convention.

Source: `libs/core/src/lib/resource-list.ts` lines 11–27.

## Reading the session

`injectAuthSession(): AuthSessionRef` — loads the identity once, subscribes to session change notifications and updates on its own after login/logout. It throws when no `authProvider` was passed to `providePidrang()`, because it calls `injectAuthProvider()` first.

| Member | Type | Meaning |
|--------|------|---------|
| `value` | `Signal<AuthIdentity \| null \| undefined>` | `undefined` during initial load, `null` when signed out, `AuthIdentity` when signed in. Updates after each `login()`/`logout()`. Source: `libs/core/src/lib/auth-session.ts` lines 25–36 (`linkedSignal` computation). |
| `error` | `Signal<Error \| undefined>` | Provider failure during load. Check this alongside `value`. |
| `isLoading` | `Signal<boolean>` | True between `reload()` calls until `getIdentity()` settles. |
| `reload()` | `() => void` | Force a reload of the identity. With `@pidrang/supabase` you do not need it after `login()`/`logout()`: the provider pushes the change through `onSessionChange`. |

Source: `libs/core/src/lib/auth-session-ref.ts` lines 5–10 (interface definition); `auth-session.ts` lines 16–51 (implementation).

## Resource

`interface Resource` describes one table as a resource:

| Property | Type | Default | What it does |
|----------|------|---------|-------------|
| `name` | `string` | — | Table name, resource name, and URL segment. Must not collide with existing routes. Source: `libs/core/src/lib/resource.ts` line 5. |
| `label` | `string` | Derived from `name` | Display label for titles, menu items, headers. Generated from the table name by `readable-label.ts` in the CLI: split on `_`, `-`, `.`, case boundaries, capitalize first word, lowercase others. |
| `fields` | `Field[]` | — | Typed field definitions rendered by `ResourceForm` and `ResourceTable`. Source: same file, line 7. |
| `defaultSorters` | `ListParams['sorters']` | `[ { field: 'id', order: 'asc' } ]` | Order applied when the page has no user-set sort. The CLI adds `{ field: 'created_at', order: 'desc' }, { field: 'id', order: 'asc' }` when a `timestamp` or `date` `created_at` column exists. Source: `libs/cli/src/lib/generate-resources-file.ts` lines 51–61. |
| `list` | `boolean` | `true` | Enable/disable the generic list page and its route. Source: `libs/core/src/lib/resource.ts` line 10. |
| `create` | `boolean` | `true` | Enable/disable create. Source: same file, line 11. |
| `show` | `boolean` | `true` | Enable/disable show. Source: same file, line 12. |
| `edit` | `boolean` | `true` | Enable/disable edit. Source: same file, line 13. |
| `delete` | `boolean` | `true` | Enable/disable delete. Source: same file, line 14. |

`isResourceActionEnabled(resource: Resource \| undefined, action: ResourceAction): boolean` returns `false` when `resource` is `undefined` or `resource[action] === false`; `true` otherwise (enabled by default). Source: `libs/core/src/lib/is-resource-action-enabled.ts` lines 4–9.

## Field

`interface Field` describes a single column:

| Property | Type | Default | What it changes |
|----------|------|---------|----------------|
| `name` | `string` | — | Column name, matches Supabase table column. Source: `libs/core/src/lib/field.ts` line 11. |
| `label` | `string` | Derived from `name` | Header and form field label. Source: same file, line 12. |
| `type` | `FieldType` | — | Input type and validation pattern. Source: same file, line 13. |
| `hidden` | `boolean` | `false` | Generic list/edit views skip the field at render time. Schema metadata, not baked into codegen. Source: same file, line 14. Per `docs/design-notes.md` line 25: `hidden` affects visibility only; `readOnly` prevents editing entirely. |
| `readOnly` | `boolean` | `false` | Field excluded from create and edit forms entirely (primary keys, generated columns). Source: same file, line 15. |
| `nullable` | `boolean` | `false` | For `timestamp`, `time`, `numeric`, `date`: allows the field to be cleared (sent as `null`) rather than blocked as invalid when empty. Source: same file, line 16. |
| `hasDefault` | `boolean` | `false` | Shows hint "Leave unchanged to use the database default." on create; exempts from required check while untouched. Source: same file, line 17. |

## Field types

`type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'timestamp' | 'time' | 'numeric'`

| Type | Input | Kept as |
|------|-------|---------|
| `text` | `<input type="text">` | String (always) |
| `number` | `<input type="number">` | Number (always) |
| `boolean` | `<mat-checkbox>` / checkbox | Boolean (always) |
| `date` | `<input type="text">` pattern `YYYY-MM-DD` | String (never `Date`) |
| `timestamp` | `<input type="text">` pattern ISO datetime | String (never `Date`) |
| `time` | `<input type="text">` pattern HH:mm:ss | String (never `Date`) |
| `numeric` | `<input type="text">` pattern decimal digits | String (never `Number`) |

`date`, `timestamp`, `time` and `numeric` remain strings end to end so a calendar date, a zoned time, or a `bigint`/high-precision `numeric` round-trips without rounding through `JSON.parse` or `Date`. Validation uses regex patterns defined in `libs/core/src/lib/field-presentation.ts` lines 15–25.

Source: `libs/core/src/lib/field-presentation.ts` lines 3–48 (`INPUT_TYPE_BY_FIELD_TYPE`, `FORMAT_PATTERN_BY_FIELD_TYPE`, `TEXT_INPUT_BOUND_FIELD_TYPES`).

## List params

`interface ListParams`:

| Property | Type | What it does |
|----------|------|-------------|
| `pagination?.current` | `number` | Page number (1-based). |
| `pagination?.pageSize` | `number` | Rows per page. |
| `sorters?` | `{ field: string; order: 'asc' \| 'desc' }[]` | Sort fields and direction. |
| `filters?` | `readonly Filter[] \| Record<string, FilterValue \| null \| undefined>` | AND-combined filters; shorthand object syntax maps values to `eq`. Values are normalized (`libs/core/src/lib/normalize-filters.ts`) and unsupported operators are rejected (`libs/core/src/lib/reject-unsupported-filters.ts`). Anything else is rejected before a request is sent. |

`interface ListResult<T>`:

| Property | Type | What it holds |
|----------|------|---------------|
| `data` | `T[]` | The loaded rows. |
| `total` | `number` | Total row count for pagination. List parameters are validated before a request is sent (`validate-list-params.ts`). Source: same file, lines 22–25 (`ListResult`). |

Filter operators:

| Operator | Value type | Semantics |
|----------|-----------|-----------|
| `eq` | `string \| number \| boolean` | Equality. Shorthand `{ field: true }` is equivalent to `{ operator: 'eq', value: true }`. |
| `ne` | `string \| number \| boolean` | Inequality. |
| `lt` | `string \| number` | Less than. |
| `lte` | `string \| number` | Less than or equal. |
| `gt` | `string \| number` | Greater than. |
| `gte` | `string \| number` | Greater than or equal. |
| `in` | `readonly FilterValue[]` | Array membership. |
| `contains` | `string` | Case-insensitive substring (text columns only). |
| `null` | `boolean` | Checks for `NULL` values. |

Values accepted by operators: `string`, `number`, or `boolean` (`FilterValue`). Each operator enforces its own type at compile time through TypeScript constraints.

Source: `libs/core/src/lib/list-params.ts` lines 4–19 (`ListParams`), lines 22–25 (`ListResult`); `libs/core/src/lib/filter.ts` lines 1–11 (`Filter`); `libs/core/src/lib/filter-value.ts` line 1 (`FilterValue`); `libs/core/src/lib/filter-operator.ts` line 3 (`FilterOperator`). Exact semantics delegated to [Writing a data provider](../data-providers.md#filters).

## Data provider

`interface DataProvider`:

| Method | Parameters | Returns |
|--------|-----------|---------|
| `getList<T>(resource, params?)` | `resource: string`, `params?: ListParams` | `Promise<ListResult<T>>` |
| `getOne<T>(resource, params)` | `resource: string`, `params: GetOneParams` | `Promise<T>` |
| `create<T>(resource, params)` | `resource: string`, `params: CreateParams<T>` | `Promise<T>` |
| `update<T>(resource, params)` | `resource: string`, `params: UpdateParams<T>` | `Promise<T>` |
| `delete<T>(resource, params)` | `resource: string`, `params: DeleteParams` | `Promise<T>` |

Each CRUD method beyond `getList` takes its own params object instead of positional arguments, so fields like `meta` can be added later without breaking signatures.

Source: `libs/core/src/lib/data-provider.ts` lines 4–13; `libs/core/src/lib/crud-params.ts` (all four param interfaces). See [Writing a data provider](../data-providers.md) for implementation details.

## Authentication

`interface AuthProvider`:

| Member | Type | What it does |
|--------|------|-------------|
| `login(params)` | `(params: LoginParams) => Promise<void>` | Authenticates the user with `email` + `password`. On success the session signal updates automatically. Source: `libs/core/src/lib/auth-provider.ts` line 12. |
| `logout()` | `() => Promise<void>` | Signs out. Session becomes `null`. Source: same file, line 13. |
| `getIdentity()` | `() => Promise<AuthIdentity \| null>` | Loads the current identity. Called once at startup and on each `reload()`. Source: same file, line 14. |
| `onSessionChange?(listener)` | `(listener: () => void) => () => void` | Optional subscription to session events. Returns an unsubscribe function. Source: same file, line 15. |

`interface LoginParams`: `{ email: string; password: string }`. Source: `libs/core/src/lib/auth-provider.ts` lines 1–4.

`interface AuthIdentity`: `{ id: string; email?: string }`. Source: same file, lines 6–9.

See [Authentication and permissions](../authentication.md) for a walkthrough.

## Form payloads

`ResourceForm` builds what it emits with these helpers; a hand-written form can use them too.

| Export | Signature | What it does |
|--------|-----------|--------------|
| `ResourceFormMode` | `'create' \| 'edit'` | The mode `ResourceForm` and `shouldBlockSubmit` switch on. |
| `buildResourcePayload<T>` | `(mode: ResourceFormMode, fields: Field[], draft: T, isDirty: (name: string) => boolean): Record<string, unknown>` | Keeps only the fields that changed (and are not `readOnly`), so the server's default applies to the rest. |
| `shouldBlockSubmit` | `(mode: ResourceFormMode, dirty: boolean, invalid: boolean): boolean` | Blocks an invalid create immediately; in edit it blocks only once the field is touched and invalid. |
| `normalizeResourceValue<T>` | `(fields: Field[], value: T): T` | Turns a record into the draft the form binds to. |

Source: `libs/core/src/lib/resource-form-payload.ts` lines 4, 34, 50 and 65. Where the components call them: [Components reference](./components.md).

## Errors

`class PidrangError extends Error`:

| Property | Type | Meaning |
|----------|------|---------|
| `category` | `PidrangErrorCategory` | Classification for reactive handling. Source: `libs/core/src/lib/pidrang-error.ts` line 5. |
| `code` | `string \| undefined` | Provider-specific error code (Supabase: PostgREST error code). Source: same file, line 6. |
| `status` | `number \| undefined` | HTTP status if applicable. Source: same file, line 7. |
| `cause` | `unknown` | Underlying cause (original exception). Source: same file, line 8. |

`type PidrangErrorCategory = 'unauthenticated' | 'forbidden' | 'not-found' | 'unknown'`. Source: `libs/core/src/lib/pidrang-error-category.ts` lines 1–6.

Each category maps to a user-facing response: `unauthenticated` → ask to sign in; `forbidden` → "not allowed"; `not-found` → record invisible or absent; `unknown` → generic message.

Source: `libs/core/src/lib/pidrang-error.ts` lines 4–17; `libs/core/src/lib/pidrang-error-options.ts` lines 3–8 (`PidrangErrorOptions` passed to the constructor); `libs/core/src/lib/pidrang-error-category.ts` lines 1–6. See [Writing a data provider](../data-providers.md#errors) for how providers construct these errors.

### Tokens and identity

Three `InjectionToken`s are provided by `@pidrang/core`:

| Token | Type | Required | Description |
|-------|------|----------|-------------|
| `DATA_PROVIDER` | `InjectionToken<DataProvider>` | Yes | Registered via `providePidrang({ dataProvider })`. Injected by `injectDataProvider()`. Source: `libs/core/src/lib/tokens.ts` line 7. |
| `RESOURCES` | `InjectionToken<Resource[]>` | Yes | Registered via `providePidrang({ resources })`. Injected by `injectResources()` / `injectResource()`. Source: same file, line 9. |
| `AUTH_PROVIDER` | `InjectionToken<AuthProvider>` | No | Optional — only registered when `authProvider` is passed to `providePidrang()`. Injected with `{ optional: true }`. Source: same file, line 11. |

When `authProvider` is configured, `SESSION_IDENTITY` is also provided: a `WritableSignal<AuthIdentity | null>` created by `watchIdentity`. It starts at `null`, refreshes once at startup and again on every `onSessionChange` notification, and keeps its last value when `getIdentity()` rejects. It is not the same signal as `injectAuthSession().value()`, which starts at `undefined` and becomes `undefined` on error. Source: `libs/core/src/lib/provide-pidrang.ts` lines 23-45 (`watchIdentity`), `libs/core/src/lib/session-identity.ts`, `libs/core/src/lib/auth-session.ts` lines 16-51.
