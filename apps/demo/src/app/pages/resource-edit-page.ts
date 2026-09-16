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
import { MatButtonModule } from '@angular/material/button';
import { recordLabel } from '../record-label';

const NON_EDITABLE_FIELDS = new Set(['id', 'created_at']);

@Component({
  selector: 'app-resource-edit-page',
  imports: [RouterLink, ResourceForm, MatButtonModule],
  template: `
    <h1>Edit {{ resource() }} — {{ label() }}</h1>
    <a mat-button [routerLink]="['/', resource(), id()]">Back to show</a>

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

  protected readonly record = signal<Record<string, unknown> | undefined>(
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

  protected readonly value = computed(() => {
    const record = this.record();
    if (!record) {
      return undefined;
    }
    return Object.fromEntries(
      this.fields().map((field) => [field.name, record[field.name]]),
    );
  });

  protected readonly label = computed(() => {
    const record = this.record();
    return record ? recordLabel(record) : this.id();
  });

  constructor() {
    // Re-runs whenever resource() or id() changes, so navigating between
    // records on the same component instance still reloads the record.
    effect(() => {
      const resource = this.resource();
      const id = this.id();
      this.record.set(undefined);
      this.dataProvider.getOne<Record<string, unknown>>(resource, { id }).then(
        (record) => this.record.set(record),
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
