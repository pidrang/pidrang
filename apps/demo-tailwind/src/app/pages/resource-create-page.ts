import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ResourceForm } from '@pidrang/tailwind';
import { injectResourceCreateState } from '@pidrang/demo-shared';

@Component({
  selector: 'app-resource-create-page',
  imports: [RouterLink, ResourceForm],
  template: `
    <h1 class="text-2xl font-semibold text-gray-900">
      Create {{ resource() }}
    </h1>
    @if (canList()) {
      <a [routerLink]="['/', resource()]" class="text-blue-600 hover:underline"
        >Back to list</a
      >
    }

    @if (earlierSave.failure(); as earlierFailure) {
      <p role="alert" class="mt-4 text-red-600">
        The earlier create failed: {{ earlierFailure.message }}
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
      <p role="status" class="mt-4 text-gray-600">
        The earlier create finished.
      </p>
    }
    @if (savingElsewhere()) {
      <p role="status" class="mt-4 text-gray-600">
        A create on this resource is still running from an earlier visit. The
        form comes back when it finishes.
      </p>
    } @else if (!created()) {
      <div class="mt-4">
        <lib-resource-form
          [fields]="fields()"
          [value]="initialValue()"
          [pending]="saving()"
          (save)="submit($event)"
        />
      </div>
    }

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
  `,
})
export class ResourceCreatePage {
  readonly resource = input.required<string>();

  private readonly state = injectResourceCreateState(this.resource);
  protected readonly saving = this.state.saving;
  protected readonly savingElsewhere = this.state.savingElsewhere;
  protected readonly earlierSave = this.state.earlierSave;
  protected readonly created = this.state.created;
  protected readonly saveFailure = this.state.saveFailure;
  protected readonly canList = this.state.canList;
  protected readonly fields = this.state.fields;
  protected readonly initialValue = this.state.initialValue;
  protected readonly submit = this.state.submit;
}
