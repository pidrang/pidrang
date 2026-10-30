# Write the pages yourself

This guide builds by hand what `pidrang init` generates: a list page with per-row actions, create and edit forms, a sign-in page, and the routes between them, all driven by one `Resource` definition. Follow it when you cannot run `init`, or to see how the pieces fit. To generate the pages instead, see [Getting started](./getting-started.md).

The prerequisites are those of [Getting started](./getting-started.md#prerequisites). The code below uses Angular Material; with Tailwind, import the same components from `@pidrang/tailwind` and use the `pidrang-tailwind-` selectors.

## 1. Install

```bash
npm install @pidrang/core @pidrang/supabase @pidrang/material @supabase/supabase-js
ng add @angular/material
```

`@pidrang/material` is one of two UI layers. Hand-written pages can use `@pidrang/tailwind` instead and skip `@angular/material`; see [UI layers](./ui-layers/index.md).

## 2. Describe your resources

A `Resource` names a table and lists its typed fields. UI layers render tables and forms from `fields`, so you never hand-write a column or an input. Put it in `src/app/resources.ts`:

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

## 3. Register Pidrang

Create a Supabase client once and hand it to both providers. `providePidrang` is the only place that touches Angular DI.

```ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { providePidrang } from '@pidrang/core';
import { provideSupabaseAuthProvider, provideSupabaseDataProvider } from '@pidrang/supabase';
import { createClient } from '@supabase/supabase-js';

import { appRoutes } from './app.routes';
import { resources } from './resources';

const client = createClient('https://YOUR-PROJECT.supabase.co', 'YOUR-PUBLISHABLE-KEY');

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutes, withComponentInputBinding()),
    providePidrang({
      dataProvider: provideSupabaseDataProvider({ client }),
      authProvider: provideSupabaseAuthProvider({ client }),
      resources,
    }),
  ],
};
```

`withComponentInputBinding()` is what carries the `:resource` and `:id` segments to the pages' inputs; without it the pages render blank. `authProvider` is optional. Without it, `injectAuthProvider()` throws a descriptive error if something asks for it. Use the publishable key (formerly anon), never the secret key or the database password: the app runs in the browser.

## 4. Build a list page

`injectResourceList` wraps `DataProvider.getList` in Angular's native `resource()`, so `value()`, `isLoading()`, `error()` and `reload()` are all signals. Passing a function as the resource name lets one component serve every resource from a route parameter.

```ts
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectResourceList, injectResources } from '@pidrang/core';
import { ResourceTable } from '@pidrang/material';

type Row = { id: string } & Record<string, unknown>;

@Component({
  selector: 'app-resource-list-page',
  imports: [ResourceTable, RouterLink],
  template: `
    <h1>{{ resource() }}</h1>
    <a [routerLink]="['/', resource(), 'create']">New</a>

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

The table renders one column per entry of `fields`, so the page leaves out the `hidden` ones itself. The `New` link opens the create page of step 6; step 8 routes both.

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

`ResourceTable` projects an `#actions` template as a trailing column with an `Actions` header. The row is available as the implicit context variable. A data field may itself be named `actions`: it gets its own column next to the projected one. In the template of the list page, replace the table with:

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

Deleting is irreversible, so ask for confirmation and surface a failure (for example a Row Level Security rejection) instead of letting the promise reject silently. Add these members to `ResourceListPage`, with `injectDataProvider` from `@pidrang/core` and `signal` from `@angular/core` added to its imports:

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

The pages `pidrang init` generates, and the list pages of `apps/demo-material` and `apps/demo-tailwind`, go further: they block repeated clicks while a delete is in flight, keep deletes of that resource blocked across visits until it settles and, when you come back before it settles, say how it ended, keep the row on failure, and use the `PidrangError` `category` to ask the user to sign in on `unauthenticated` or say the user is not allowed on `forbidden`.

`DataProvider` exposes `getList`, `getOne`, `create`, `update` and `delete`. Each takes the resource name and a params object (`{ id }`, `{ data }` or `{ id, data }`).

## 6. Create and edit forms

`ResourceForm` renders one input per field, built on Angular Signal Forms. It never mutates the `value` you pass in; it emits a payload through `save`, which only ever contains a field you actually changed — on create as much as on edit — so the server's own default or `NULL` applies to anything left alone, and a precise `numeric` or a zoned `timestamp` round-trips unchanged instead of being re-serialized. The required `[mode]` input is `'create'` or `'edit'`: on edit, `save` does not emit at all when nothing was changed, since there would be nothing to `PATCH`; on create it still emits (possibly an empty object), since creating a row from nothing but defaults is a normal thing to do.

The create page:

```ts
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { injectDataProvider, injectResources } from '@pidrang/core';
import { ResourceForm } from '@pidrang/material';

@Component({
  selector: 'app-resource-create-page',
  imports: [ResourceForm],
  template: `
    <h1>Create {{ resource() }}</h1>
    <pidrang-material-resource-form mode="create" [fields]="fields()" [value]="initialValue()" [pending]="pending()" (save)="submit($event)" />

    @if (saveError(); as message) {
      <p role="alert">{{ message }}</p>
    }
  `,
})
export class ResourceCreatePage {
  readonly resource = input.required<string>();

  private readonly dataProvider = injectDataProvider();
  private readonly router = inject(Router);
  private readonly resources = injectResources();

  protected readonly fields = computed(() => this.resources.find((resource) => resource.name === this.resource())?.fields?.filter((field) => !field.readOnly) ?? []);

  protected readonly initialValue = computed(() => Object.fromEntries(this.fields().map((field) => [field.name, field.type === 'number' ? 0 : field.type === 'boolean' ? false : ''])));

  protected readonly pending = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected async submit(data: Record<string, unknown>): Promise<void> {
    this.pending.set(true);
    this.saveError.set(null);
    try {
      await this.dataProvider.create(this.resource(), { data });
      await this.router.navigate(['/', this.resource()]);
    } catch (error) {
      this.saveError.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.pending.set(false);
    }
  }
}
```

`readOnly: true` (on `id`, or on any column the database generates or defaults, like `created_at` above) keeps that field out of the form entirely, on both create and edit. While `pending` is `true` the form disables its submit button and ignores further submits, so a double click cannot create two rows. A refused write, for example by a Row Level Security policy, shows its message under the form instead of failing silently.

The edit page loads the record with `getOne` in Angular's `resource()` and saves with `update`:

```ts
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router } from '@angular/router';
import { injectDataProvider, injectResources } from '@pidrang/core';
import { ResourceForm } from '@pidrang/material';

type Row = Record<string, unknown>;

@Component({
  selector: 'app-resource-edit-page',
  imports: [ResourceForm],
  template: `
    <h1>Edit {{ resource() }}</h1>

    @if (record.error(); as error) {
      <p role="alert">{{ error.message }}</p>
    } @else if (record.value(); as value) {
      <pidrang-material-resource-form mode="edit" [fields]="fields()" [value]="value" [pending]="pending()" (save)="submit($event)" />
    } @else {
      <p>Loading...</p>
    }

    @if (saveError(); as message) {
      <p role="alert">{{ message }}</p>
    }
  `,
})
export class ResourceEditPage {
  readonly resource = input.required<string>();
  readonly id = input.required<string>();

  private readonly dataProvider = injectDataProvider();
  private readonly router = inject(Router);
  private readonly resources = injectResources();

  protected readonly fields = computed(() => this.resources.find((resource) => resource.name === this.resource())?.fields?.filter((field) => !field.readOnly) ?? []);

  protected readonly record = resource({
    params: () => ({ resource: this.resource(), id: this.id() }),
    loader: ({ params }) => this.dataProvider.getOne<Row>(params.resource, { id: params.id }),
  });

  protected readonly pending = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected async submit(data: Partial<Row>): Promise<void> {
    this.pending.set(true);
    this.saveError.set(null);
    try {
      await this.dataProvider.update(this.resource(), { id: this.id(), data });
      await this.router.navigate(['/', this.resource()]);
    } catch (error) {
      this.saveError.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.pending.set(false);
    }
  }
}
```

The complete List, Create, Show and Edit pages live in [`apps/demo-material`](../apps/demo-material/src/app/pages). They go further: the flag is held per record (per resource for a create) across visits, a page that comes back while a save runs waits for it and then says whether it finished or failed, a request with no answer after 30 seconds shows a message above a disabled form, on every page of that record, until the server answers and the page says how that save ended, and a save whose next page does not open says it was saved. See [the save lock](./design-notes.md#the-save-lock-keeps-only-running-saves-with-a-30-second-timeout) for how it works and its limits.

## 7. Sign in

When your Row Level Security policies only let a signed-in user write, the app needs a sign-in page. It calls `authProvider.login({ email, password })`; `authProvider.logout()` signs out.

```ts
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { injectAuthProvider } from '@pidrang/core';

@Component({
  selector: 'app-sign-in-page',
  template: `
    <h1>Sign in</h1>
    <form (submit)="submit($event, email.value, password.value)">
      <label>Email <input #email type="email" autocomplete="username" required /></label>
      <label>Password <input #password type="password" autocomplete="current-password" required /></label>
      <button type="submit" [disabled]="pending()">Sign in</button>
    </form>

    @if (error(); as message) {
      <p role="alert">{{ message }}</p>
    }
  `,
})
export class SignInPage {
  private readonly authProvider = injectAuthProvider();
  private readonly router = inject(Router);

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(event: Event, email: string, password: string): Promise<void> {
    event.preventDefault();
    this.pending.set(true);
    this.error.set(null);
    try {
      await this.authProvider.login({ email, password });
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.pending.set(false);
    }
  }
}
```

See [Authentication and permissions](./authentication.md) for reading the session, reacting to a refused write and the Row Level Security policies that decide what a signed-in user may do.

## 8. Route the pages

In `src/app/app.routes.ts`:

```ts
import { Route } from '@angular/router';
import { ResourceCreatePage } from './resource-create-page';
import { ResourceEditPage } from './resource-edit-page';
import { ResourceListPage } from './resource-list-page';
import { SignInPage } from './sign-in-page';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: '/products' },
  { path: 'sign-in', component: SignInPage },
  { path: ':resource', component: ResourceListPage },
  { path: ':resource/create', component: ResourceCreatePage },
  { path: ':resource/:id/edit', component: ResourceEditPage },
];
```

`sign-in` comes before `:resource`, which would otherwise take it as a resource name. Run `ng serve` and open the app: `/` redirects to `/products`, `New` opens the create form, `Edit` and `Delete` act on a row, and `/sign-in` signs you in.

The pages `init` generates add a Show page, route guards for the actions a `Resource` disables and for tables only a signed-in user may read, and, on a new app, a layout with a menu of the resources; see [What it writes](./reference/cli.md#what-it-writes).
