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
});
