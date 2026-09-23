import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  injectDataProvider,
  injectResourceList,
  injectResources,
} from '@pidrang/core';
import { ResourceTable } from '@pidrang/material';
import { MatButtonModule } from '@angular/material/button';

type Row = { id: string } & Record<string, unknown>;

@Component({
  selector: 'app-resource-list-page',
  imports: [RouterLink, ResourceTable, MatButtonModule],
  template: `
    <h1>{{ resource() }}</h1>
    <a
      mat-flat-button
      color="primary"
      [routerLink]="['/', resource(), 'create']"
      >Create</a
    >

    @if (list.isLoading()) {
      <p>Loading...</p>
    }
    @if (list.error(); as error) {
      <p>{{ error.message }}</p>
    }

    <lib-resource-table [fields]="fields()" [data]="list.value()?.data ?? []">
      <ng-template #actions let-row>
        <a mat-button [routerLink]="['/', resource(), row.id]">Show</a>
        <a mat-button [routerLink]="['/', resource(), row.id, 'edit']">Edit</a>
        <button
          mat-stroked-button
          color="warn"
          type="button"
          (click)="remove(row.id)"
        >
          Delete
        </button>
      </ng-template>
    </lib-resource-table>
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
