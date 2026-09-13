import { Component, effect, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectDataProvider } from '@pidrang/core';

@Component({
  selector: 'app-resource-show-page',
  imports: [RouterLink],
  template: `
    <h1>{{ resource() }} #{{ id() }}</h1>
    <a [routerLink]="['/', resource()]">Back to list</a>
    @if (error()) {
      <p>{{ error() }}</p>
    } @else {
      <pre>{{ row() }}</pre>
    }
  `,
})
export class ResourceShowPage {
  readonly resource = input.required<string>();
  readonly id = input.required<string>();

  protected readonly row = signal('');
  protected readonly error = signal<string | null>(null);

  private readonly dataProvider = injectDataProvider();

  constructor() {
    // Re-runs whenever resource() or id() changes, so navigating between
    // records on the same component instance still refetches.
    effect(() => {
      const resource = this.resource();
      const id = this.id();
      this.dataProvider.getOne(resource, { id }).then(
        (value) => this.row.set(JSON.stringify(value, null, 2)),
        (err) => this.error.set(err instanceof Error ? err.message : String(err)),
      );
    });
  }
}
