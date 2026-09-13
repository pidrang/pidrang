import { Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { injectDataProvider } from '@pidrang/core';

@Component({
  selector: 'app-resource-create-page',
  imports: [RouterLink],
  template: `
    <h1>Create {{ resource() }}</h1>
    <a [routerLink]="['/', resource()]">Back to list</a>

    <textarea
      rows="10"
      cols="60"
      [value]="draft()"
      (input)="draft.set($any($event.target).value)"
    ></textarea>
    @if (error()) {
      <p>{{ error() }}</p>
    }
    <button type="button" (click)="submit()">Create</button>
  `,
})
export class ResourceCreatePage {
  readonly resource = input.required<string>();

  protected readonly draft = signal('{}');
  protected readonly error = signal<string | null>(null);

  private readonly dataProvider = injectDataProvider();
  private readonly router = inject(Router);

  protected async submit(): Promise<void> {
    try {
      const data = JSON.parse(this.draft());
      await this.dataProvider.create(this.resource(), { data });
      await this.router.navigate(['/', this.resource()]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }
}
