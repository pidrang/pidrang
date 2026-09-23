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
import { ResourceForm } from '@pidrang/tailwind';
import { recordLabel } from '../record-label';
import { isAuthRequiredError } from '../auth-required-error';

const NON_EDITABLE_FIELDS = new Set(['id', 'created_at']);

@Component({
  selector: 'app-resource-edit-page',
  imports: [RouterLink, ResourceForm],
  template: `
    <h1 class="text-2xl font-semibold text-gray-900">
      Edit {{ resource() }} — {{ label() }}
    </h1>
    <a
      [routerLink]="['/', resource(), id()]"
      class="text-blue-600 hover:underline"
      >Back to show</a
    >

    @if (error()) {
      <p class="mt-4 text-red-600">{{ error() }}</p>
      @if (authRequired()) {
        <p class="text-gray-700">
          You may need to
          <a routerLink="/login" class="text-blue-600 hover:underline"
            >sign in</a
          >
          to make changes.
        </p>
      }
    } @else if (value(); as value) {
      <div class="mt-4">
        <lib-resource-form
          [fields]="fields()"
          [value]="value"
          (save)="submit($event)"
        />
      </div>
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
  protected readonly authRequired = signal(false);

  private readonly dataProvider = injectDataProvider();
  private readonly router = inject(Router);
  private readonly resources = injectResources();

  protected readonly fields = computed(
    () =>
      this.resources
        .find((resource) => resource.name === this.resource())
        ?.fields?.filter(
          (field) => !NON_EDITABLE_FIELDS.has(field.name) && !field.hidden,
        ) ?? [],
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
      this.authRequired.set(isAuthRequiredError(err));
    }
  }
}
