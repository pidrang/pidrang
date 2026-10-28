# Authentication and permissions

Pidrang authorises nothing on its own. Every guarantee comes from the Row Level Security policies on your Supabase project, and Pidrang neither configures nor verifies them.

## Configure an auth provider

Pass an `AuthProvider` to `providePidrang`:

```ts
providePidrang({
  dataProvider: provideSupabaseDataProvider({ client }),
  authProvider: provideSupabaseAuthProvider({ client }),
  resources,
});
```

Without it, `injectAuthProvider()` throws a descriptive error if anything asks for it. See step 3 of [Getting started](./getting-started.md) for the full wiring.

## Read the session

`injectAuthSession(): AuthSessionRef` loads the identity once and keeps it up to date after each login or logout. It throws when no `authProvider` was passed to `providePidrang()`.

| Member | Type | Meaning |
|--------|------|---------|
| `value()` | `AuthIdentity \| null \| undefined` | `undefined` during initial load, `null` when signed out, `AuthIdentity` when signed in. Updates automatically after login or logout. Source: `libs/core/src/lib/auth-session.ts` lines 25–36. |
| `error()` | `Error \| undefined` | A provider failure during the initial identity load. Check this alongside `value()`. |
| `isLoading()` | `Signal<boolean>` | True between reloads until the identity settles. |
| `reload()` | `() => void` | Force a reload of the identity. With `@pidrang/supabase` the provider already pushes login and logout changes. |

