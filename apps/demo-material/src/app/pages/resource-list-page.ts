import {
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
  template: `
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
        [disabled]="list.isLoading()"
        (page)="changePage($event)"
      />
    }
  `,
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
    if (!this.window?.confirm(`Delete ${recordLabel(row)} from ${resource}?`)) {
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
      if (this.resource() === resource) {
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
