export interface GeneratedFile {
  path: string;
  content: string;
}

const AUTH_REQUIRED_ERROR = `import { PidrangError } from '@pidrang/core';

export function isAuthRequiredError(err: unknown): boolean {
  return err instanceof PidrangError && err.category === 'unauthenticated';
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

const CAN_MATCH_RESOURCE_ACTION = `import { inject } from '@angular/core';
import { CanMatchFn, RedirectCommand, Router } from '@angular/router';
import {
  RESOURCES,
  ResourceAction,
  isResourceActionEnabled,
} from '@pidrang/core';

import { RESOURCE_UNAVAILABLE_PATH } from './resource-unavailable-path';

export function canMatchResourceAction(action: ResourceAction): CanMatchFn {
  return (_route, segments) => {
    const router = inject(Router);
    const resource = inject(RESOURCES, { optional: true })?.find(
      (candidate) => candidate.name === segments[0]?.path,
    );
    if (!resource) {
      return false;
    }
    return (
      isResourceActionEnabled(resource, action) ||
      new RedirectCommand(
        router.createUrlTree(['/', RESOURCE_UNAVAILABLE_PATH]),
        { skipLocationChange: true },
      )
    );
  };
}
`;

const RESOURCE_UNAVAILABLE_PATH_FILE = `export const RESOURCE_UNAVAILABLE_PATH = 'resource-unavailable';
`;

const NOT_FOUND_PAGE = `import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, MatButtonModule],
  template: \`
    <h1>Page not available</h1>
    <p>This resource does not exist, or this action is disabled for it.</p>
    <a mat-button routerLink="/">Back to home</a>
  \`,
})
export class NotFoundPage {}
`;

