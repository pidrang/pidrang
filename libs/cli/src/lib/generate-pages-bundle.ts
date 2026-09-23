export interface GeneratedFile {
  path: string;
  content: string;
}

const AUTH_REQUIRED_ERROR = `const AUTH_REQUIRED_ERROR_PATTERNS = [
  'row-level security',
  'permission denied for table',
];

export function isAuthRequiredError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return AUTH_REQUIRED_ERROR_PATTERNS.some((pattern) =>
    message.toLowerCase().includes(pattern),
  );
}
`;

const RECORD_LABEL = `export function recordLabel(record: Record<string, unknown>): string {
  if (typeof record['name'] === 'string' && record['name']) {
    return record['name'];
  }
  if (typeof record['email'] === 'string' && record['email']) {
    return record['email'];
  }
  const id = record['id'];
  return typeof id === 'string' ? id.slice(0, 8) : String(id);
}
`;

const RESOURCE_LIST_PAGE = `import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  injectDataProvider,
  injectResourceList,
  injectResources,
} from '@pidrang/core';
import { ResourceTable } from '@pidrang/material';
import { MatButtonModule } from '@angular/material/button';

type Row = { id: string } & Record<string, unknown>;

@Component({
  selector: 'app-resource-list-page',
  imports: [RouterLink, ResourceTable, MatButtonModule],
  template: \`
    <h1>{{ resource() }}</h1>
    <a
      mat-flat-button
      color="primary"
      [routerLink]="['/', resource(), 'create']"
      >Create</a
    >

    @if (list.isLoading()) {
      <p>Loading...</p>
    }
    @if (list.error(); as error) {
      <p>{{ error.message }}</p>
    }

    <lib-resource-table [fields]="fields()" [data]="list.value()?.data ?? []">
      <ng-template #actions let-row>
        <a mat-button [routerLink]="['/', resource(), row.id]">Show</a>
        <a mat-button [routerLink]="['/', resource(), row.id, 'edit']">Edit</a>
        <button
          mat-stroked-button
          color="warn"
          type="button"
          (click)="remove(row.id)"
        >
          Delete
        </button>
      </ng-template>
    </lib-resource-table>
  \`,
})
export class ResourceListPage {
  readonly resource = input.required<string>();

  private readonly dataProvider = injectDataProvider();
  private readonly resources = injectResources();
  protected readonly list = injectResourceList<Row>(() => this.resource());
  protected readonly fields = computed(
    () =>
      this.resources
        .find((resource) => resource.name === this.resource())
        ?.fields?.filter((field) => !field.hidden) ?? [],
  );

  protected async remove(id: string): Promise<void> {
    await this.dataProvider.delete(this.resource(), { id });
    this.list.reload();
  }
}
`;

const RESOURCE_CREATE_PAGE = `import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Field, injectDataProvider, injectResources } from '@pidrang/core';
import { ResourceForm } from '@pidrang/material';
import { MatButtonModule } from '@angular/material/button';
import { isAuthRequiredError } from '../auth-required-error';

const NON_EDITABLE_FIELDS = new Set(['id', 'created_at']);

function defaultValueForField(field: Field): unknown {
  switch (field.type) {
    case 'number':
      return 0;
    case 'boolean':
      return false;
    default:
      return '';
  }
}

@Component({
  selector: 'app-resource-create-page',
  imports: [RouterLink, ResourceForm, MatButtonModule],
  template: \`
    <h1>Create {{ resource() }}</h1>
    <a mat-button [routerLink]="['/', resource()]">Back to list</a>

    <lib-resource-form
      [fields]="fields()"
      [value]="initialValue()"
      (save)="submit($event)"
    />

    @if (error()) {
      <p>{{ error() }}</p>
      @if (authRequired()) {
        <p>
          You may need to <a routerLink="/login">sign in</a> to make changes.
        </p>
      }
    }
  \`,
})
export class ResourceCreatePage {
  readonly resource = input.required<string>();

  protected readonly error = signal<string | null>(null);
  protected readonly authRequired = signal(false);

  private readonly dataProvider = injectDataProvider();
  private readonly router = inject(Router);
  private readonly resources = injectResources();

  protected readonly fields = computed(
    () =>
      this.resources
        .find((resource) => resource.name === this.resource())
        ?.fields?.filter((field) => !NON_EDITABLE_FIELDS.has(field.name)) ?? [],
  );

  protected readonly initialValue = computed(() =>
    Object.fromEntries(
      this.fields().map((field) => [field.name, defaultValueForField(field)]),
    ),
  );

  protected async submit(data: Record<string, unknown>): Promise<void> {
    try {
      await this.dataProvider.create(this.resource(), { data });
      await this.router.navigate(['/', this.resource()]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      this.authRequired.set(isAuthRequiredError(err));
    }
  }
}
`;

