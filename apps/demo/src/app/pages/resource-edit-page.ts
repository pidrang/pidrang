import { Component, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { injectDataProvider } from '@pidrang/core';

@Component({
  selector: 'app-resource-edit-page',
  imports: [RouterLink],
  template: `
    <h1>Edit {{ resource() }} #{{ id() }}</h1>
    <a [routerLink]="['/', resource(), id()]">Back to show</a>

    <textarea
      rows="10"
      cols="60"
      [value]="draft()"
      (input)="draft.set($any($event.target).value)"
    ></textarea>
    @if (error()) {
      <p>{{ error() }}</p>
    }
    <button type="button" (click)="submit()">Save</button>
  `,
})
export class ResourceEditPage {
  readonly resource = input.required<string>();
  readonly id = input.required<string>();

  protected readonly draft = signal('');
  protected readonly error = signal<string | null>(null);

  private readonly dataProvider = injectDataProvider();
  private readonly router = inject(Router);

  constructor() {
    // Re-runs whenever resource() or id() changes, so navigating between
    // records on the same component instance still reloads the draft.
    effect(() => {
      const resource = this.resource();
      const id = this.id();
      this.dataProvider.getOne(resource, { id }).then(
        (value) => this.draft.set(JSON.stringify(value, null, 2)),
        (err) => this.error.set(err instanceof Error ? err.message : String(err)),
      );
    });
  }

  protected async submit(): Promise<void> {
    try {
      const data = JSON.parse(this.draft());
      await this.dataProvider.update(this.resource(), { id: this.id(), data });
      await this.router.navigate(['/', this.resource(), this.id()]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }
}
