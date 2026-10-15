import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ResourceTable } from './resource-table';

describe('ResourceTable', () => {
  it('renders one header per field, using label over name when set', async () => {
    TestBed.configureTestingModule({ imports: [ResourceTable] });

    const fixture = TestBed.createComponent(ResourceTable);
    fixture.componentRef.setInput('fields', [
      { name: 'id', type: 'text' },
      { name: 'email', label: 'Email address', type: 'text' },
    ]);
    fixture.componentRef.setInput('data', []);
    await fixture.whenStable();

    const headers = fixture.nativeElement.querySelectorAll('th');
    expect(
      Array.from(headers).map((header) =>
        (header as HTMLElement).textContent?.trim(),
      ),
    ).toEqual(['id', 'Email address']);
  });

  it('renders one row per data item, reading each cell from the matching field name', async () => {
    TestBed.configureTestingModule({ imports: [ResourceTable] });

    const fixture = TestBed.createComponent(ResourceTable);
    fixture.componentRef.setInput('fields', [{ name: 'name', type: 'text' }]);
    fixture.componentRef.setInput('data', [{ name: 'Alice' }, { name: 'Bob' }]);
    await fixture.whenStable();

    const cells = fixture.nativeElement.querySelectorAll('td');
    expect(
      Array.from(cells).map((cell) =>
        (cell as HTMLElement).textContent?.trim(),
      ),
    ).toEqual(['Alice', 'Bob']);
  });

  it('keeps each row element bound to its id when the data is reordered', async () => {
    TestBed.configureTestingModule({ imports: [ResourceTable] });

    const fixture = TestBed.createComponent(ResourceTable);
    fixture.componentRef.setInput('fields', [{ name: 'name', type: 'text' }]);
    fixture.componentRef.setInput('data', [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
    await fixture.whenStable();
    const [aliceRow, bobRow] =
      fixture.nativeElement.querySelectorAll('tbody tr');

    fixture.componentRef.setInput('data', [
      { id: 2, name: 'Bob' },
      { id: 1, name: 'Alice' },
    ]);
    await fixture.whenStable();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows[0]).toBe(bobRow);
    expect(rows[1]).toBe(aliceRow);
  });

  it('renders a projected actions template as the last cell of each row', async () => {
    @Component({
      imports: [ResourceTable],
      template: `
        <pidrang-tailwind-resource-table [fields]="fields" [data]="data">
          <ng-template #actions let-row>
            <button type="button">Delete {{ row.name }}</button>
          </ng-template>
        </pidrang-tailwind-resource-table>
      `,
    })
    class HostWithActions {
      protected readonly fields = [{ name: 'name', type: 'text' as const }];
      protected readonly data = [{ name: 'Alice' }, { name: 'Bob' }];
    }

    TestBed.configureTestingModule({ imports: [HostWithActions] });

    const fixture = TestBed.createComponent(HostWithActions);
    await fixture.whenStable();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('button').textContent.trim()).toBe(
      'Delete Alice',
    );
    expect(rows[1].querySelector('button').textContent.trim()).toBe(
      'Delete Bob',
    );
  });

  it('renders a real actions field next to the projected actions, under an Actions header', async () => {
    @Component({
      imports: [ResourceTable],
      template: `
        <pidrang-tailwind-resource-table [fields]="fields" [data]="data">
          <ng-template #actions let-row>
            <button type="button">Delete {{ row.name }}</button>
          </ng-template>
        </pidrang-tailwind-resource-table>
      `,
    })
    class HostWithActionsField {
      protected readonly fields = [
        { name: 'name', type: 'text' as const },
        { name: 'actions', label: 'Allowed actions', type: 'text' as const },
      ];
      protected readonly data = [{ name: 'Alice', actions: 'read' }];
    }

    TestBed.configureTestingModule({ imports: [HostWithActionsField] });

    const fixture = TestBed.createComponent(HostWithActionsField);
    await fixture.whenStable();

    const headers = Array.from(
      fixture.nativeElement.querySelectorAll('th') as NodeListOf<HTMLElement>,
    ).map((header) => header.textContent?.trim());
    expect(headers).toEqual(['name', 'Allowed actions', 'Actions']);
    const cells = Array.from(
      fixture.nativeElement.querySelectorAll(
        'tbody td',
      ) as NodeListOf<HTMLElement>,
    ).map((cell) => cell.textContent?.trim());
    expect(cells).toEqual(['Alice', 'read', 'Delete Alice']);
  });

  it('renders headers and cells of the new fields when the fields change', async () => {
    TestBed.configureTestingModule({ imports: [ResourceTable] });

    const fixture = TestBed.createComponent(ResourceTable);
    fixture.componentRef.setInput('fields', [
      { name: 'name', type: 'text' },
      { name: 'email', type: 'text' },
    ]);
    fixture.componentRef.setInput('data', [
      { name: 'Alice', email: 'alice@example.test' },
    ]);
    await fixture.whenStable();

    fixture.componentRef.setInput('fields', [
      { name: 'price', type: 'number' },
    ]);
    fixture.componentRef.setInput('data', [{ price: 129 }]);
    await fixture.whenStable();

    const headers = Array.from(
      fixture.nativeElement.querySelectorAll('th') as NodeListOf<HTMLElement>,
    ).map((header) => header.textContent?.trim());
    expect(headers).toEqual(['price']);
    const cells = Array.from(
      fixture.nativeElement.querySelectorAll(
        'tbody td',
      ) as NodeListOf<HTMLElement>,
    ).map((cell) => cell.textContent?.trim());
    expect(cells).toEqual(['129']);
  });
});
