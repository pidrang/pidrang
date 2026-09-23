import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  injectDataProvider,
  injectResourceList,
  injectResources,
} from '@pidrang/core';
import { ResourceTable } from '@pidrang/tailwind';

type Row = { id: string } & Record<string, unknown>;

@Component({
  selector: 'app-resource-list-page',
  imports: [RouterLink, ResourceTable],
  template: `
    <h1 class="text-2xl font-semibold text-gray-900">{{ resource() }}</h1>
    <a
      [routerLink]="['/', resource(), 'create']"
      class="mt-2 inline-block rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
      >Create</a
    >

    @if (list.isLoading()) {
      <p class="mt-4 text-gray-500">Loading...</p>
    }
    @if (list.error(); as error) {
      <p class="mt-4 text-red-600">{{ error.message }}</p>
    }

    <div class="mt-4">
      <lib-resource-table [fields]="fields()" [data]="list.value()?.data ?? []">
        <ng-template #actions let-row>
          <a
            [routerLink]="['/', resource(), row.id]"
            class="text-blue-600 hover:underline"
            >Show</a
          >
          <a
            [routerLink]="['/', resource(), row.id, 'edit']"
            class="ml-3 text-blue-600 hover:underline"
            >Edit</a
          >
          <button
            type="button"
            (click)="remove(row.id)"
            class="ml-3 text-red-600 hover:underline"
          >
            Delete
          </button>
        </ng-template>
      </lib-resource-table>
    </div>
  `,
})
export class ResourceListPage {
  readonly resource = input.required<string>();

  private readonly dataProvider = injectDataProvider();
  private readonly resources = injectResources();
  protected readonly list = injectResourceList<Row>(() => this.resource());
  protected readonly fields = computed(
    () =>
      this.resources
        .find((resource) => resource.name === this.resource())
        ?.fields?.filter((field) => !field.hidden) ?? [],
  );

  protected async remove(id: string): Promise<void> {
    await this.dataProvider.delete(this.resource(), { id });
    this.list.reload();
  }
}
