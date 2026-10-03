import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ResourceTable } from '@pidrang/material';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { injectSignInUrl, injectResourceListState } from '@pidrang/demo-shared';

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
            You may need to
            @if (signInUrl; as path) {
              <a [routerLink]="path">sign in</a>
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
      <p role="alert">{{ message }}</p>
    }
    @if (earlierDelete.failure(); as earlierFailure) {
      <div role="alert">
        <p>The earlier delete failed: {{ earlierFailure.message }}</p>
        @if (earlierFailure.category === 'unauthenticated') {
          <p>
            You may need to
            @if (signInUrl; as path) {
              <a [routerLink]="path">sign in</a>
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
      <p role="status">The earlier delete finished.</p>
    }
    @if (deletingElsewhere()) {
      <p role="status">
        A delete on this resource is still running. Delete comes back when it
        finishes.
      </p>
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
                  [disabled]="list.isLoading() || deleteLocked()"
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
        [disabled]="list.isLoading() || deleteLocked()"
        (page)="changePage($event)"
      />
    }
  `,
})
export class ResourceListPage {
  readonly resource = input.required<string>();

  private readonly state = injectResourceListState(this.resource);
  protected readonly signInUrl = injectSignInUrl();
  protected readonly pageSizeOptions = this.state.pageSizeOptions;
  protected readonly pageSize = this.state.pageSize;
  protected readonly page = this.state.page;
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

  protected changePage(event: PageEvent): void {
    if (event.pageSize !== this.pageSize()) {
      this.pageSize.set(event.pageSize);
      return;
    }
    this.page.set(event.pageIndex + 1);
  }
}
