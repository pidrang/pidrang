import { Component, computed, effect, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectDataProvider } from '@pidrang/core';
import { MatButtonModule } from '@angular/material/button';
import { recordLabel } from '../record-label';

@Component({
  selector: 'app-resource-show-page',
  imports: [RouterLink, MatButtonModule],
  template: `
    <h1>{{ resource() }} — {{ label() }}</h1>
    <a mat-button [routerLink]="['/', resource()]">Back to list</a>
    @if (error()) {
      <p>{{ error() }}</p>
    } @else {
      <pre>{{ formattedRecord() }}</pre>
    }
  `,
})
export class ResourceShowPage {
  readonly resource = input.required<string>();
  readonly id = input.required<string>();

  protected readonly record = signal<Record<string, unknown> | undefined>(
    undefined,
  );
  protected readonly error = signal<string | null>(null);

  protected readonly label = computed(() => {
    const record = this.record();
    return record ? recordLabel(record) : this.id();
  });

  protected readonly formattedRecord = computed(() =>
    JSON.stringify(this.record(), null, 2),
  );

  private readonly dataProvider = injectDataProvider();

  constructor() {
    // Re-runs whenever resource() or id() changes, so navigating between
    // records on the same component instance still refetches.
    effect(() => {
      const resource = this.resource();
      const id = this.id();
      this.dataProvider.getOne<Record<string, unknown>>(resource, { id }).then(
        (record) => this.record.set(record),
        (err) =>
          this.error.set(err instanceof Error ? err.message : String(err)),
      );
    });
  }
}
