import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectDataProvider, injectResourceList } from '@pidrang/core';

type Row = { id: string } & Record<string, unknown>;

@Component({
  selector: 'app-resource-list-page',
  imports: [RouterLink],
  template: `
    <h1>{{ resource() }}</h1>
    <a [routerLink]="['/', resource(), 'create']">Create</a>

    @if (list.isLoading()) {
      <p>Loading...</p>
    }
    @if (list.error(); as error) {
      <p>{{ error.message }}</p>
    }

    <table>
      <tbody>
        @for (row of list.value()?.data ?? []; track row.id) {
          <tr>
            <td>{{ stringify(row) }}</td>
            <td><a [routerLink]="['/', resource(), row.id]">Show</a></td>
            <td><a [routerLink]="['/', resource(), row.id, 'edit']">Edit</a></td>
            <td><button type="button" (click)="remove(row.id)">Delete</button></td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class ResourceListPage {
  readonly resource = input.required<string>();

  private readonly dataProvider = injectDataProvider();
  protected readonly list = injectResourceList<Row>(() => this.resource());
  protected readonly stringify = JSON.stringify;

  protected async remove(id: string): Promise<void> {
    await this.dataProvider.delete(this.resource(), { id });
    this.list.reload();
  }
}
