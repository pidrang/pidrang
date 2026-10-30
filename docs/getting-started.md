# Getting started

Pidrang turns the tables of a Supabase project into an Angular admin: a list, create, show and edit page for each table, with sign-in. `pidrang init` reads your schema and generates it. This page sets up a new app, then an existing one; to write the pages by hand instead, see [Write the pages yourself](./manual-setup.md).

## Prerequisites

- Node.js 22.22.3 or a later 22.x, 24.15.0 or a later 24.x, or 26 and later. `pidrang init` checks it and stops with a plain message on anything else.
- An Angular 22.1 or a later 22.x application using standalone APIs and the router, as `ng new` creates it.
- A Supabase project with at least one table that has an `id` primary key column. Pidrang assumes `id` on every table; composite or differently named keys are not supported.
- The project URL and the publishable key (formerly anon, `sb_publishable_...`), shown by the Connect button at the top of the Supabase dashboard.

Two working examples show the result: [demo-material](https://pidrang.dev/demo-material/) and [demo-tailwind](https://pidrang.dev/demo-tailwind/), the same three resources on the two UI layers, listed at [pidrang.dev/demos](https://pidrang.dev/demos/).

## Choose your path

- **New app**: an app just created by `ng new`. `init` generates and wires everything, including a layout with a menu of the tables.
- **Existing app**: an app with its own pages and routes. `init` adds the pages and the routes next to yours, and leaves the entry of the app to you.
- **No CLI**: [Write the pages yourself](./manual-setup.md) with the same components.

`init` treats an app as new when `src/app/app.html` still holds the welcome page of `ng new` and `app.routes.ts` declares no route. Anything else is an existing app.

## New app

```bash
ng new my-admin
cd my-admin
npx pidrang init
```

`init` asks, in order:

1. The project URL of your Supabase project.
2. How to read your table definitions: the secret key, a direct database connection, or GraphQL with the publishable key. The secret key and the database password are used to read the schema only; `init` does not write them into the app.
3. The tables to scaffold, the actions each one supports (list, create, show, edit, delete) and the fields to hide.
4. Whether to add the navigation layout and the sign-in page, both yes by default, and whether your tables need a signed-in user to be read.
5. Whether to install the packages the app is missing among `@pidrang/core`, `@pidrang/supabase`, `@supabase/supabase-js` and `@pidrang/material`, and to run `ng add @angular/material`.

It writes `src/environments/environment.ts` and `environment.development.ts` with your project URL and a placeholder for the key. Replace `supabasePublishableKey` in both with the publishable key of the project: the app runs in the browser, so never put the secret key or the database password there.

```bash
ng serve
```

Open `http://localhost:4200`. The app opens on the list of the first table you picked, or on the sign-in page when your tables need a signed-in user to be read. The menu of the layout lists the tables, and its Sign in link opens `/sign-in`.

What `init` wrote:

- `src/app/resources.ts`: one `Resource` per table, with its typed fields. Edit it to rename a label, hide a field or turn an action off.
- `src/app/resource-routes.ts`: the routes `:resource`, `:resource/create`, `:resource/:id` and `:resource/:id/edit`, with their guards, and the `sign-in` route.
- `src/app/pages/` and `src/app/pidrang/`: the List, Create, Show, Edit and sign-in pages, and the helpers they call.
- `src/app/layout/`: the navigation layout.
- `app.config.ts`, `app.routes.ts` and `app.html`, edited to register Pidrang, add the routes and host the layout.

The pages are rendered with Angular Material. The layout follows the UI layer of the app: Tailwind when `package.json` declares `@pidrang/tailwind`, Angular Material otherwise. Every file and every option is in [the CLI reference](./reference/cli.md).

## Existing app

From the workspace root of the app:

```bash
npx pidrang init
```

It asks the same questions, except the layout, which an existing app never gets, and the sign-in page, which it writes unless `app.routes.ts` already declares a `sign-in` route. Then it:

- Writes `resources.ts`, `resource-routes.ts`, the pages and the helpers, as on a new app. A file that already exists with other content stops `init` before it writes anything, and lists the paths: move or rename yours, then run it again.
- Adds `...resourceRoutes` at the top of the routes array of `app.routes.ts`, and registers Pidrang and `withComponentInputBinding()` in `app.config.ts`.
- Replaces the welcome page of `app.html` with `<router-outlet />`, and leaves a template that already has an outlet as it is.
- Writes the environment files when the app has none. When it has, `init` prints the `supabaseUrl` and `supabasePublishableKey` lines to add to `src/environments/environment.ts`.

When a file cannot be edited safely, `init` adds a `pidrang` comment at its top that lists the exact change to make.

Two things stay with you:

- **The entry of the app.** Your own `''` route keeps opening your home page. When the app has none, `init` prints the redirect to add above your other routes, for example `{ path: '', pathMatch: 'full', redirectTo: '/products' }`. The generated pages are at `/<table>` either way.
- **The sign-in guard.** For the tables that need a signed-in user to be read, `init` adds the guard only on a new app, or extends the one an earlier run wrote. On an existing app it names those tables instead; see [Guards on the generated routes](./authentication.md#guards-on-the-generated-routes).

To add a table later, run `init` again: see [A second run](./reference/cli.md#a-second-run).

## Row Level Security

`@pidrang/supabase` performs no authorization. Every guarantee comes from your Supabase RLS policies — see [Row Level Security](./authentication.md#row-level-security).

## Choosing a UI layer

`@pidrang/material` and `@pidrang/tailwind` expose the same components, with different styling. Material needs a Material theme; Tailwind ships no CSS and needs a `@source` line in your global stylesheet. See [UI layers](./ui-layers/index.md), and [Angular Material](./ui-layers/material.md) or [Tailwind CSS](./ui-layers/tailwind.md) for the setup of each one.

## Troubleshooting

The app still shows the Angular welcome page: `app.html` still holds it. Init replaces that template with `<router-outlet />` or the navigation layout; if you had already changed the file and it has no outlet, the page renders nothing below your content, so add `<router-outlet />` where the pages should appear.

`ng build` warns that the initial bundle exceeded its budget: the budget `ng new` sets warns above 500 kB, and an app with the Supabase client, Angular Material and the layout starts above it (about 690 kB with the layout) even though the pages load lazily. It is a warning, the build succeeds; raise `maximumWarning` in the `budgets` of `angular.json` if you want it gone.

The Sign in button does nothing and the console shows the router error `NG04002` (`Cannot match any routes. URL Segment: 'sign-in'` in a development build): `provideSignInPath('/sign-in')` is set but no sign-in page is, and the resource routes do not match a name that is not a resource. Run `pidrang generate auth`, add your own sign-in page at `/sign-in`, or change the path in `app.config.ts`.

The URL changes but a page stays blank: `provideRouter` has no `withComponentInputBinding()`. The pages read `:resource` and `:id` from their inputs and render nothing without it. Init adds it to the existing `provideRouter(...)` call; if your app config could not be edited, the `// pidrang:` comment at the top of the file shows the line to write.

`/products` opens the not-found route: `...resourceRoutes` is missing from `routes`, or sits below a `**` route, which matches everything. It belongs at the top of the array, with your fixed paths after it.

The table is empty: see [Authentication troubleshooting](./authentication.md#troubleshooting) — RLS on read-only tables, missing guards, or an unsigned-in user on a private table.

Saving says you may need to sign in, or returns a permission error: see [Authentication troubleshooting](./authentication.md#troubleshooting) — plain text sign-in prompt when `provideSignInPath` is not configured, or RLS denying access after login.

Requests fail with an invalid API key or do not reach Supabase: `supabaseUrl` and `supabasePublishableKey` in `src/environments/environment.ts` are still the placeholders, point to another project, or hold a key that was rotated. Both values are shown by the Connect button at the top of your project's Supabase dashboard; use the publishable key (formerly anon), never the secret key or the database password.

## Next steps

- [Write the pages yourself](./manual-setup.md): the same pages built by hand, step by step.
- [Architecture](./architecture.md): how core, the data providers and the UI layers fit together.
- [`ROADMAP.md`](../ROADMAP.md): what is planned.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md): how to contribute.
