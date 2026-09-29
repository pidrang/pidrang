import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { injectResourceShowState } from '@pidrang/demo-shared';

@Component({
  selector: 'app-resource-show-page',
  imports: [RouterLink, MatButtonModule],
  template: `
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
  `,
})
export class ResourceShowPage {
  readonly resource = input.required<string>();
  readonly id = input.required<string>();

  private readonly state = injectResourceShowState(this.resource, this.id);
  protected readonly record = this.state.record;
  protected readonly label = this.state.label;
  protected readonly canList = this.state.canList;
  protected readonly fields = this.state.fields;
}
