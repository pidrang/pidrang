import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { injectDataProvider, injectResources } from '@pidrang/core';
import { ResourceForm } from '@pidrang/material';

const NON_EDITABLE_FIELDS = new Set(['id', 'created_at']);

@Component({
  selector: 'app-resource-edit-page',
  imports: [RouterLink, ResourceForm],
  template: `
    <h1>Edit {{ resource() }} #{{ id() }}</h1>
    <a [routerLink]="['/', resource(), id()]">Back to show</a>

    @if (error()) {
      <p>{{ error() }}</p>
    } @else if (value(); as value) {
      <lib-resource-form
        [fields]="fields()"
        [value]="value"
        (save)="submit($event)"
      />
    }
  `,
})
export class ResourceEditPage {
  readonly resource = input.required<string>();
  readonly id = input.required<string>();

  protected readonly value = signal<Record<string, unknown> | undefined>(
    undefined,
  );
  protected readonly error = signal<string | null>(null);

  private readonly dataProvider = injectDataProvider();
  private readonly router = inject(Router);
  private readonly resources = injectResources();

  protected readonly fields = computed(
    () =>
      this.resources
        .find((resource) => resource.name === this.resource())
        ?.fields?.filter((field) => !NON_EDITABLE_FIELDS.has(field.name)) ?? [],
  );

  constructor() {
    // Re-runs whenever resource() or id() changes, so navigating between
    // records on the same component instance still reloads the value.
    effect(() => {
      const resource = this.resource();
      const id = this.id();
      const fields = this.fields();
      this.value.set(undefined);
      this.dataProvider.getOne<Record<string, unknown>>(resource, { id }).then(
        (record) =>
          this.value.set(
            Object.fromEntries(
              fields.map((field) => [field.name, record[field.name]]),
            ),
          ),
        (err) =>
          this.error.set(err instanceof Error ? err.message : String(err)),
      );
    });
  }

  protected async submit(data: Record<string, unknown>): Promise<void> {
    try {
      await this.dataProvider.update(this.resource(), { id: this.id(), data });
      await this.router.navigate(['/', this.resource(), this.id()]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }
}