See [Core reference — Reading the session](./reference/core.md#reading-the-session) for details on `AuthSessionRef` and `AuthIdentity`.

## Sign in and out

A sign-in page calls `authProvider.login({ email, password })` and `authProvider.logout()`:

```ts
import { Component } from '@angular/core';
import { injectAuthProvider } from '@pidrang/core';

@Component({ selector: 'app-sign-in-page', template: '' })
export class SignInPage {
  private readonly authProvider = injectAuthProvider();

  protected async login(email: string, password: string): Promise<void> {
    await this.authProvider.login({ email, password });
  }
}
```

See the [Core reference — Authentication](./reference/core.md#authentication) for the `AuthProvider` interface contract.

When `pidrang init` sets up a new app, it asks whether to create a minimal sign-in page at `/sign-in`; on accept (the default) it writes the page and `provideSignInPath('/sign-in')` into `app.config.ts`. Run `pidrang generate auth` to create that page later; see [The sign-in page](./reference/cli.md#the-sign-in-page) for every case where it is written.

## Link your sign-in page

`provideSignInPath(path)` takes a path such as `'/sign-in'`. The helper parses the path once with `DefaultUrlSerializer` and stores the result as a `UrlTree` in the `SIGN_IN_PATH` token, so:

- The path is resolved from the root (a string `routerLink` would be relative to the current page).
- A malformed path stops the app at startup, not every page at runtime.

`provideSignInPath` refuses these values with clear error messages:

| Value | Error |
|-------|-------|
| Empty string, surrounded spaces | `SIGN_IN_PATH must be a path inside the app, such as '/auth/sign-in', got '...'` |
| External URL (`https://...`, `//...`) | Same — external URLs cannot be links inside the app |
| `.` or `..` segments | Same — dot segments are checked on parsed segments, after decoding, so `%2e%2e` is refused too |
| `/your-sign-in-route` | `"SIGN_IN_PATH is still '/your-sign-in-route': replace the placeholder with the path of your app's sign-in page"` |

A well-formed path to a route that does not exist is not detected by `provideSignInPath`; that is the responsibility of your router configuration.

Without a sign-in path configured, the "You may need to sign in" prompt that follows a refused write renders "sign in" as plain text rather than a link. This is intentional: no sign-in page is a valid setup, and nothing throws when `SIGN_IN_PATH` is missing.

Source: `libs/demo-shared/src/lib/provide-sign-in-path.ts`, `parse-sign-in-path.ts`, `sign-in-url.ts`.

## Row Level Security

Enable RLS on every table you expose:

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
```

Read-only tables can stay public. Any table whose `select` policy requires the `authenticated` role sends back empty or refused results to anonymous visitors. Pidrang gives you tools to handle that gracefully — see [Guards on the generated routes](#guards-on-the-generated-routes) below.

Demo policies for the three shared demo tables are defined in `pidrang/supabase` migrations: `select` is public for `users`, `products` and `orders`; `insert`, `update` and `delete` require the `authenticated` role.

## Guards on the generated routes

`canMatchSignedIn(resources: readonly string[]): CanMatchFn` guards resource routes by checking whether the user is signed in. When `authProvider.getIdentity()` returns `null`, navigation through a guarded segment redirects to the sign-in path. The guard lets the navigation through without redirecting in four cases: no `AuthProvider` is configured (`AUTH_PROVIDER` is absent), no sign-in path is provided (see `provideSignInPath`), the first segment is not one of the guarded resources, or `getIdentity()` rejects.

`pidrang init` adds `canMatchSignedIn([...])` to the routes of any table marked as needing a signed-in user:

- The wizard asks `Do your tables need a signed-in user to be read?` after generating the sign-in page.
- Each table name is written into `resource-routes.ts` as a list passed to `canMatchSignedIn`.
- `resource-routes.ts` is regenerated on subsequent runs: an already-guarded file receives new tables appended to the guard list.

How the question is answered depends on the schema strategy:

| Strategy | Per-table reads check? | Source |
|----------|----------------------|--------|
| Postgres (`postgres`) | Yes — queries `pg_class.relrowsecurity`, `has_table_privilege('anon')`, and policy catalog views per table. An anonymous visitor needs `select` privilege with no restrictive conditions. | `libs/cli-supabase/src/lib/postgres-schema-provider.ts` `readsNeedSignIn(table)` at lines 153–204 |
| Secret key / GraphQL | No — both supply only OpenAPI introspection or type definitions, which do not include RLS policies. The wizard asks once on a new app, and the answer applies to all tables. | `libs/cli-supabase/src/lib/supabase-schema-provider-definition.ts` |

A guard is a convenience, not authorization. Row Level Security remains the source of truth. Adding a table later requires regenerating `resource-routes.ts` (running `pidrang init` again), because the names are written statically and read at runtime.

## React to a failure

Every method on `DataProvider` and `AuthProvider` wraps errors in `PidrangError`, which carries a `category` that maps to user-facing responses:

| Category | What the user sees |
|----------|-------------------|
| `unauthenticated` | Ask the user to sign in. Generated pages redirect through `canMatchSignedIn` before they even render. |
| `forbidden` | Display "Not allowed." A RLS deny that reaches the client after a successful sign-in. |
| `not-found` | Indicate the record is invisible or absent. Do not confuse this with a routing 404. |
| `unknown` | Fall back to a generic message. Includes server errors and network failures. |

Each category maps to exactly one response so a page can handle all four with a single switch. The `code`, `status` and `cause` properties give context for logging but should not drive different user flows beyond what the category specifies.

See [Core reference — Errors](./reference/core.md#errors) for the full `PidrangError` contract and [Writing a data provider](./data-providers.md#errors) for how providers construct these errors.

## Troubleshooting

### You may need to sign in

The generated list, create and edit pages display this prompt after a write is refused because the user is not signed in: a delete on the list page, a create on the create page, an update on the edit page.
The show page never shows it, and a read refused by Row Level Security displays the row-level error instead. When `SIGN_IN_PATH` is `null` (no call to `provideSignInPath`) the "sign in" words stay plain text; add `provideSignInPath('/your-path')` to `app.config.ts` to turn them into a link.

### A permission error while signed in

Row Level Security denies access on a table even though the user has logged in successfully. Enable RLS on the table and write explicit policies. A table without RLS enabled (or with RLS disabled) is readable and writable by anyone holding the publishable key, which ships to every browser.

### A resource list shows no rows

RLS on a read-only table may reject anonymous requests. If the table should be public, add a permissive `SELECT` policy for `anon` or `public` without a condition. If the table should be private, verify that `canMatchSignedIn` covers its routes and that the user is signed in.
