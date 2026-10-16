# Getting started

This guide takes a new Angular app to a working admin panel backed by Supabase: a list page, a create form and per-row actions, all driven by one `Resource` definition.

## Prerequisites

- An Angular 22 application using standalone APIs and the router (`ng new my-admin`).
- A Supabase project with at least one table that has an `id` primary key column. Pidrang assumes `id` on every table; composite or differently named keys are not supported.
- The project URL and the anon (publishable) key, found in the Supabase dashboard under Project Settings, API.

## 1. Install

```bash
npm install @pidrang/core @pidrang/supabase @pidrang/material @supabase/supabase-js
ng add @angular/material
```

`@pidrang/material` is one of two UI layers. To use Tailwind instead, install `@pidrang/tailwind` and skip `@angular/material`; see [Choosing a UI layer](#choosing-a-ui-layer).

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

`name` must match the Supabase table name. Field types are `'text'`, `'number'`, `'boolean'`, `'date'`, `'timestamp'`, `'time'` and `'numeric'`. `date`, `timestamp`, `time` and `numeric` are kept as plain strings end to end, never converted through `Date` or `Number`, so a calendar date, a zoned time or a `bigint`/high-precision `numeric` value round-trips without losing anything. `label` overrides the column header and form label; `hidden: true` marks a field a generic list or edit page should skip. `readOnly: true` keeps a field out of create/edit forms entirely — use it for a primary key or any column the database generates. An untouched field is left out of what gets saved — on create and on edit alike — so the server's own default or `NULL` applies instead of a client-side placeholder. The one exception is a `boolean` or `number` without `hasDefault` on create: an unchecked box is a real `false` and a `0` in a number input is a real `0`, so the value shown is sent. `hasDefault: true` also shows a hint ("Leave unchanged to use the database default.") on create so the user knows a blank field isn't actually going to be sent blank, and exempts the field from the "required" check below while it's still untouched. `nullable: true` lets a `timestamp`/`time`/`numeric`/`date` field be cleared (sent as `null`) rather than blocked as invalid when empty — without it, a non-nullable one of those four types blocks submit with an inline hint if left empty (once touched, or once a submit is attempted). `list`, `create`, `show`, `edit` and `delete` are optional flags, enabled when omitted; set one to `false` to hide that action and refuse its route in the generic pages.

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

const client = createClient('https://YOUR-PROJECT.supabase.co', 'YOUR-ANON-KEY');

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

Run `pidrang init` from the root of an Angular 22.1 (or later 22.x) standalone app, laid out as `ng new` creates it with routing. It connects to a Supabase project, lets you pick tables and CRUD actions, and writes a typed `resources.ts` plus generic List, Create, Show and Edit pages for `@pidrang/material` into the app folder of the application in `angular.json` (`src/app` for a new app; pass `--project <name>` when the workspace has several). It never edits `app.routes.ts` or `app.config.ts`; it prints the routes, and the `provideRouter(routes, withComponentInputBinding())` and `providePidrang` calls for you to paste in. `withComponentInputBinding()` is required: the pages receive the resource name and the record id as inputs, and stay blank without it.

It checks everything before writing anything. A folder it does not recognize, a table named like one of your routes, or an invalid answer stops it with nothing written. It never overwrites a file: when one it would write already exists with other content, it lists every such file and writes nothing at all. A file that already matches is left as it is, so running it again with the same answers is harmless. `pidrang --help` lists the options.

To run it without questions, for example in CI, put the answers in a plan file and pass the credentials as environment variables (`PIDRANG_SUPABASE_ANON_KEY`, `PIDRANG_SUPABASE_SERVICE_ROLE_KEY` or `PIDRANG_DATABASE_PASSWORD`, depending on the strategy); a credential written in the file is refused:

```json
{
  "provider": "supabase",
  "connection": { "strategy": "graphql", "url": "https://abcdefgh.supabase.co" },
  "tables": [{ "table": "products", "actions": ["list", "create", "show", "edit", "delete"], "hiddenFields": ["created_at"] }]
}
```

```sh
PIDRANG_SUPABASE_ANON_KEY=<your anon key> npx pidrang init --plan plan.json
```

The same answers give the same files as the questions. It exits with `0` when done or when there is nothing to write, `1` on an invalid plan, an unsupported app or a file in the way, and `130` when cancelled.

When a write fails because the user is not signed in, the generated pages say "You may need to sign in" as plain text, since they cannot know where your sign-in page lives. To make it a link, provide the path once in `app.config.ts` (the CLI prints this snippet too), replacing `/your-sign-in-route` with your sign-in page's path. It must be a route of your Angular app: the link navigates inside the app, so a sign-in handled by the server or another site (an OAuth redirect, `https://…`) cannot be linked and the prompt stays plain text. `provideSignInPath` throws while the app config is built when the path is not a string, is empty, has spaces at either end, uses `.` or `..` segments, is a full URL or is malformed (`/%`), so those stop the app at startup. So is the `/your-sign-in-route` placeholder left as printed. A well-formed path to a route that does not exist cannot be caught there and lands on your not-found route, A path whose first segment is one of your resource names (`/users/sign-in` with a `users` resource) works only if your sign-in route is declared above `resourceRoutes`; below them, the link opens the Show page of a record whose id is `sign-in`. It is resolved from the app root and may carry a query string:

```ts
import { provideSignInPath } from './pidrang/provide-sign-in-path';

provideSignInPath('/your-sign-in-route');
```

Pages generated by an older `pidrang init` keep their hard-coded `/login` link and ignore this provider. Running the current CLI over them stops with those files listed; delete `src/app/pages` and `src/app/pidrang` together (the current pages need the current helpers) and run it again.

The CLI is not published to npm yet, so it can only be run from a clone of this repository for now.

## Next steps

- [Architecture](./architecture.md): how core, the data providers and the UI layers fit together.
- [`ROADMAP.md`](../ROADMAP.md): what is planned.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md): how to contribute.