const RESOURCE_SHOW_PAGE = `import { Component, computed, effect, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectDataProvider, injectResources } from '@pidrang/core';
import { MatButtonModule } from '@angular/material/button';
import { recordLabel } from '../record-label';

@Component({
  selector: 'app-resource-show-page',
  imports: [RouterLink, MatButtonModule],
  template: \`
    <h1>{{ resource() }} — {{ label() }}</h1>
    <a mat-button [routerLink]="['/', resource()]">Back to list</a>
    @if (error()) {
      <p>{{ error() }}</p>
    } @else if (record(); as record) {
      <dl>
        @for (field of fields(); track field.name) {
          <dt>{{ field.label ?? field.name }}</dt>
          <dd>{{ record[field.name] }}</dd>
        }
      </dl>
    }
  \`,
})
export class ResourceShowPage {
  readonly resource = input.required<string>();
  readonly id = input.required<string>();

  protected readonly record = signal<Record<string, unknown> | undefined>(
    undefined,
  );
  protected readonly error = signal<string | null>(null);

  private readonly dataProvider = injectDataProvider();
  private readonly resources = injectResources();

  protected readonly fields = computed(
    () =>
      this.resources.find((resource) => resource.name === this.resource())
        ?.fields ?? [],
  );

  protected readonly label = computed(() => {
    const record = this.record();
    return record ? recordLabel(record) : this.id();
  });

  constructor() {
    // Re-runs whenever resource() or id() changes, so navigating between
    // records on the same component instance still refetches.
    effect(() => {
      const resource = this.resource();
      const id = this.id();
      this.dataProvider.getOne<Record<string, unknown>>(resource, { id }).then(
        (record) => this.record.set(record),
        (err) =>
          this.error.set(err instanceof Error ? err.message : String(err)),
      );
    });
  }
}
`;

const RESOURCE_EDIT_PAGE = `import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { injectDataProvider, injectResources } from '@pidrang/core';
import { ResourceForm } from '@pidrang/material';
import { MatButtonModule } from '@angular/material/button';
import { recordLabel } from '../record-label';
import { isAuthRequiredError } from '../auth-required-error';

const NON_EDITABLE_FIELDS = new Set(['id', 'created_at']);

@Component({
  selector: 'app-resource-edit-page',
  imports: [RouterLink, ResourceForm, MatButtonModule],
  template: \`
    <h1>Edit {{ resource() }} — {{ label() }}</h1>
    <a mat-button [routerLink]="['/', resource(), id()]">Back to show</a>

    @if (error()) {
      <p>{{ error() }}</p>
      @if (authRequired()) {
        <p>
          You may need to <a routerLink="/login">sign in</a> to make changes.
        </p>
      }
    } @else if (value(); as value) {
      <lib-resource-form
        [fields]="fields()"
        [value]="value"
        (save)="submit($event)"
      />
    }
  \`,
})
export class ResourceEditPage {
  readonly resource = input.required<string>();
  readonly id = input.required<string>();

  protected readonly record = signal<Record<string, unknown> | undefined>(
    undefined,
  );
  protected readonly error = signal<string | null>(null);
  protected readonly authRequired = signal(false);

  private readonly dataProvider = injectDataProvider();
  private readonly router = inject(Router);
  private readonly resources = injectResources();

  protected readonly fields = computed(
    () =>
      this.resources
        .find((resource) => resource.name === this.resource())
        ?.fields?.filter(
          (field) => !NON_EDITABLE_FIELDS.has(field.name) && !field.hidden,
        ) ?? [],
  );

  protected readonly value = computed(() => {
    const record = this.record();
    if (!record) {
      return undefined;
    }
    return Object.fromEntries(
      this.fields().map((field) => [field.name, record[field.name]]),
    );
  });

  protected readonly label = computed(() => {
    const record = this.record();
    return record ? recordLabel(record) : this.id();
  });

  constructor() {
    // Re-runs whenever resource() or id() changes, so navigating between
    // records on the same component instance still reloads the record.
    effect(() => {
      const resource = this.resource();
      const id = this.id();
      this.record.set(undefined);
      this.dataProvider.getOne<Record<string, unknown>>(resource, { id }).then(
        (record) => this.record.set(record),
        (err) =>
          this.error.set(err instanceof Error ? err.message : String(err)),
      );
    });
  }

  protected async submit(data: Record<string, unknown>): Promise<void> {
    try {
      await this.dataProvider.update(this.resource(), { id: this.id(), data });
      await this.router.navigate(['/', this.resource(), this.id()]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      this.authRequired.set(isAuthRequiredError(err));
    }
  }
}
`;

export const RESOURCE_ROUTES_SNIPPET = `import { Route } from '@angular/router';

import { ResourceCreatePage } from './pages/resource-create-page';
import { ResourceEditPage } from './pages/resource-edit-page';
import { ResourceListPage } from './pages/resource-list-page';
import { ResourceShowPage } from './pages/resource-show-page';

// Order matters: more specific segments (create, :id/edit) must be matched
// before the generic :id and :resource routes.
export const resourceRoutes: Route[] = [
  { path: ':resource/create', component: ResourceCreatePage },
  { path: ':resource/:id/edit', component: ResourceEditPage },
  { path: ':resource/:id', component: ResourceShowPage },
  { path: ':resource', component: ResourceListPage },
];
`;

export function generatePagesBundle(): GeneratedFile[] {
  return [
    { path: 'src/app/auth-required-error.ts', content: AUTH_REQUIRED_ERROR },
    { path: 'src/app/record-label.ts', content: RECORD_LABEL },
    { path: 'src/app/pages/resource-list-page.ts', content: RESOURCE_LIST_PAGE },
    {
      path: 'src/app/pages/resource-create-page.ts',
      content: RESOURCE_CREATE_PAGE,
    },
    { path: 'src/app/pages/resource-show-page.ts', content: RESOURCE_SHOW_PAGE },
    { path: 'src/app/pages/resource-edit-page.ts', content: RESOURCE_EDIT_PAGE },
  ];
}
