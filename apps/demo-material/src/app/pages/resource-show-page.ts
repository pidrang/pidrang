import { Component, computed, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  injectDataProvider,
  injectResources,
  isResourceActionEnabled,
} from '@pidrang/core';
import { MatButtonModule } from '@angular/material/button';
import { recordLabel } from '../record-label';

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

  private readonly dataProvider = injectDataProvider();
  private readonly resources = injectResources();

  protected readonly record = resource({
    params: () => ({ resource: this.resource(), id: this.id() }),
    loader: ({ params }) =>
      this.dataProvider.getOne<Record<string, unknown>>(params.resource, {
        id: params.id,
      }),
  });

  private readonly definition = computed(() =>
    this.resources.find((resource) => resource.name === this.resource()),
  );
  protected readonly canList = computed(() =>
    isResourceActionEnabled(this.definition(), 'list'),
  );

  protected readonly fields = computed(() => this.definition()?.fields ?? []);

  protected readonly label = computed(() =>
    this.record.hasValue() ? recordLabel(this.record.value()) : this.id(),
  );
}
