import {
  Component,
  computed,
  effect,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  injectDataProvider,
  injectResourceList,
  injectResources,
} from '@pidrang/core';
import { ResourceTable } from '@pidrang/material';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

type Row = { id: string } & Record<string, unknown>;

const PAGE_SIZE_OPTIONS = [10, 25, 50];

@Component({
  selector: 'app-resource-list-page',
  imports: [RouterLink, ResourceTable, MatButtonModule, MatPaginatorModule],
  template: `
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
    } @else {
      @if (total() === 0) {
        <p>No records yet.</p>
      } @else if (list.hasValue()) {
        <lib-resource-table [fields]="fields()" [data]="list.value().data">
          <ng-template #actions let-row>
            <a mat-button [routerLink]="['/', resource(), row.id]">Show</a>
            <a mat-button [routerLink]="['/', resource(), row.id, 'edit']"
              >Edit</a
            >
            <button
              mat-stroked-button
              color="warn"
              type="button"
              [disabled]="list.isLoading()"
              (click)="remove(row.id)"
            >
              Delete
            </button>
          </ng-template>
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
  protected readonly pageSize = signal(PAGE_SIZE_OPTIONS[0]);
  protected readonly page = linkedSignal({
    source: () => ({ resource: this.resource(), pageSize: this.pageSize() }),
    computation: () => 1,
  });

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
  protected readonly fields = computed(
    () =>
      this.resources
        .find((resource) => resource.name === this.resource())
        ?.fields?.filter((field) => !field.hidden) ?? [],
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

  protected async remove(id: string): Promise<void> {
    await this.dataProvider.delete(this.resource(), { id });
    this.list.reload();
  }
}
