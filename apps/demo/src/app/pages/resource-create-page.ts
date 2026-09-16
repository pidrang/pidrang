import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Field, injectDataProvider, injectResources } from '@pidrang/core';
import { ResourceForm } from '@pidrang/material';

const NON_EDITABLE_FIELDS = new Set(['id', 'created_at']);

function defaultValueForField(field: Field): unknown {
  switch (field.type) {
    case 'number':
      return 0;
    case 'boolean':
      return false;
    default:
      return '';
  }
}

@Component({
  selector: 'app-resource-create-page',
  imports: [RouterLink, ResourceForm],
  template: `
    <h1>Create {{ resource() }}</h1>
    <a [routerLink]="['/', resource()]">Back to list</a>

    <lib-resource-form
      [fields]="fields()"
      [value]="initialValue()"
      (save)="submit($event)"
    />

    @if (error()) {
      <p>{{ error() }}</p>
    }
  `,
})
export class ResourceCreatePage {
  readonly resource = input.required<string>();

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

  protected readonly initialValue = computed(() =>
    Object.fromEntries(
      this.fields().map((field) => [field.name, defaultValueForField(field)]),
    ),
  );

  protected async submit(data: Record<string, unknown>): Promise<void> {
    try {
      await this.dataProvider.create(this.resource(), { data });
      await this.router.navigate(['/', this.resource()]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }
}
