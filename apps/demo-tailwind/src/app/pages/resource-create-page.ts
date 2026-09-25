import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  Field,
  injectDataProvider,
  injectResources,
  isResourceActionEnabled,
} from '@pidrang/core';
import { ResourceForm } from '@pidrang/tailwind';
import { isAuthRequiredError } from '../auth-required-error';

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
    <h1 class="text-2xl font-semibold text-gray-900">
      Create {{ resource() }}
    </h1>
    @if (canList()) {
      <a [routerLink]="['/', resource()]" class="text-blue-600 hover:underline"
        >Back to list</a
      >
    }

    <div class="mt-4">
      <lib-resource-form
        [fields]="fields()"
        [value]="initialValue()"
        (save)="submit($event)"
      />
    </div>

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
    }
  `,
})
export class ResourceCreatePage {
  readonly resource = input.required<string>();

  protected readonly error = signal<string | null>(null);
  protected readonly authRequired = signal(false);

  private readonly dataProvider = injectDataProvider();
  private readonly router = inject(Router);
  private readonly resources = injectResources();

  private readonly definition = computed(() =>
    this.resources.find((resource) => resource.name === this.resource()),
  );
  protected readonly canList = computed(() =>
    isResourceActionEnabled(this.definition(), 'list'),
  );
  private readonly canCreate = computed(() =>
    isResourceActionEnabled(this.definition(), 'create'),
  );
  private readonly canShow = computed(() =>
    isResourceActionEnabled(this.definition(), 'show'),
  );

  protected readonly fields = computed(
    () =>
      this.definition()?.fields?.filter(
        (field) => !NON_EDITABLE_FIELDS.has(field.name),
      ) ?? [],
  );

  protected readonly initialValue = computed(() =>
    Object.fromEntries(
      this.fields().map((field) => [field.name, defaultValueForField(field)]),
    ),
  );

  protected async submit(data: Record<string, unknown>): Promise<void> {
    if (!this.canCreate()) {
      return;
    }
    try {
      const created = await this.dataProvider.create<Record<string, unknown>>(
        this.resource(),
        { data },
      );
      await this.router.navigate(this.destinationAfterCreate(created['id']));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      this.authRequired.set(isAuthRequiredError(err));
    }
  }

  private destinationAfterCreate(id: unknown): unknown[] {
    if (this.canList()) {
      return ['/', this.resource()];
    }
    if (this.canShow() && (typeof id === 'string' || typeof id === 'number')) {
      return ['/', this.resource(), id];
    }
    return ['/'];
  }
}
