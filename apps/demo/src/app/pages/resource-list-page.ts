import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  injectDataProvider,
  injectResourceList,
  injectResources,
} from '@pidrang/core';
import { ResourceTable } from '@pidrang/material';

type Row = { id: string } & Record<string, unknown>;

@Component({
  selector: 'app-resource-list-page',
  imports: [RouterLink, ResourceTable],
  template: `
    <h1>{{ resource() }}</h1>
    <a [routerLink]="['/', resource(), 'create']">Create</a>

    @if (list.isLoading()) {
      <p>Loading...</p>
    }
    @if (list.error(); as error) {
      <p>{{ error.message }}</p>
    }

    <lib-resource-table [fields]="fields()" [data]="list.value()?.data ?? []" />

    <ul>
      @for (row of list.value()?.data ?? []; track row.id) {
        <li>
          <a [routerLink]="['/', resource(), row.id]">Show</a>
          <a [routerLink]="['/', resource(), row.id, 'edit']">Edit</a>
          <button type="button" (click)="remove(row.id)">Delete</button>
        </li>
      }
    </ul>
  `,
})
export class ResourceListPage {
  readonly resource = input.required<string>();

  private readonly dataProvider = injectDataProvider();
  private readonly resources = injectResources();
  protected readonly list = injectResourceList<Row>(() => this.resource());
  protected readonly fields = computed(
    () =>
      this.resources.find((resource) => resource.name === this.resource())
        ?.fields ?? [],
  );

  protected async remove(id: string): Promise<void> {
    await this.dataProvider.delete(this.resource(), { id });
    this.list.reload();
  }
}
