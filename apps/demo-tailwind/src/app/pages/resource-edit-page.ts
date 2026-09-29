import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  injectDataProvider,
  injectResources,
  isResourceActionEnabled,
} from '@pidrang/core';
import { ResourceForm } from '@pidrang/tailwind';
import { isAuthRequiredError, recordLabel } from '@pidrang/demo-shared';

const NON_EDITABLE_FIELDS = new Set(['id', 'created_at']);

interface SaveFailure {
  message: string;
  authRequired: boolean;
}

@Component({
  selector: 'app-resource-edit-page',
  imports: [RouterLink, ResourceForm],
  template: `
    <h1 class="text-2xl font-semibold text-gray-900">
      Edit {{ resource() }} — {{ label() }}
    </h1>
    @if (canShow()) {
      <a
        [routerLink]="['/', resource(), id()]"
        class="text-blue-600 hover:underline"
        >Back to show</a
      >
    } @else if (canList()) {
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
    } @else if (value(); as value) {
      <div class="mt-4">
        <lib-resource-form
          [fields]="fields()"
          [value]="value"
          [pending]="saving()"
          (save)="submit($event)"
        />
      </div>
      @if (saveFailure(); as failure) {
        <p role="alert" class="mt-4 text-red-600">{{ failure.message }}</p>
        @if (failure.authRequired) {
          <p class="text-gray-700">
            You may need to
            <a routerLink="/login" class="text-blue-600 hover:underline"
              >sign in</a
            >
            to make changes.
          </p>
        }
      }
    }
  `,
})
export class ResourceEditPage {
  readonly resource = input.required<string>();
  readonly id = input.required<string>();

  protected readonly saving = signal(false);
  protected readonly saveFailure = linkedSignal<
    { resource: string; id: string },
    SaveFailure | null
  >({
    source: () => ({ resource: this.resource(), id: this.id() }),
    computation: () => null,
  });

  private readonly dataProvider = injectDataProvider();
  private readonly router = inject(Router);
  private readonly resources = injectResources();
  private readonly destroyRef = inject(DestroyRef);

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
  protected readonly canShow = computed(() =>
    isResourceActionEnabled(this.definition(), 'show'),
  );
  protected readonly canList = computed(() =>
    isResourceActionEnabled(this.definition(), 'list'),
  );
  private readonly canEdit = computed(() =>
    isResourceActionEnabled(this.definition(), 'edit'),
  );

  protected readonly fields = computed(
    () =>
      this.definition()?.fields?.filter(
        (field) => !NON_EDITABLE_FIELDS.has(field.name) && !field.hidden,
      ) ?? [],
  );

  protected readonly value = computed(() => {
    if (!this.record.hasValue()) {
      return undefined;
    }
    const record = this.record.value();
    return Object.fromEntries(
      this.fields().map((field) => [field.name, record[field.name]]),
    );
  });

  protected readonly label = computed(() =>
    this.record.hasValue() ? recordLabel(this.record.value()) : this.id(),
  );

  protected async submit(data: Record<string, unknown>): Promise<void> {
    if (!this.canEdit() || this.saving()) {
      return;
    }
    const resource = this.resource();
    const id = this.id();
    this.saving.set(true);
    this.saveFailure.set(null);
    try {
      await this.dataProvider.update(resource, { id, data });
      if (this.isCurrent(resource, id)) {
        await this.router.navigate(this.destinationAfterSave());
      }
    } catch (err) {
      if (this.isCurrent(resource, id)) {
        this.saveFailure.set({
          message: err instanceof Error ? err.message : String(err),
          authRequired: isAuthRequiredError(err),
        });
      }
    } finally {
      this.saving.set(false);
    }
  }

  private destinationAfterSave(): unknown[] {
    if (this.canShow()) {
      return ['/', this.resource(), this.id()];
    }
    if (this.canList()) {
      return ['/', this.resource()];
    }
    return ['/'];
  }

  private isCurrent(resource: string, id: string): boolean {
    return (
      !this.destroyRef.destroyed &&
      resource === this.resource() &&
      id === this.id()
    );
  }
}
