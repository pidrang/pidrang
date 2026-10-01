import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ResourceForm } from '@pidrang/tailwind';
import { injectResourceEditState } from '@pidrang/demo-shared';

@Component({
  selector: 'app-resource-edit-page',
  imports: [RouterLink, ResourceForm],
  template: `
    <h1 class="text-2xl font-semibold text-gray-900">
      Edit {{ resource() }} — {{ label() }}
    </h1>
    @if (canShow()) {
      <a
        [routerLink]="['/', resource(), id()]"
        class="text-blue-600 hover:underline"
        >Back to show</a
      >
    } @else if (canList()) {
      <a [routerLink]="['/', resource()]" class="text-blue-600 hover:underline"
        >Back to list</a
      >
    }

    @if (earlierSave.failure(); as earlierFailure) {
      <p role="alert" class="mt-4 text-red-600">
        The earlier save failed: {{ earlierFailure.message }}
      </p>
      @if (earlierFailure.authRequired) {
        <p class="text-gray-700">
          You may need to
          <a routerLink="/login" class="text-blue-600 hover:underline"
            >sign in</a
          >
          to make changes.
        </p>
      }
    }
    @if (earlierSave.finished()) {
      <p role="status" class="mt-4 text-gray-600">The earlier save finished.</p>
    }
    @if (record.isLoading()) {
      <p role="status" class="mt-4 text-gray-600">Loading…</p>
    }
    @if (stopped(); as message) {
      <p role="alert" class="mt-4 text-red-600">{{ message }}</p>
    }
    @if (record.error(); as loadError) {
      <p role="alert" class="mt-4 text-red-600">{{ loadError.message }}</p>
      <button
        type="button"
        (click)="record.reload()"
        class="mt-2 rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
      >
        Retry
      </button>
    } @else if (savingElsewhere()) {
      <p role="status" class="mt-4 text-gray-600">
        This record is being saved. The form comes back when that save finishes.
      </p>
    } @else if (value(); as value) {
      <div class="mt-4">
        <lib-resource-form
          [fields]="fields()"
          [value]="value"
          [pending]="saving()"
          (save)="submit($event)"
        />
      </div>
      @if (saveFailure(); as failure) {
        <p role="alert" class="mt-4 text-red-600">{{ failure.message }}</p>
        @if (failure.authRequired) {
          <p class="text-gray-700">
            You may need to
            <a routerLink="/login" class="text-blue-600 hover:underline"
              >sign in</a
            >
            to make changes.
          </p>
        }
      }
    }
  `,
})
export class ResourceEditPage {
  readonly resource = input.required<string>();
  readonly id = input.required<string>();

  private readonly state = injectResourceEditState(this.resource, this.id);
  protected readonly saving = this.state.saving;
  protected readonly savingElsewhere = this.state.savingElsewhere;
  protected readonly earlierSave = this.state.earlierSave;
  protected readonly stopped = this.state.stopped;
  protected readonly saveFailure = this.state.saveFailure;
  protected readonly record = this.state.record;
  protected readonly label = this.state.label;
  protected readonly canShow = this.state.canShow;
  protected readonly canList = this.state.canList;
  protected readonly fields = this.state.fields;
  protected readonly value = this.state.value;
  protected readonly submit = this.state.submit;
}