const RESOURCE_LIST_PAGE = `import {
  Component,
  DOCUMENT,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  PidrangError,
  PidrangErrorCategory,
  injectDataProvider,
  injectResourceList,
  injectResources,
  isResourceActionEnabled,
} from '@pidrang/core';
import { ResourceTable } from '@pidrang/material';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { recordLabel } from '../record-label';

type Row = { id: string } & Record<string, unknown>;

interface DeleteOperation {
  id: string;
}

interface DeleteFailure {
  message: string;
  category: PidrangErrorCategory;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

@Component({
  selector: 'app-resource-list-page',
  imports: [RouterLink, ResourceTable, MatButtonModule, MatPaginatorModule],
  template: \`
    <h1>{{ resource() }}</h1>
    @if (canCreate()) {
      <a
        mat-flat-button
        color="primary"
        [routerLink]="['/', resource(), 'create']"
        >Create</a
      >
    }

    @if (list.isLoading()) {
      <p>Loading...</p>
    }
    @if (deleteFailure(); as failure) {
      <div role="alert">
        <p>{{ failure.message }}</p>
        @if (failure.category === 'unauthenticated') {
          <p>
            You may need to <a routerLink="/login">sign in</a> to delete
            records.
          </p>
        } @else if (failure.category === 'forbidden') {
          <p>You are not allowed to delete this record.</p>
        }
      </div>
    }
    @if (list.error(); as error) {
      <p>{{ error.message }}</p>
    } @else {
      @if (total() === 0) {
        <p>No records yet.</p>
      } @else if (list.hasValue()) {
        <lib-resource-table [fields]="fields()" [data]="list.value().data">
          @if (canShow() || canEdit() || canDelete()) {
            <ng-template #actions let-row>
              @if (canShow()) {
                <a mat-button [routerLink]="['/', resource(), row.id]">Show</a>
              }
              @if (canEdit()) {
                <a mat-button [routerLink]="['/', resource(), row.id, 'edit']"
                  >Edit</a
                >
              }
              @if (canDelete()) {
                <button
                  mat-stroked-button
                  color="warn"
                  type="button"
                  [disabled]="list.isLoading() || deleting() !== null"
                  (click)="remove(row)"
                >
                  {{ deleting()?.id === row.id ? 'Deleting…' : 'Delete' }}
                </button>
              }
            </ng-template>
          }
        </lib-resource-table>
      }
      <mat-paginator
        aria-label="Pagination"
        [length]="total() ?? 0"
        [pageIndex]="page() - 1"
        [pageSize]="pageSize()"
        [pageSizeOptions]="pageSizeOptions"
        [disabled]="list.isLoading() || deleting() !== null"
        (page)="changePage($event)"
      />
    }
  \`,
})
export class ResourceListPage {
  readonly resource = input.required<string>();

  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly deleting = linkedSignal<string, DeleteOperation | null>({
    source: () => this.resource(),
    computation: () => null,
  });
  protected readonly deleteFailure = linkedSignal<string, DeleteFailure | null>(
    {
      source: () => this.resource(),
      computation: () => null,
    },
  );
  protected readonly pageSize = signal(PAGE_SIZE_OPTIONS[0]);
  protected readonly page = linkedSignal({
    source: () => ({ resource: this.resource(), pageSize: this.pageSize() }),
    computation: () => 1,
  });

  private readonly window = inject(DOCUMENT).defaultView;
  private readonly dataProvider = injectDataProvider();
  private readonly resources = injectResources();
  protected readonly list = injectResourceList<Row>(
    () => this.resource(),
    () => ({
      pagination: { current: this.page(), pageSize: this.pageSize() },
      sorters: [{ field: 'id', order: 'asc' }],
    }),
  );
  protected readonly total = linkedSignal<
    { resource: string; total: number | undefined },
    number | undefined
  >({
    source: () => ({
      resource: this.resource(),
      total: this.list.hasValue() ? this.list.value().total : undefined,
    }),
    computation: (source, previous) =>
      source.total ??
      (previous?.source.resource === source.resource
        ? previous.value
        : undefined),
  });
  private readonly definition = computed(() =>
    this.resources.find((resource) => resource.name === this.resource()),
  );
  protected readonly canCreate = computed(() =>
    isResourceActionEnabled(this.definition(), 'create'),
  );
  protected readonly canShow = computed(() =>
    isResourceActionEnabled(this.definition(), 'show'),
  );
  protected readonly canEdit = computed(() =>
    isResourceActionEnabled(this.definition(), 'edit'),
  );
  protected readonly canDelete = computed(() =>
    isResourceActionEnabled(this.definition(), 'delete'),
  );
  protected readonly fields = computed(
    () => this.definition()?.fields?.filter((field) => !field.hidden) ?? [],
  );

  constructor() {
    effect(() => {
      if (!this.list.hasValue()) {
        return;
      }
      const lastPage = Math.max(
        1,
        Math.ceil(this.list.value().total / this.pageSize()),
      );
      if (this.page() > lastPage) {
        this.page.set(lastPage);
      }
    });
  }

  protected changePage(event: PageEvent): void {
    if (event.pageSize !== this.pageSize()) {
      this.pageSize.set(event.pageSize);
      return;
    }
    this.page.set(event.pageIndex + 1);
  }

  protected async remove(row: Row): Promise<void> {
    if (!this.canDelete() || this.deleting() !== null) {
      return;
    }
    const resource = this.resource();
    if (!this.window?.confirm(\`Delete \${recordLabel(row)} from \${resource}?\`)) {
      return;
    }
    const operation: DeleteOperation = { id: row.id };
    this.deleting.set(operation);
    this.deleteFailure.set(null);
    try {
      await this.dataProvider.delete(resource, { id: row.id });
      if (this.resource() === resource) {
        this.list.reload();
      }
    } catch (err) {
      if (this.deleting() === operation) {
        this.deleteFailure.set({
          message: err instanceof Error ? err.message : String(err),
          category: err instanceof PidrangError ? err.category : 'unknown',
        });
      }
    } finally {
      if (this.deleting() === operation) {
        this.deleting.set(null);
      }
    }
  }
}
`;

