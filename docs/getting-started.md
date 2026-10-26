# Getting started

This guide takes a new Angular app to a working admin panel backed by Supabase: a list page, a create form and per-row actions, all driven by one `Resource` definition.

## Prerequisites

- An Angular 22 application using standalone APIs and the router (`ng new my-admin`).
- A Supabase project with at least one table that has an `id` primary key column. Pidrang assumes `id` on every table; composite or differently named keys are not supported.
- The project URL and the publishable key (formerly anon, `sb_publishable_...`), shown by the Connect button at the top of the Supabase dashboard.

## 1. Install

```bash
npm install @pidrang/core @pidrang/supabase @pidrang/material @supabase/supabase-js
ng add @angular/material
```

`@pidrang/material` is one of two UI layers. To use Tailwind instead, install `@pidrang/tailwind` and skip `@angular/material`; see [Choosing a UI layer](#choosing-a-ui-layer).

When you generate the app with [`pidrang init`](#generating-resources), it offers to run these commands for you.

## 2. Describe your resources

A `Resource` names a table and lists its typed fields. UI layers render tables and forms from `fields`, so you never hand-write a column or an input.

```ts
import { Resource } from '@pidrang/core';

export const resources: Resource[] = [
  {
    name: 'products',
    fields: [
      { name: 'id', type: 'text', readOnly: true },
      { name: 'name', type: 'text' },
      { name: 'price', type: 'number' },
      { name: 'in_stock', label: 'In stock', type: 'boolean' },
      {
        name: 'created_at',
        label: 'Created at',
        type: 'timestamp',
        readOnly: true,
        hasDefault: true,
      },
    ],
  },
];
```

`name` must match the Supabase table name. Field types are `'text'`, `'number'`, `'boolean'`, `'date'`, `'timestamp'`, `'time'` and `'numeric'`. `date`, `timestamp`, `time` and `numeric` are kept as plain strings end to end, never converted through `Date` or `Number`, so a calendar date, a zoned time or a `bigint`/high-precision `numeric` value round-trips without losing anything. `label` overrides the column header and form label; `hidden: true` marks a field a generic list or edit page should skip. `readOnly: true` keeps a field out of create/edit forms entirely — use it for a primary key or any column the database generates. An untouched field is left out of what gets saved — on create and on edit alike — so the server's own default or `NULL` applies instead of a client-side placeholder. The one exception is a `boolean` or `number` without `hasDefault` on create: an unchecked box is a real `false` and a `0` in a number input is a real `0`, so the value shown is sent. `hasDefault: true` also shows a hint ("Leave unchanged to use the database default.") on create so the user knows a blank field isn't actually going to be sent blank, and exempts the field from the "required" check below while it's still untouched. `nullable: true` lets a `timestamp`/`time`/`numeric`/`date` field be cleared (sent as `null`) rather than blocked as invalid when empty — without it, a non-nullable one of those four types blocks submit with an inline hint if left empty (once touched, or once a submit is attempted). `list`, `create`, `show`, `edit` and `delete` are optional flags, enabled when omitted; set one to `false` to hide that action and refuse its route in the generic pages. `defaultSorters` sets the order of the generic list page, with the same shape as the `sorters` of `ListParams` (for example `[{ field: 'created_at', order: 'desc' }, { field: 'id', order: 'asc' }]` to show the newest rows first); without it, the list is sorted by `id`.

Instead of writing this by hand, the `pidrang init` CLI can introspect your Supabase schema and generate `resources.ts` for you. See [Generating resources](#generating-resources).

## 3. Register Pidrang

Create a Supabase client once and hand it to both providers. `providePidrang` is the only place that touches Angular DI.

```ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { providePidrang } from '@pidrang/core';
import { provideSupabaseAuthProvider, provideSupabaseDataProvider } from '@pidrang/supabase';
import { createClient } from '@supabase/supabase-js';

import { appRoutes } from './app.routes';
import { resources } from './resources';

const client = createClient('https://YOUR-PROJECT.supabase.co', 'YOUR-PUBLISHABLE-KEY');

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutes),
    providePidrang({
      dataProvider: provideSupabaseDataProvider({ client }),
      authProvider: provideSupabaseAuthProvider({ client }),
      resources,
    }),
  ],
};
```

`authProvider` is optional. Without it, `injectAuthProvider()` throws a descriptive error if something asks for it.

## 4. Build a list page

`injectResourceList` wraps `DataProvider.getList` in Angular's native `resource()`, so `value()`, `isLoading()`, `error()` and `reload()` are all signals. Passing a function as the resource name lets one component serve every resource from a route parameter.

```ts
import { Component, computed, input } from '@angular/core';
import { injectResourceList, injectResources } from '@pidrang/core';
import { ResourceTable } from '@pidrang/material';

type Row = { id: string } & Record<string, unknown>;

@Component({
  selector: 'app-resource-list-page',
  imports: [ResourceTable],
  template: `
    <h1>{{ resource() }}</h1>

    @if (list.isLoading()) {
      <p>Loading...</p>
    }
    @if (list.error(); as error) {
      <p>{{ error.message }}</p>
    }

    <pidrang-material-resource-table [fields]="fields()" [data]="list.value()?.data ?? []" />
  `,
})
export class ResourceListPage {
  readonly resource = input.required<string>();

  private readonly resources = injectResources();
  protected readonly list = injectResourceList<Row>(() => this.resource());
  protected readonly fields = computed(() => this.resources.find((resource) => resource.name === this.resource())?.fields?.filter((field) => !field.hidden) ?? []);
}
```

Route it with a `:resource` segment and enable input binding so the route parameter reaches the `resource` input:

```ts
import { Route } from '@angular/router';
import { ResourceListPage } from './resource-list-page';

export const appRoutes: Route[] = [{ path: ':resource', component: ResourceListPage }];
```

```ts
provideRouter(appRoutes, withComponentInputBinding());
```

Open `/products` and the table renders one column per non-hidden field.

To page, sort or filter, pass a params function as the second argument. Returning `undefined` from it skips loading. Without pagination, `getList` returns the first 10 rows. `current` and `pageSize` must be positive integers, each sorter needs a `field` and an `order` of `asc` or `desc`, and filters must fit their operator; anything else is rejected before a request is sent. `ListResult.total` holds the full row count, so you can build a pager.

```ts
injectResourceList<Row>(
  () => this.resource(),
  () => ({
    pagination: { current: this.page(), pageSize: 20 },
    sorters: [{ field: 'created_at', order: 'desc' }],
    filters: [
      { field: 'in_stock', operator: 'eq', value: true },
      { field: 'name', operator: 'contains', value: 'mouse' },
    ],
  }),
);
```

Filters combine with AND. The operators are `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`, `contains` (case-insensitive, text columns only) and `null`; each operator only accepts its own value type, so `filters: [{ field: 'tags', operator: 'in', value: 'x' }]` does not compile; the shorthand `filters: { in_stock: true }` still works for equality. See [Writing a data provider](./data-providers.md#filters) for the exact semantics.

## 5. Per-row actions

`ResourceTable` projects an `#actions` template as a trailing column with an `Actions` header. The row is available as the implicit context variable. A data field may itself be named `actions`: it gets its own column next to the projected one.

```html
<pidrang-material-resource-table [fields]="fields()" [data]="list.value()?.data ?? []">
  <ng-template #actions let-row>
    <a [routerLink]="['/', resource(), row.id, 'edit']">Edit</a>
    <button type="button" (click)="remove(row.id)">Delete</button>
  </ng-template>
</pidrang-material-resource-table>

@if (deleteError(); as message) {
<p role="alert">{{ message }}</p>
}
```

The template uses `routerLink`, so add `RouterLink` from `@angular/router` to the `imports` of the component. Deleting is irreversible, so ask for confirmation and surface a failure (for example a Row Level Security rejection) instead of letting the promise reject silently.

```ts
private readonly dataProvider = injectDataProvider();
protected readonly deleteError = signal<string | null>(null);

protected async remove(id: string): Promise<void> {
  if (!confirm('Delete this record?')) {
    return;
  }
  try {
    await this.dataProvider.delete(this.resource(), { id });
    this.deleteError.set(null);
    this.list.reload();
  } catch (error) {
    this.deleteError.set(error instanceof Error ? error.message : String(error));
  }
}
```

The list pages of `apps/demo-material` and `apps/demo-tailwind`, and the pages `pidrang init` generates, go further: they block repeated clicks while a delete is in flight, keep deletes of that resource blocked across visits until it settles and, when you come back before it settles, say how it ended, keep the row on failure, and use the `PidrangError` `category` to ask the user to sign in on `unauthenticated` or say the user is not allowed on `forbidden`. The sign-in prompt is plain text unless your app calls `provideSignInPath`, see [Generating resources](#generating-resources).

`DataProvider` exposes `getList`, `getOne`, `create`, `update` and `delete`. Each takes the resource name and a params object (`{ id }`, `{ data }` or `{ id, data }`).

## 6. Create and edit forms

`ResourceForm` renders one input per field, built on Angular Signal Forms. It never mutates the `value` you pass in; it emits a payload through `save`, which only ever contains a field you actually changed — on create as much as on edit — so the server's own default or `NULL` applies to anything left alone, and a precise `numeric` or a zoned `timestamp` round-trips unchanged instead of being re-serialized. The required `[mode]` input is `'create'` or `'edit'`: on edit, `save` does not emit at all when nothing was changed, since there would be nothing to `PATCH`; on create it still emits (possibly an empty object), since creating a row from nothing but defaults is a normal thing to do.

```ts
import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { injectDataProvider, injectResources } from '@pidrang/core';
import { ResourceForm } from '@pidrang/material';

@Component({
  selector: 'app-resource-create-page',
  imports: [ResourceForm],
  template: `
    <h1>Create {{ resource() }}</h1>
    <pidrang-material-resource-form mode="create" [fields]="fields()" [value]="initialValue()" (save)="submit($event)" />
  `,
})
export class ResourceCreatePage {
  readonly resource = input.required<string>();

  private readonly dataProvider = injectDataProvider();
  private readonly router = inject(Router);
  private readonly resources = injectResources();

  protected readonly fields = computed(() => this.resources.find((resource) => resource.name === this.resource())?.fields?.filter((field) => !field.readOnly) ?? []);

  protected readonly initialValue = computed(() => Object.fromEntries(this.fields().map((field) => [field.name, field.type === 'number' ? 0 : field.type === 'boolean' ? false : ''])));

  protected async submit(data: Record<string, unknown>): Promise<void> {
    await this.dataProvider.create(this.resource(), { data });
    await this.router.navigate(['/', this.resource()]);
  }
}
```

`readOnly: true` (on `id`, or on any column the database generates or defaults, like `created_at` above) keeps that field out of the form entirely, on both create and edit. Bind `[pending]` to a signal that is `true` while the save runs: the form then disables its submit button and ignores further submits, so a double click cannot create two rows. An edit page is the same component with `mode="edit"`, fed with `dataProvider.getOne(resource, { id })` as the initial value and `dataProvider.update(resource, { id, data })` on save. The complete List, Create, Show and Edit pages live in [`apps/demo-material`](../apps/demo-material/src/app/pages). They go further: the flag is held per record (per resource for a create) across visits, a page that comes back while a save runs waits for it and then says whether it finished or failed, a request with no answer after 30 seconds shows a message above a disabled form, on every page of that record, until the server answers and the page says how that save ended, and a save whose next page does not open says it was saved. See [the save lock](./design-notes.md#the-save-lock-keeps-only-running-saves-with-a-30-second-timeout) for how it works and its limits.

## 7. Sign in

If your Row Level Security policies require the `authenticated` role for writes (recommended), give users a way to sign in.

```ts
import { injectAuthProvider } from '@pidrang/core';

const authProvider = injectAuthProvider();
await authProvider.login({ email, password });
```

`injectAuthSession()` returns an `AuthSessionRef` for the current identity: `value()` is `undefined` while loading, `null` when signed out, an `AuthIdentity` when signed in. It updates on its own after login and logout, and it never throws: check `error()` for a provider failure.

```ts
protected readonly session = injectAuthSession();
```

## Row Level Security

`@pidrang/supabase` performs no authorization of its own. Every guarantee comes from the RLS policies on your Supabase project, and Pidrang neither configures nor verifies them. A table with RLS disabled is readable and writable by anyone holding the anon key, which ships to every browser. Enable RLS on each table you expose and write explicit policies before deploying.

## Choosing a UI layer

| Package             | Styling                  | Notes                                                                              |
| ------------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| `@pidrang/material` | Angular Material         | Requires `@angular/material` and a Material theme.                                 |
| `@pidrang/tailwind` | Tailwind utility classes | Ships no CSS. Add the library to your Tailwind build so its classes are generated. |

Both expose the same `ResourceTable` and `ResourceForm` inputs and outputs. Each adapter has its own selectors, `pidrang-material-resource-table`/`pidrang-material-resource-form` and `pidrang-tailwind-resource-table`/`pidrang-tailwind-resource-form`, so an app can use both, and switching is a change of import and of the element name. For Tailwind, add a `@source` line pointing at the installed package in your global stylesheet:

```css
@import 'tailwindcss';
@source '../node_modules/@pidrang/tailwind';
```

Adjust the relative path to where your stylesheet sits. See [`apps/demo-tailwind`](../apps/demo-tailwind) for a working setup.

## Generating resources

Run `pidrang init` from the root of an Angular 22.1 (or later 22.x) standalone app, laid out as `ng new` creates it with routing. It connects to a Supabase project, lets you pick tables and CRUD actions, and writes a typed `resources.ts`, the `resource-routes.ts` that lists them, and generic List, Create, Show and Edit pages for `@pidrang/material` into the app folder of the application in `angular.json` (`src/app` for a new app; pass `--project <name>` when the workspace has several).

When a table has a `created_at` column of type `timestamp` or `date`, even a hidden one, the generated `Resource` gets `defaultSorters` with `created_at` descending, then `id`, so a new row shows on the first page. Other tables are sorted by `id`.

Each table and column gets a readable `label` made from its name (`fixture_items` becomes `Fixture items`, `createdAt` becomes `Created at`), which the page titles, the menu, the table headers and the form fields show. A `created_at` or `updated_at` column of type `timestamp` with a database default is generated with `readOnly: true`, so the forms leave it to the database.

It asks for the project URL first, then how to read your table definitions. The default is the secret key (formerly service role, `sb_secret_...`; the legacy `service_role` key still works), from Project Settings, API Keys in the Supabase dashboard: it is only used to read the schema and is never written to disk or into the app. The other choices are a direct database connection and GraphQL with the publishable key (formerly anon), which requires the `pg_graphql` extension (not enabled on a new project). A key Supabase refuses is asked again, and so is a publishable key given where the secret key is expected or the other way round. When `pg_graphql` is off the wizard offers to continue with the secret key.

It also wires the app itself, so nothing has to be pasted by hand:

- `app.config.ts`: imports `providePidrang`, `provideSupabaseDataProvider`, `provideSupabaseAuthProvider` and `createClient`, creates the Supabase client once, adds `providePidrang({ dataProvider, authProvider, resources })` to `providers`, and adds `withComponentInputBinding()` to the existing `provideRouter(...)` call. Input binding is required: the pages receive the resource name and the record id as inputs, and stay blank without it.
- `app.routes.ts`: adds `import { resourceRoutes } from './resource-routes';` and `...resourceRoutes` at the top of the `routes` array, above any `**` route. Your own fixed paths such as a sign-in page still work: the resource routes skip a name that is not a resource. On a new app it also redirects `''` to the first generated page, see [A new app and an existing app](#a-new-app-and-an-existing-app).
- `app.html`: replaces the welcome template `ng new` writes with `<router-outlet />`, or with the navigation layout when you ask for it, so the routes have somewhere to render. A template you already changed is left alone; if it has no router outlet, init adds the `pidrang` comment described below (delete it when a component of the template already holds the outlet).
- `app.ts`: only with the navigation layout, adds `AppLayout` to the `imports` of the root component, in place of `RouterOutlet` when nothing else uses it.
- `app.spec.ts`: when init replaces the welcome template, it also removes the `should render title` test `ng new` writes, which reads the welcome `h1` and would make `ng test` fail. Another test that reads that `h1` is left in place, and init lists it in a `pidrang` comment. With the navigation layout, it also keeps the layout out of the root component test (see below).
- `src/environments/environment.ts` and `environment.development.ts`: created when the app has neither, with a `supabaseUrl` and a `supabasePublishableKey` placeholder, plus the development file replacement in `angular.json`. When an environment file already exists, the missing lines are printed instead and you add them there.

`resource-routes.ts` loads each page with `loadComponent`, so Angular Material's table and form code is not in the initial bundle.

### A new app and an existing app

Init treats the app as new when `app.routes.ts` exports an empty `routes` array and `app.html` still holds the welcome template of `ng new`. Only a new app gets these, since an app with its own routes and shell already decides what it opens on:

- a redirect from `''` to the list of the first table that has one, or to the create page of the first table that has one when no table has a list: `{ path: '', pathMatch: 'full', redirectTo: '/products' }`;
- the question `Generate a navigation layout?` (yes by default), or the `layout` key of a plan;
- guards on the routes of the tables whose rows an anonymous visitor cannot read, so the app opens on the sign-in page instead of an empty list: see [When the tables need a signed-in user](#when-the-tables-need-a-signed-in-user).

The navigation layout is a header with the app name, the signed-in user's email, a Sign in or Sign out button and a Menu button, and a side menu with Home and one link per resource (its list, or its create page when it has no list). On a screen narrower than 48rem (768 px), the side menu starts hidden, opens over the page from the Menu button and closes after you pick a link (the focus goes back to the Menu button) or tap outside it; a wide list scrolls sideways inside the page, never the whole screen. On a wider screen it starts open beside the page and stays open. Init writes it to `src/app/layout/app-layout.ts`, with Angular Material, or with Tailwind classes when your `package.json` lists `@pidrang/tailwind` (the generated pages themselves use Angular Material either way). Then it:

- replaces `app.html` with `<app-layout appName="..." />`, the name being your project name from `angular.json` (`my-admin` shows as `My admin`);
- adds `AppLayout` to the `imports` of `app.ts`;
- adds this to the `beforeEach` of `app.spec.ts`, because the layout needs `providePidrang`, which the root component test does not provide:

  ```ts
  TestBed.overrideComponent(App, {
    remove: { imports: [AppLayout] },
    add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
  });
  ```

- adds `provideSignInPath('/sign-in')` to `app.config.ts`, so the Sign in button and the sign-in prompts of the pages link to `/sign-in`. A new app is also asked `Generate a sign-in page at /sign-in?` (yes by default), or takes the `signIn` key of a plan; see [The sign-in page](#the-sign-in-page).

In an app that is not new, init only adds the resource routes, prints the redirect line to add yourself (unless `app.routes.ts` already declares a `''` route), never writes the layout, and adds no sign-in guard.

### When the tables need a signed-in user

When the `select` policy of a table only lets the `authenticated` role read it, a new app that opens on that table shows an empty list or an error, since init leaves the app anonymous. Init asks `Do your tables need a signed-in user to be read?` (no by default) after the sign-in page question, and only when it will write that page, or takes `readsNeedSignIn` from a plan, and, on a new app whose sign-in page it writes, guards the resource routes of those tables:

```ts
{
  path: ':resource',
  loadComponent: () =>
    import('./pages/resource-list-page').then(
      (page) => page.ResourceListPage,
    ),
  canMatch: [
    canMatchSignedIn(['orders']),
    canMatchResourceAction('list'),
  ],
},
```

`/` then opens the sign-in page, and a signed-out visitor of one of those pages is sent there too. After signing in, the sign-in page opens `/`, which redirects to the first list, so the app lands on its first screen. Only the routes of the tables marked that way are guarded, so a public table still opens for a signed-out visitor next to a private one. The guard is written by init, not read at run time: it is emitted into `src/app/pidrang` and `resource-routes.ts` names the tables it covers, so a table added later is covered only after init runs again. Run it again with the new table: when `resource-routes.ts` is still the one init wrote, the new private tables join its guard (with the secret-key and GraphQL strategies init asks again whether the tables need a signed-in user) and the tables already guarded stay guarded; do not delete the file, since it is the only record of which tables are guarded, and an app that is no longer new gets no guard written from scratch. A `resource-routes.ts` you edited is left alone, and init stops on it as on any file in the way. With `"signIn": false`, or in an app that keeps its own routes, init writes no new guard: it would send the visitor to a path with no page. A guard an earlier run wrote still gets the new private tables, whatever `signIn` says this time. It then says which tables it left unguarded and why.

With the direct database connection, init answers per table from the catalog rather than asking: the table's row level security, the `select` policies for the anonymous role, and its `select` grant. A table is public when `anon` holds `select` on it, row security is off or at least one permissive policy for `anon` or `public` has no condition of its own, and no restrictive policy applies; it is private otherwise, including when the policy has a condition, even one an anonymous visitor passes, and when `anon` has no `select` grant at all, since policies grant nothing by themselves. The secret-key and GraphQL strategies cannot read policies from what they see (PostgREST's OpenAPI document and `pg_graphql`'s introspection), so they use the question, or `readsNeedSignIn` in a plan, for every table of the run. The answer changes where the app opens, not the generated `Resource`, so `resources.ts` does not record it.

The publishable key is always written as a placeholder: put your project URL and publishable key (formerly anon) in the environment file. Init never writes the database password or the secret key into the app, and the app runs in the browser, so it must only ever get the publishable key.

Once the files are written, it asks `Install the required packages? (Y/n)`. On yes, it installs `@pidrang/core`, `@pidrang/supabase`, `@pidrang/material` (all three at the version of the CLI) and `@supabase/supabase-js`, then runs `ng add @angular/material`, which asks its own questions and sets up a theme. A package already declared in `package.json` and installed is left out, as long as an `@pidrang` one is at the version of the CLI, and `ng add` only runs when `@angular/material` is missing. When nothing is missing, it says so and asks nothing.

The package manager is the one `cli.packageManager` in `angular.json` names, then the `packageManager` field of `package.json`, then the closest lockfile from the app folder up to the git root (`pnpm-lock.yaml`, `yarn.lock`, `bun.lock` or `bun.lockb`, `package-lock.json`), and npm when there is none. A package manager it cannot run, such as `cnpm`, gets the commands printed instead. On no, when a command fails or is interrupted, with `--skip-install` or with `--plan`, it prints the commands still to run, `<version>` being the version of the CLI:

```text
Install the packages manually, then run ng build:
  npm install @pidrang/core@<version> @pidrang/supabase@<version> @supabase/supabase-js @pidrang/material@<version>
  npx ng add @angular/material
```

Before anything else, it checks Node.js against the versions pidrang supports (22.22.3 or a later 22.x, 24.15.0 or a later 24.x, 26 and later) and Angular against 22.1 or a later 22.x, and stops with a plain message when one does not fit.

It checks everything before writing anything. A folder it does not recognize, a table named like one of your routes, or an invalid answer stops it with nothing written. It never overwrites a file: when one it would write already exists with other content, it lists every such file and writes nothing at all. A file that already matches is left as it is, so running it again with the same answers is harmless. To add a table later, run it again and pick it: an existing `resources.ts` is edited, not replaced. One that does not export `resources` is not one init wrote, and stops init as a file in the way; without `typescript` next to the app, so does one that no longer starts with the import and the `export const resources: Resource[] = [` init wrote. The tables it does not list yet are appended at the end of its `resources` array; a table it already lists is left exactly as it is, even if you edited it or its columns changed since (init says so, `products is already in src/app/resources.ts, left as it is.`), and a table you leave out is never removed. A plan is still checked against the schema for every table it lists, including one already in `resources.ts`: if a hidden field of that table was renamed since, update or drop it in the plan, or list only the new tables. An app whose first run wrote the navigation layout keeps it as it is. On an app whose first run guarded its private tables (see [When the tables need a signed-in user](#when-the-tables-need-a-signed-in-user)), a new private table joins that guard; an app whose first run guarded nothing gets no guard on a later run. Edits are made on the syntax tree, not by text replacement, and a file that already has what init would add is left untouched. When a file cannot be edited safely (no `typescript` installed next to the app, a `providers` array built at run time, several application configs), init adds a comment that starts with `// pidrang:` (or `<!-- pidrang:` in `app.html`) at the top of the file, listing the exact change to make, and writes nothing else in it. `pidrang --help` lists the options.

To run it without questions, for example in CI, put the answers in a plan file and pass the credentials as environment variables (`PIDRANG_SUPABASE_PUBLISHABLE_KEY`, `PIDRANG_SUPABASE_SECRET_KEY` or `PIDRANG_DATABASE_PASSWORD`, depending on the strategy); a credential written in the file is refused. The names of 0.1.0 still work and print a deprecation warning: `PIDRANG_SUPABASE_ANON_KEY` for `PIDRANG_SUPABASE_PUBLISHABLE_KEY`, `PIDRANG_SUPABASE_SERVICE_ROLE_KEY` for `PIDRANG_SUPABASE_SECRET_KEY`, and the `service-role` strategy for `secret-key`. When both names of a key are set, the new one wins:

```json
{
  "provider": "supabase",
  "connection": { "strategy": "secret-key", "url": "https://abcdefgh.supabase.co" },
  "tables": [{ "table": "products", "actions": ["list", "create", "show", "edit", "delete"], "hiddenFields": ["created_at"] }],
  "layout": "sidebar",
  "signIn": true,
  "readsNeedSignIn": false
}
```

```sh
PIDRANG_SUPABASE_SECRET_KEY=<your secret key> npx pidrang init --plan plan.json
```

`layout` is `"sidebar"` for the navigation layout or `"none"` (the default), and only applies to a new app: on another app, init prints that it did not add the layout and goes on. `signIn` is `true` to generate the sign-in page or `false` (the default) to leave it out; without a plan, init asks on a new app and generates it without asking on an app that already exists. `readsNeedSignIn` is `true` to treat every table as needing a signed-in user and `false` (the default) otherwise; it only changes the routes of a new app, or of an app whose `resource-routes.ts` init wrote with a guard, and the direct database connection answers per table instead, see [When the tables need a signed-in user](#when-the-tables-need-a-signed-in-user). The same answers give the same files as the questions. It exits with `0` when done or when there is nothing to write, `1` on an invalid plan, an unsupported Node.js or app, a file in the way or a failed install (the files are written then), and `130` when cancelled.

When a write fails because the user is not signed in, the generated pages say "You may need to sign in" as plain text, since they cannot know where your sign-in page lives. With the navigation layout, init already wrote `provideSignInPath('/sign-in')`, see above. Otherwise, to make it a link, provide the path once in `app.config.ts` (the CLI prints this snippet too), replacing `/your-sign-in-route` with your sign-in page's path. It must be a route of your Angular app: the link navigates inside the app, so a sign-in handled by the server or another site (an OAuth redirect, `https://…`) cannot be linked and the prompt stays plain text. `provideSignInPath` throws while the app config is built when the path is not a string, is empty, has spaces at either end, uses `.` or `..` segments, is a full URL or is malformed (`/%`), so those stop the app at startup. So is the `/your-sign-in-route` placeholder left as printed. A well-formed path to a route that does not exist cannot be caught there and lands on your not-found route, A path whose first segment is one of your resource names (`/users/sign-in` with a `users` resource) works only if your sign-in route is declared above `resourceRoutes`; below them, the link opens the Show page of a record whose id is `sign-in`. It is resolved from the app root and may carry a query string:

```ts
import { provideSignInPath } from './pidrang/provide-sign-in-path';

provideSignInPath('/your-sign-in-route');
```

Pages generated by an older `pidrang init` keep their hard-coded `/login` link and ignore this provider. Running the current CLI over them stops with those files listed; delete `src/app/pages` and `src/app/pidrang` together (the current pages need the current helpers) and run it again.

### The sign-in page

`pidrang init` can generate a sign-in page, so a new app can sign in and write rows without any code of your own. A new app is asked `Generate a sign-in page at /sign-in?` (yes by default); an app that already exists gets the page without being asked, unless its plan says `"signIn": false`. `pidrang generate auth` adds the page to an app with neither, asks nothing, and is the command to run on an app init has already set up.

The page has an email and a password field and signs in with `authProvider.login`; it shows the signed-in email and a Sign out button, and shows the error when the sign-in fails. After a successful sign-in it opens `/`, so a test can sign in, then create, edit and delete through the generated pages. It is written to `src/app/pages/sign-in-page.ts` with Angular Material, or with Tailwind classes when your `package.json` lists `@pidrang/tailwind`, and uses the helpers of `src/app/pidrang`. The generated `resource-routes.ts` is written once, and its `sign-in` route comes before the resource routes, so no resource name shadows the path; when your `app.routes.ts` already declares a `sign-in` route, pidrang leaves the page to it and writes none, and `resource-routes.ts` lists no `sign-in` route either. init and `generate auth` add `provideSignInPath('/sign-in')` to `app.config.ts`, so the Sign in button and the sign-in prompts of the pages open the generated page.

Running `pidrang init` again with the same answers, or `pidrang generate auth` twice, changes nothing.

### Troubleshooting

The app still shows the Angular welcome page: `app.html` still holds it. Init replaces that template with `<router-outlet />` or the navigation layout; if you had already changed the file and it has no outlet, the page renders nothing below your content, so add `<router-outlet />` where the pages should appear.

`ng build` warns that the initial bundle exceeded its budget: the budget `ng new` sets warns above 500 kB, and an app with the Supabase client, Angular Material and the layout starts above it (about 690 kB with the layout) even though the pages load lazily. It is a warning, the build succeeds; raise `maximumWarning` in the `budgets` of `angular.json` if you want it gone.

The Sign in button does nothing and the console shows the router error `NG04002` (`Cannot match any routes. URL Segment: 'sign-in'` in a development build): `provideSignInPath('/sign-in')` is set but no sign-in page is, and the resource routes do not match a name that is not a resource. Run `pidrang generate auth`, add your own sign-in page at `/sign-in`, or change the path in `app.config.ts`.

The URL changes but a page stays blank: `provideRouter` has no `withComponentInputBinding()`. The pages read `:resource` and `:id` from their inputs and render nothing without it. Init adds it to the existing `provideRouter(...)` call; if your app config could not be edited, the `// pidrang:` comment at the top of the file shows the line to write.

`/products` opens the not-found route: `...resourceRoutes` is missing from `routes`, or sits below a `**` route, which matches everything. It belongs at the top of the array, with your fixed paths after it.

The table is empty: the table has no rows, or Row Level Security hides them from the publishable key. Reads are public on the demo schema, but your own project decides that per table; when the `select` policy needs a signed-in user, sign in, and on a new app let init guard the routes as described in [When the tables need a signed-in user](#when-the-tables-need-a-signed-in-user).

Saving says you may need to sign in, or returns a permission error: writes need an authenticated user. Sign in with a Supabase user of the project; the generated pages say "You may need to sign in" as plain text until you call `provideSignInPath`, above.

Requests fail with an invalid API key or do not reach Supabase: `supabaseUrl` and `supabasePublishableKey` in `src/environments/environment.ts` are still the placeholders, point to another project, or hold a key that was rotated. Both values are shown by the Connect button at the top of your project's Supabase dashboard; use the publishable key (formerly anon), never the secret key or the database password.

## Next steps

- [Architecture](./architecture.md): how core, the data providers and the UI layers fit together.
- [`ROADMAP.md`](../ROADMAP.md): what is planned.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md): how to contribute.
