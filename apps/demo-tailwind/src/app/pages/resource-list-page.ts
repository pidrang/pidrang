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
import { ResourceTable } from '@pidrang/tailwind';

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
  imports: [RouterLink, ResourceTable],
  template: `
    <h1 class="text-2xl font-semibold text-gray-900">{{ resource() }}</h1>
    @if (canCreate()) {
      <a
        [routerLink]="['/', resource(), 'create']"
        class="mt-2 inline-block rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >Create</a
      >
    }

    @if (list.isLoading()) {
      <p class="mt-4 text-gray-500">Loading...</p>
    }
    @if (deleteFailure(); as failure) {
      <div role="alert" class="mt-4 text-red-600">
        <p>{{ failure.message }}</p>
        @if (failure.category === 'unauthenticated') {
          <p>
            You may need to
            <a routerLink="/login" class="underline">sign in</a> to delete
            records.
          </p>
        } @else if (failure.category === 'forbidden') {
          <p>You are not allowed to delete this record.</p>
        }
      </div>
    }
    @if (list.error(); as error) {
      <p class="mt-4 text-red-600">{{ error.message }}</p>
    } @else {
      @if (total() === 0) {
        <p class="mt-4 text-gray-500">No records yet.</p>
      } @else if (list.hasValue()) {
        <div class="mt-4">
          <lib-resource-table [fields]="fields()" [data]="list.value().data">
            @if (canShow() || canEdit() || canDelete()) {
              <ng-template #actions let-row>
                <span class="flex gap-3">
                  @if (canShow()) {
                    <a
                      [routerLink]="['/', resource(), row.id]"
                      class="text-blue-600 hover:underline"
                      >Show</a
                    >
                  }
                  @if (canEdit()) {
                    <a
                      [routerLink]="['/', resource(), row.id, 'edit']"
                      class="text-blue-600 hover:underline"
                      >Edit</a
                    >
                  }
                  @if (canDelete()) {
                    <button
                      type="button"
                      [disabled]="list.isLoading() || deleting() !== null"
                      (click)="remove(row)"
                      class="text-red-600 hover:underline disabled:opacity-50"
                    >
                      {{ deleting()?.id === row.id ? 'Deleting…' : 'Delete' }}
                    </button>
                  }
                </span>
              </ng-template>
            }
          </lib-resource-table>
        </div>
      }
      <nav
        aria-label="Pagination"
        class="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-700"
      >
        <label class="flex items-center gap-2">
          Rows per page
          <select
            class="rounded border border-gray-300 px-2 py-1"
            [disabled]="list.isLoading()"
            (change)="changePageSize($event)"
          >
            @for (size of pageSizeOptions; track size) {
              <option [value]="size" [selected]="size === pageSize()">
                {{ size }}
              </option>
            }
          </select>
        </label>
        <span>Page {{ page() }} of {{ lastPage() }}</span>
        <span>{{ total() ?? '-' }} records</span>
        <button
          type="button"
          class="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
          [disabled]="list.isLoading() || page() <= 1"
          (click)="page.set(page() - 1)"
        >
          Previous
        </button>
        <button
          type="button"
          class="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
          [disabled]="list.isLoading() || page() >= lastPage()"
          (click)="page.set(page() + 1)"
        >
          Next
        </button>
      </nav>
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
  protected readonly lastPage = computed(() =>
    Math.max(1, Math.ceil((this.total() ?? 0) / this.pageSize())),
  );
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

  protected changePageSize(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.pageSize.set(Number(event.target.value));
    }
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