const RESOURCE_CREATE_PAGE = `import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  Field,
  injectDataProvider,
  injectResources,
  isResourceActionEnabled,
} from '@pidrang/core';
import { ResourceForm } from '@pidrang/material';
import { MatButtonModule } from '@angular/material/button';
import { isAuthRequiredError } from '../auth-required-error';

const NON_EDITABLE_FIELDS = new Set(['id', 'created_at']);

interface SaveFailure {
  message: string;
  authRequired: boolean;
}

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
    @if (canList()) {
      <a mat-button [routerLink]="['/', resource()]">Back to list</a>
    }

    <lib-resource-form
      [fields]="fields()"
      [value]="initialValue()"
      [pending]="saving()"
      (save)="submit($event)"
    />

    @if (saveFailure(); as failure) {
      <p role="alert">{{ failure.message }}</p>
      @if (failure.authRequired) {
        <p>
          You may need to <a routerLink="/login">sign in</a> to make changes.
        </p>
      }
    }
  \`,
})
export class ResourceCreatePage {
  readonly resource = input.required<string>();

  protected readonly saving = signal(false);
  protected readonly saveFailure = linkedSignal<string, SaveFailure | null>({
    source: () => this.resource(),
    computation: () => null,
  });

  private readonly dataProvider = injectDataProvider();
  private readonly router = inject(Router);
  private readonly resources = injectResources();
  private readonly destroyRef = inject(DestroyRef);

  private readonly definition = computed(() =>
    this.resources.find((resource) => resource.name === this.resource()),
  );
  protected readonly canList = computed(() =>
    isResourceActionEnabled(this.definition(), 'list'),
  );
  private readonly canCreate = computed(() =>
    isResourceActionEnabled(this.definition(), 'create'),
  );
  private readonly canShow = computed(() =>
    isResourceActionEnabled(this.definition(), 'show'),
  );

  protected readonly fields = computed(
    () =>
      this.definition()?.fields?.filter(
        (field) => !NON_EDITABLE_FIELDS.has(field.name),
      ) ?? [],
  );

  protected readonly initialValue = computed(() =>
    Object.fromEntries(
      this.fields().map((field) => [field.name, defaultValueForField(field)]),
    ),
  );

  protected async submit(data: Record<string, unknown>): Promise<void> {
    if (!this.canCreate() || this.saving()) {
      return;
    }
    const resource = this.resource();
    this.saving.set(true);
    this.saveFailure.set(null);
    try {
      const created = await this.dataProvider.create<Record<string, unknown>>(
        resource,
        { data },
      );
      if (this.isCurrent(resource)) {
        await this.router.navigate(this.destinationAfterCreate(created['id']));
      }
    } catch (err) {
      if (this.isCurrent(resource)) {
        this.saveFailure.set({
          message: err instanceof Error ? err.message : String(err),
          authRequired: isAuthRequiredError(err),
        });
      }
    } finally {
      this.saving.set(false);
    }
  }

  private destinationAfterCreate(id: unknown): unknown[] {
    if (this.canList()) {
      return ['/', this.resource()];
    }
    if (this.canShow() && (typeof id === 'string' || typeof id === 'number')) {
      return ['/', this.resource(), id];
    }
    return ['/'];
  }

  private isCurrent(resource: string): boolean {
    return !this.destroyRef.destroyed && resource === this.resource();
  }
}
`;

