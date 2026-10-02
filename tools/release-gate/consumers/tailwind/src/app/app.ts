import { Component } from '@angular/core';
import { Field, injectResourceList } from '@pidrang/core';
import { ResourceForm, ResourceTable } from '@pidrang/tailwind';

type Row = { id: string } & Record<string, unknown>;

@Component({
  selector: 'app-root',
  imports: [ResourceForm, ResourceTable],
  template: `
    <h1>Release gate consumer</h1>
    @if (list.error(); as error) {
      <p role="alert">{{ error.message }}</p>
      <button type="button" (click)="list.reload()">Retry</button>
    } @else if (list.hasValue()) {
      <lib-resource-table [fields]="fields" [data]="list.value().data" />
    } @else {
      <p role="status">Loading…</p>
    }
    <lib-resource-form [fields]="formFields" [value]="draft" />
  `,
})
export class App {
  protected readonly fields: Field[] = [
    { name: 'id', type: 'text' },
    { name: 'name', type: 'text' },
    { name: 'price', type: 'number' },
  ];
  protected readonly formFields: Field[] = this.fields.slice(1);
  protected readonly draft = { name: '', price: 0 };
  protected readonly list = injectResourceList<Row>('products', () => ({
    sorters: [{ field: 'id', order: 'asc' }],
  }));
}
