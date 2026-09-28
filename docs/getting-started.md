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
      { name: 'id', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'price', type: 'number' },
      { name: 'in_stock', label: 'In stock', type: 'boolean' },
      { name: 'created_at', label: 'Created at', type: 'date' },
    ],
  },
];
```

`name` must match the Supabase table name. Field types are `'text'`, `'number'`, `'boolean'` and `'date'`. `label` overrides the column header and form label; `hidden: true` marks a field a generic list or edit page should skip.

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

    <lib-resource-table [fields]="fields()" [data]="list.value()?.data ?? []" />
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

To page, sort or filter, pass a params function as the second argument. Returning `undefined` from it skips loading. Without pagination, `getList` returns the first 10 rows. `current` and `pageSize` must be positive integers; anything else is rejected before a request is sent. `ListResult.total` holds the full row count, so you can build a pager.

```ts
injectResourceList<Row>(
  () => this.resource(),
  () => ({
    pagination: { current: this.page(), pageSize: 20 },
    sorters: [{ field: 'created_at', order: 'desc' }],
    filters: { in_stock: true },
  }),
);
```

## 5. Per-row actions

`ResourceTable` projects an `#actions` template as a trailing column. The row is available as the implicit context variable.

```html
<lib-resource-table [fields]="fields()" [data]="list.value()?.data ?? []">
  <ng-template #actions let-row>
    <a [routerLink]="['/', resource(), row.id, 'edit']">Edit</a>
    <button type="button" (click)="remove(row.id)">Delete</button>
  </ng-template>
</lib-resource-table>

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

`DataProvider` exposes `getList`, `getOne`, `create`, `update` and `delete`. Each takes the resource name and a params object (`{ id }`, `{ data }` or `{ id, data }`).

## 6. Create and edit forms

`ResourceForm` renders one input per field, built on Angular Signal Forms. It never mutates the `value` you pass in; it emits the edited copy through `save`.

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
    <lib-resource-form [fields]="fields()" [value]="initialValue()" (save)="submit($event)" />
  `,
})
export class ResourceCreatePage {
  readonly resource = input.required<string>();

  private readonly dataProvider = injectDataProvider();
  private readonly router = inject(Router);
  private readonly resources = injectResources();

  protected readonly fields = computed(() => this.resources.find((resource) => resource.name === this.resource())?.fields?.filter((field) => field.name !== 'id' && field.name !== 'created_at') ?? []);

  protected readonly initialValue = computed(() => Object.fromEntries(this.fields().map((field) => [field.name, field.type === 'number' ? 0 : field.type === 'boolean' ? false : ''])));

  protected async submit(data: Record<string, unknown>): Promise<void> {
    await this.dataProvider.create(this.resource(), { data });
    await this.router.navigate(['/', this.resource()]);
  }
}
```

An edit page is the same component fed with `dataProvider.getOne(resource, { id })` as the initial value and `dataProvider.update(resource, { id, data })` on save. The complete List, Create, Show and Edit pages live in [`apps/demo-material`](../apps/demo-material/src/app/pages).

## 7. Sign in

If your Row Level Security policies require the `authenticated` role for writes (recommended), give users a way to sign in.

```ts
import { injectAuthProvider } from '@pidrang/core';

const authProvider = injectAuthProvider();
await authProvider.login({ email, password });
```

`injectAuthSession()` returns a signal-based `resource()` of the current identity: `undefined` while loading, `null` when signed out, an `AuthIdentity` when signed in.

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

Both expose the same `ResourceTable` and `ResourceForm` API, so switching is a change of import. For Tailwind, add a `@source` line pointing at the installed package in your global stylesheet:

```css
@import 'tailwindcss';
@source '../node_modules/@pidrang/tailwind';
```

Adjust the relative path to where your stylesheet sits. See [`apps/demo-tailwind`](../apps/demo-tailwind) for a working setup.

## Generating resources

`pidrang init` connects to a Supabase project, lets you pick tables and CRUD actions, and writes a typed `src/app/resources.ts` plus generic List, Create, Show and Edit pages for `@pidrang/material`. It never overwrites an existing file and never edits `app.routes.ts` or `app.config.ts`; it prints the routes and the `providePidrang` call for you to paste in.

The CLI is not published to npm yet, so it can only be run from a clone of this repository for now.

## Next steps

- [Architecture](./architecture.md): how core, the data providers and the UI layers fit together.
- [`ROADMAP.md`](../ROADMAP.md): what is planned.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md): how to contribute.