const RESOURCE_SHOW_PAGE = `import { Component, computed, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  injectDataProvider,
  injectResources,
  isResourceActionEnabled,
} from '@pidrang/core';
import { MatButtonModule } from '@angular/material/button';
import { recordLabel } from '../record-label';

@Component({
  selector: 'app-resource-show-page',
  imports: [RouterLink, MatButtonModule],
  template: \`
    <h1>{{ resource() }} — {{ label() }}</h1>
    @if (canList()) {
      <a mat-button [routerLink]="['/', resource()]">Back to list</a>
    }
    @if (record.isLoading()) {
      <p role="status">Loading…</p>
    }
    @if (record.error(); as loadError) {
      <p role="alert">{{ loadError.message }}</p>
      <button mat-stroked-button type="button" (click)="record.reload()">
        Retry
      </button>
    } @else if (record.value(); as record) {
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

  private readonly dataProvider = injectDataProvider();
  private readonly resources = injectResources();

  protected readonly record = resource({
    params: () => ({ resource: this.resource(), id: this.id() }),
    loader: ({ params }) =>
      this.dataProvider.getOne<Record<string, unknown>>(params.resource, {
        id: params.id,
      }),
  });

  private readonly definition = computed(() =>
    this.resources.find((resource) => resource.name === this.resource()),
  );
  protected readonly canList = computed(() =>
    isResourceActionEnabled(this.definition(), 'list'),
  );

  protected readonly fields = computed(() => this.definition()?.fields ?? []);

  protected readonly label = computed(() =>
    this.record.hasValue() ? recordLabel(this.record.value()) : this.id(),
  );
}
`;

const RESOURCE_EDIT_PAGE = `import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  injectDataProvider,
  injectResources,
  isResourceActionEnabled,
} from '@pidrang/core';
import { ResourceForm } from '@pidrang/material';
import { MatButtonModule } from '@angular/material/button';
import { recordLabel } from '../record-label';
import { isAuthRequiredError } from '../auth-required-error';

const NON_EDITABLE_FIELDS = new Set(['id', 'created_at']);

interface SaveFailure {
  message: string;
  authRequired: boolean;
}

@Component({
  selector: 'app-resource-edit-page',
  imports: [RouterLink, ResourceForm, MatButtonModule],
  template: \`
    <h1>Edit {{ resource() }} — {{ label() }}</h1>
    @if (canShow()) {
      <a mat-button [routerLink]="['/', resource(), id()]">Back to show</a>
    } @else if (canList()) {
      <a mat-button [routerLink]="['/', resource()]">Back to list</a>
    }

    @if (record.isLoading()) {
      <p role="status">Loading…</p>
    }
    @if (record.error(); as loadError) {
      <p role="alert">{{ loadError.message }}</p>
      <button mat-stroked-button type="button" (click)="record.reload()">
        Retry
      </button>
    } @else if (value(); as value) {
      <lib-resource-form
        [fields]="fields()"
        [value]="value"
        [pending]="saving()"
        (save)="submit($event)"
      />
      @if (saveFailure(); as failure) {
        <p role="alert">{{ failure.message }}</p>
        @if (failure.authRequired) {
          <p>
            You may need to <a routerLink="/login">sign in</a> to make changes.
          </p>
        }
      }
    }
  \`,
})
export class ResourceEditPage {
  readonly resource = input.required<string>();
  readonly id = input.required<string>();

  protected readonly saving = signal(false);
  protected readonly saveFailure = linkedSignal<
    { resource: string; id: string },
    SaveFailure | null
  >({
    source: () => ({ resource: this.resource(), id: this.id() }),
    computation: () => null,
  });

  private readonly dataProvider = injectDataProvider();
  private readonly router = inject(Router);
  private readonly resources = injectResources();
  private readonly destroyRef = inject(DestroyRef);

  protected readonly record = resource({
    params: () => ({ resource: this.resource(), id: this.id() }),
    loader: ({ params }) =>
      this.dataProvider.getOne<Record<string, unknown>>(params.resource, {
        id: params.id,
      }),
  });

  private readonly definition = computed(() =>
    this.resources.find((resource) => resource.name === this.resource()),
  );
  protected readonly canShow = computed(() =>
    isResourceActionEnabled(this.definition(), 'show'),
  );
  protected readonly canList = computed(() =>
    isResourceActionEnabled(this.definition(), 'list'),
  );
  private readonly canEdit = computed(() =>
    isResourceActionEnabled(this.definition(), 'edit'),
  );

  protected readonly fields = computed(
    () =>
      this.definition()?.fields?.filter(
        (field) => !NON_EDITABLE_FIELDS.has(field.name) && !field.hidden,
      ) ?? [],
  );

  protected readonly value = computed(() => {
    if (!this.record.hasValue()) {
      return undefined;
    }
    const record = this.record.value();
    return Object.fromEntries(
      this.fields().map((field) => [field.name, record[field.name]]),
    );
  });

  protected readonly label = computed(() =>
    this.record.hasValue() ? recordLabel(this.record.value()) : this.id(),
  );

  protected async submit(data: Record<string, unknown>): Promise<void> {
    if (!this.canEdit() || this.saving()) {
      return;
    }
    const resource = this.resource();
    const id = this.id();
    this.saving.set(true);
    this.saveFailure.set(null);
    try {
      await this.dataProvider.update(resource, { id, data });
      if (this.isCurrent(resource, id)) {
        await this.router.navigate(this.destinationAfterSave());
      }
    } catch (err) {
      if (this.isCurrent(resource, id)) {
        this.saveFailure.set({
          message: err instanceof Error ? err.message : String(err),
          authRequired: isAuthRequiredError(err),
        });
      }
    } finally {
      this.saving.set(false);
    }
  }

  private destinationAfterSave(): unknown[] {
    if (this.canShow()) {
      return ['/', this.resource(), this.id()];
    }
    if (this.canList()) {
      return ['/', this.resource()];
    }
    return ['/'];
  }

  private isCurrent(resource: string, id: string): boolean {
    return (
      !this.destroyRef.destroyed &&
      resource === this.resource() &&
      id === this.id()
    );
  }
}
`;

