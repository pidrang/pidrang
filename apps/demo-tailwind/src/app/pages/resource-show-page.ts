import { Component, computed, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  injectDataProvider,
  injectResources,
  isResourceActionEnabled,
} from '@pidrang/core';
import { recordLabel } from '@pidrang/demo-shared';

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
    @if (record.isLoading()) {
      <p role="status" class="mt-4 text-gray-600">Loading…</p>
    }
    @if (record.error(); as loadError) {
      <p role="alert" class="mt-4 text-red-600">{{ loadError.message }}</p>
      <button
        type="button"
        (click)="record.reload()"
        class="mt-2 rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
      >
        Retry
      </button>
    } @else if (record.value(); as record) {
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
