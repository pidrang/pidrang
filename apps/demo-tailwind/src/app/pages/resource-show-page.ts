import { Component, computed, effect, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  injectDataProvider,
  injectResources,
  isResourceActionEnabled,
} from '@pidrang/core';
import { recordLabel } from '../record-label';

@Component({
  selector: 'app-resource-show-page',
  imports: [RouterLink],
  template: `
    <h1 class="text-2xl font-semibold text-gray-900">
      {{ resource() }} — {{ label() }}
    </h1>
    @if (canList()) {
      <a [routerLink]="['/', resource()]" class="text-blue-600 hover:underline"
        >Back to list</a
      >
    }
    @if (error()) {
      <p class="mt-4 text-red-600">{{ error() }}</p>
    } @else if (record(); as record) {
      <dl class="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
        @for (field of fields(); track field.name) {
          <dt class="font-medium text-gray-700">
            {{ field.label ?? field.name }}
          </dt>
          <dd class="text-gray-900">{{ record[field.name] }}</dd>
        }
      </dl>
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

  private readonly dataProvider = injectDataProvider();
  private readonly resources = injectResources();

  private readonly definition = computed(() =>
    this.resources.find((resource) => resource.name === this.resource()),
  );
  protected readonly canList = computed(() =>
    isResourceActionEnabled(this.definition(), 'list'),
  );

  protected readonly fields = computed(() => this.definition()?.fields ?? []);

  protected readonly label = computed(() => {
    const record = this.record();
    return record ? recordLabel(record) : this.id();
  });

  constructor() {
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