export const RESOURCE_ROUTES_SNIPPET = `import { Route } from '@angular/router';

import { canMatchResourceAction } from './can-match-resource-action';
import { RESOURCE_UNAVAILABLE_PATH } from './resource-unavailable-path';
import { NotFoundPage } from './pages/not-found-page';
import { ResourceCreatePage } from './pages/resource-create-page';
import { ResourceEditPage } from './pages/resource-edit-page';
import { ResourceListPage } from './pages/resource-list-page';
import { ResourceShowPage } from './pages/resource-show-page';

export const resourceRoutes: Route[] = [
  { path: RESOURCE_UNAVAILABLE_PATH, component: NotFoundPage },
  {
    path: ':resource/create',
    component: ResourceCreatePage,
    canMatch: [canMatchResourceAction('create')],
  },
  {
    path: ':resource/:id/edit',
    component: ResourceEditPage,
    canMatch: [canMatchResourceAction('edit')],
  },
  {
    path: ':resource/:id',
    component: ResourceShowPage,
    canMatch: [canMatchResourceAction('show')],
  },
  {
    path: ':resource',
    component: ResourceListPage,
    canMatch: [canMatchResourceAction('list')],
  },
];
`;

export function generatePagesBundle(): GeneratedFile[] {
  return [
    { path: 'src/app/auth-required-error.ts', content: AUTH_REQUIRED_ERROR },
    { path: 'src/app/record-label.ts', content: RECORD_LABEL },
    {
      path: 'src/app/can-match-resource-action.ts',
      content: CAN_MATCH_RESOURCE_ACTION,
    },
    {
      path: 'src/app/resource-unavailable-path.ts',
      content: RESOURCE_UNAVAILABLE_PATH_FILE,
    },
    { path: 'src/app/pages/not-found-page.ts', content: NOT_FOUND_PAGE },
    {
      path: 'src/app/pages/resource-list-page.ts',
      content: RESOURCE_LIST_PAGE,
    },
    {
      path: 'src/app/pages/resource-create-page.ts',
      content: RESOURCE_CREATE_PAGE,
    },
    {
      path: 'src/app/pages/resource-show-page.ts',
      content: RESOURCE_SHOW_PAGE,
    },
    {
      path: 'src/app/pages/resource-edit-page.ts',
      content: RESOURCE_EDIT_PAGE,
    },
  ];
}
