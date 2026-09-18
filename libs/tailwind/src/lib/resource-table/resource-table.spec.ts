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

  it('renders a projected actions template as the last cell of each row', async () => {
    @Component({
      imports: [ResourceTable],
      template: `
        <lib-resource-table [fields]="fields" [data]="data">
          <ng-template #actions let-row>
            <button type="button">Delete {{ row.name }}</button>
          </ng-template>
        </lib-resource-table>
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
});
