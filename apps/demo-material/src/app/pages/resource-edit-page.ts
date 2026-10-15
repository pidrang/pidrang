import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ResourceForm } from '@pidrang/material';
import { MatButtonModule } from '@angular/material/button';
import { injectSignInUrl, injectResourceEditState } from '@pidrang/demo-shared';

@Component({
  selector: 'app-resource-edit-page',
  imports: [RouterLink, ResourceForm, MatButtonModule],
  template: `
    <h1>Edit {{ resource() }} — {{ label() }}</h1>
    @if (canShow()) {
      <a mat-button [routerLink]="['/', resource(), id()]">Back to show</a>
    } @else if (canList()) {
      <a mat-button [routerLink]="['/', resource()]">Back to list</a>
    }

    @if (earlierSave.failure(); as earlierFailure) {
      <p role="alert">The earlier save failed: {{ earlierFailure.message }}</p>
      @if (earlierFailure.authRequired) {
        <p>
          You may need to
          @if (signInUrl; as path) {
            <a [routerLink]="path">sign in</a>
          } @else {
            sign in
          }
          to make changes.
        </p>
      }
    }
    @if (earlierSave.finished()) {
      <p role="status">The earlier save finished.</p>
    }
    @if (record.isLoading()) {
      <p role="status">Loading…</p>
    }
    @if (stopped(); as message) {
      <p role="alert">{{ message }}</p>
    }
    @if (record.error(); as loadError) {
      <p role="alert">{{ loadError.message }}</p>
      <button mat-stroked-button type="button" (click)="record.reload()">
        Retry
      </button>
    } @else if (savingElsewhere()) {
      <p role="status">
        This record is being saved. The form comes back when that save finishes.
      </p>
    } @else if (value(); as value) {
      @for (r of [resource() + ':' + id()]; track r) {
        <pidrang-material-resource-form
          mode="edit"
          [fields]="fields()"
          [value]="value"
          [pending]="saving()"
          (save)="submit($event)"
        />
      }
      @if (saveFailure(); as failure) {
        <p role="alert">{{ failure.message }}</p>
        @if (failure.authRequired) {
          <p>
            You may need to
            @if (signInUrl; as path) {
              <a [routerLink]="path">sign in</a>
            } @else {
              sign in
            }
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
  protected readonly signInUrl = injectSignInUrl();
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
