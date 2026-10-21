import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ResourceTable } from '@pidrang/tailwind';
import { injectSignInUrl, injectResourceListState } from '@pidrang/demo-shared';

@Component({
  selector: 'app-resource-list-page',
  imports: [RouterLink, ResourceTable],
  template: `
    <h1 class="text-2xl font-semibold text-gray-900">{{ title() }}</h1>
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
            @if (signInUrl; as path) {
              <a [routerLink]="path" class="underline">sign in</a>
            } @else {
              sign in
            }
            to delete records.
          </p>
        } @else if (failure.category === 'forbidden') {
          <p>You are not allowed to delete this record.</p>
        }
      </div>
    }
    @if (stopped(); as message) {
      <p role="alert" class="mt-4 text-red-600">{{ message }}</p>
    }
    @if (earlierDelete.failure(); as earlierFailure) {
      <div role="alert" class="mt-4 text-red-600">
        <p>The earlier delete failed: {{ earlierFailure.message }}</p>
        @if (earlierFailure.category === 'unauthenticated') {
          <p>
            You may need to
            @if (signInUrl; as path) {
              <a [routerLink]="path" class="underline">sign in</a>
            } @else {
              sign in
            }
            to delete records.
          </p>
        } @else if (earlierFailure.category === 'forbidden') {
          <p>You are not allowed to delete this record.</p>
        }
      </div>
    }
    @if (earlierDelete.finished()) {
      <p role="status" class="mt-4 text-gray-500">
        The earlier delete finished.
      </p>
    }
    @if (deletingElsewhere()) {
      <p role="status" class="mt-4 text-gray-500">
        A delete on this resource is still running. Delete comes back when it
        finishes.
      </p>
    }
    @if (list.error(); as error) {
      <p class="mt-4 text-red-600">{{ error.message }}</p>
    } @else {
      @if (total() === 0) {
        <p class="mt-4 text-gray-500">No records yet.</p>
      } @else if (list.hasValue()) {
        <div class="mt-4">
          <pidrang-tailwind-resource-table
            [fields]="fields()"
            [data]="list.value().data"
          >
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
                      [disabled]="list.isLoading() || deleteLocked()"
                      (click)="remove(row)"
                      class="text-red-600 hover:underline disabled:opacity-50"
                    >
                      {{ deleting()?.id === row.id ? 'Deleting…' : 'Delete' }}
                    </button>
                  }
                </span>
              </ng-template>
            }
          </pidrang-tailwind-resource-table>
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
            [disabled]="list.isLoading() || deleteLocked()"
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
          [disabled]="list.isLoading() || deleteLocked() || page() <= 1"
          (click)="page.set(page() - 1)"
        >
          Previous
        </button>
        <button
          type="button"
          class="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
          [disabled]="
            list.isLoading() || deleteLocked() || page() >= lastPage()
          "
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

  private readonly state = injectResourceListState(this.resource);
  protected readonly signInUrl = injectSignInUrl();
  protected readonly title = this.state.title;
  protected readonly pageSizeOptions = this.state.pageSizeOptions;
  protected readonly pageSize = this.state.pageSize;
  protected readonly page = this.state.page;
  protected readonly lastPage = this.state.lastPage;
  protected readonly list = this.state.list;
  protected readonly total = this.state.total;
  protected readonly deleting = this.state.deleting;
  protected readonly deleteLocked = this.state.deleteLocked;
  protected readonly deletingElsewhere = this.state.deletingElsewhere;
  protected readonly stopped = this.state.stopped;
  protected readonly earlierDelete = this.state.earlierDelete;
  protected readonly deleteFailure = this.state.deleteFailure;
  protected readonly canCreate = this.state.canCreate;
  protected readonly canShow = this.state.canShow;
  protected readonly canEdit = this.state.canEdit;
  protected readonly canDelete = this.state.canDelete;
  protected readonly fields = this.state.fields;
  protected readonly remove = this.state.remove;

  protected changePageSize(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.pageSize.set(Number(event.target.value));
    }
  }
}
