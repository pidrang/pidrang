import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ResourceForm } from '@pidrang/material';
import { MatButtonModule } from '@angular/material/button';
import { injectResourceCreateState } from '@pidrang/demo-shared';

@Component({
  selector: 'app-resource-create-page',
  imports: [RouterLink, ResourceForm, MatButtonModule],
  template: `
    <h1>Create {{ resource() }}</h1>
    @if (canList()) {
      <a mat-button [routerLink]="['/', resource()]">Back to list</a>
    }

    @if (earlierSave.failure(); as earlierFailure) {
      <p role="alert">
        The earlier create failed: {{ earlierFailure.message }}
      </p>
      @if (earlierFailure.authRequired) {
        <p>
          You may need to <a routerLink="/login">sign in</a> to make changes.
        </p>
      }
    }
    @if (earlierSave.finished()) {
      <p role="status">The earlier create finished.</p>
    }
    @if (savingElsewhere()) {
      <p role="status">
        A create on this resource is still running from an earlier visit. The
        form comes back when it finishes.
      </p>
    } @else if (!created()) {
      <lib-resource-form
        [fields]="fields()"
        [value]="initialValue()"
        [pending]="saving()"
        (save)="submit($event)"
      />
    }

    @if (saveFailure(); as failure) {
      <p role="alert">{{ failure.message }}</p>
      @if (failure.authRequired) {
        <p>
          You may need to <a routerLink="/login">sign in</a> to make changes.
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
