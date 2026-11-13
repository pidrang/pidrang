import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Field, Sorter } from '@pidrang/core';

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

  it('puts the table in a focusable region named Resource table', async () => {
    TestBed.configureTestingModule({ imports: [ResourceTable] });

    const fixture = TestBed.createComponent(ResourceTable);
    fixture.componentRef.setInput('fields', [{ name: 'name', type: 'text' }]);
    fixture.componentRef.setInput('data', [{ name: 'Alice' }]);
    await fixture.whenStable();

    const table: HTMLTableElement | null =
      fixture.nativeElement.querySelector('table');
    if (table === null) {
      throw new Error('the resource table is not rendered');
    }
    const container = table.parentElement;
    expect(container?.tagName).toBe('DIV');
    expect(container?.className).toBe('overflow-x-auto');
    expect(container?.getAttribute('role')).toBe('region');
    expect(container?.getAttribute('tabindex')).toBe('0');
    expect(container?.getAttribute('aria-label')).toBe('Resource table');
  });

  it('keeps a long field value on one line, at the top of the row, with the full value in the title', async () => {
    TestBed.configureTestingModule({ imports: [ResourceTable] });

    const longText = 'A long value '.repeat(40).trim();
    const fixture = TestBed.createComponent(ResourceTable);
    fixture.componentRef.setInput('fields', [{ name: 'body', type: 'text' }]);
    fixture.componentRef.setInput('data', [{ body: longText }]);
    await fixture.whenStable();

    const cell = fixture.nativeElement.querySelector('tbody td') as HTMLElement;
    expect(cell.getAttribute('title')).toBe(longText);
    expect(cell.className).toContain('align-top');

    const text = cell.querySelector('span');
    if (text === null) {
      throw new Error('the cell has no text wrapper');
    }
    expect(text.textContent?.trim()).toBe(longText);
    expect(text.className).toContain('block');
    expect(text.className).toContain('max-w-[12rem]');
    expect(text.className).toContain('truncate');
  });

  it('keeps the projected actions on one line', async () => {
    @Component({
      imports: [ResourceTable],
      template: `
        <pidrang-tailwind-resource-table [fields]="fields" [data]="data">
          <ng-template #actions let-row>
            <span class="flex gap-3">
              <a href="/">Show</a>
              <a href="/">Edit</a>
              <button type="button">Delete {{ row.name }}</button>
            </span>
          </ng-template>
        </pidrang-tailwind-resource-table>
      `,
    })
    class HostWithNowrapActions {
      protected readonly fields = [{ name: 'name', type: 'text' as const }];
      protected readonly data = [{ name: 'Alice' }];
    }

    TestBed.configureTestingModule({ imports: [HostWithNowrapActions] });

    const fixture = TestBed.createComponent(HostWithNowrapActions);
    await fixture.whenStable();

    const actionsCell = fixture.nativeElement.querySelector(
      'tbody tr td:last-child',
    ) as HTMLElement;
    expect(actionsCell.className).toContain('whitespace-nowrap');
  });

  describe('sorting', () => {
    @Component({
      imports: [ResourceTable],
      template: `
        <pidrang-tailwind-resource-table
          [fields]="fields"
          [data]="data"
          [sort]="sort()"
          (sortChange)="onSort($event)"
        >
          <ng-template #actions let-row>
            <button type="button">Delete {{ row.name }}</button>
          </ng-template>
        </pidrang-tailwind-resource-table>
      `,
    })
    class HostWithSort {
      readonly sort = signal<Sorter | null>(null);
      readonly sortEvents: (Sorter | null)[] = [];
      protected readonly fields: Field[] = [
        { name: 'name', type: 'text' },
        { name: 'price', type: 'number' },
        { name: 'notes', type: 'text', sortable: false },
      ];
      protected readonly data = [{ name: 'Alice', price: 10, notes: 'a' }];

      onSort(event: Sorter | null): void {
        this.sortEvents.push(event);
        this.sort.set(event);
      }
    }

    function headerOf(
      fixture: ComponentFixture<HostWithSort>,
      label: string,
    ): HTMLElement {
      const headers = fixture.nativeElement.querySelectorAll(
        'th',
      ) as NodeListOf<HTMLElement>;
      const header = Array.from(headers).find((candidate) =>
        candidate.textContent?.trim().startsWith(label),
      );
      if (header === undefined) {
        throw new Error(`no header named ${label}`);
      }
      return header;
    }

    function sortButtonOf(header: HTMLElement): HTMLButtonElement {
      const button = header.querySelector('button');
      if (button === null) {
        throw new Error('the header has no sort button');
      }
      return button;
    }

    async function setUpHost(): Promise<ComponentFixture<HostWithSort>> {
      TestBed.configureTestingModule({ imports: [HostWithSort] });
      const fixture = TestBed.createComponent(HostWithSort);
      await fixture.whenStable();
      return fixture;
    }

    it('renders no sort header and no aria-sort when the caller does not bind sort', async () => {
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
      class HostWithoutSort {
        protected readonly fields: Field[] = [
          { name: 'name', type: 'text' },
          { name: 'price', type: 'number' },
        ];
        protected readonly data = [{ name: 'Alice', price: 10 }];
      }

      TestBed.configureTestingModule({ imports: [HostWithoutSort] });
      const fixture = TestBed.createComponent(HostWithoutSort);
      await fixture.whenStable();

      const headers = Array.from(
        fixture.nativeElement.querySelectorAll('th') as NodeListOf<HTMLElement>,
      );
      expect(headers.map((header) => header.textContent?.trim())).toEqual([
        'name',
        'price',
        'Actions',
      ]);
      for (const header of headers) {
        expect(header.hasAttribute('aria-sort')).toBe(false);
        expect(header.querySelector('button')).toBeNull();
      }
    });

    it('shows aria-sort none on sortable headers before any click, and no aria-sort on a non-sortable or Actions header', async () => {
      const fixture = await setUpHost();

      expect(headerOf(fixture, 'name').getAttribute('aria-sort')).toBe('none');
      expect(headerOf(fixture, 'price').getAttribute('aria-sort')).toBe('none');
      expect(headerOf(fixture, 'notes').hasAttribute('aria-sort')).toBe(false);
      expect(headerOf(fixture, 'Actions').hasAttribute('aria-sort')).toBe(
        false,
      );
    });

    it('cycles ascending, descending, then the default order on three clicks', async () => {
      const fixture = await setUpHost();
      const button = sortButtonOf(headerOf(fixture, 'price'));

      button.click();
      await fixture.whenStable();
      expect(headerOf(fixture, 'price').getAttribute('aria-sort')).toBe(
        'ascending',
      );

      button.click();
      await fixture.whenStable();
      expect(headerOf(fixture, 'price').getAttribute('aria-sort')).toBe(
        'descending',
      );

      button.click();
      await fixture.whenStable();
      expect(headerOf(fixture, 'price').getAttribute('aria-sort')).toBe('none');

      expect(fixture.componentInstance.sortEvents).toEqual([
        { field: 'price', order: 'asc' },
        { field: 'price', order: 'desc' },
        null,
      ]);
    });

    it('starts ascending on another column after a sort on price', async () => {
      const fixture = await setUpHost();

      sortButtonOf(headerOf(fixture, 'price')).click();
      await fixture.whenStable();
      sortButtonOf(headerOf(fixture, 'name')).click();
      await fixture.whenStable();

      const events = fixture.componentInstance.sortEvents;
      expect(events[events.length - 1]).toEqual({
        field: 'name',
        order: 'asc',
      });
    });

    it('renders the sort header as a native button, so Enter and Space sort without extra code', async () => {
      const fixture = await setUpHost();
      const button = sortButtonOf(headerOf(fixture, 'price'));

      expect(button.tagName).toBe('BUTTON');
      expect(button.type).toBe('button');
    });

    it('renders no sort button on a non-sortable header, and a click on it emits nothing', async () => {
      const fixture = await setUpHost();
      const header = headerOf(fixture, 'notes');

      expect(header.querySelector('button')).toBeNull();
      header.click();
      await fixture.whenStable();

      expect(fixture.componentInstance.sortEvents).toEqual([]);
    });

    it('shows descending on the header of the sort set by the host, without a click', async () => {
      const fixture = await setUpHost();
      fixture.componentInstance.sort.set({ field: 'price', order: 'desc' });
      await fixture.whenStable();

      expect(headerOf(fixture, 'price').getAttribute('aria-sort')).toBe(
        'descending',
      );
    });

    it('shows a neutral arrow hidden from assistive technology on a sortable column that is not sorted', async () => {
      const fixture = await setUpHost();
      const arrow = sortButtonOf(headerOf(fixture, 'price')).querySelector(
        'span',
      );

      expect(arrow?.textContent?.trim()).toBe('⇅');
      expect(arrow?.getAttribute('aria-hidden')).toBe('true');

      fixture.componentInstance.sort.set({ field: 'name', order: 'asc' });
      await fixture.whenStable();
      expect(
        sortButtonOf(headerOf(fixture, 'price'))
          .querySelector('span')
          ?.textContent?.trim(),
      ).toBe('⇅');
    });

    it('shows an up arrow on the ascending column and a down arrow on the descending one, hidden from assistive technology', async () => {
      const fixture = await setUpHost();
      const button = sortButtonOf(headerOf(fixture, 'price'));

      button.click();
      await fixture.whenStable();
      const ascendingArrow = sortButtonOf(
        headerOf(fixture, 'price'),
      ).querySelector('span');
      expect(sortButtonOf(headerOf(fixture, 'price')).textContent).toContain(
        '↑',
      );
      expect(ascendingArrow?.getAttribute('aria-hidden')).toBe('true');

      sortButtonOf(headerOf(fixture, 'price')).click();
      await fixture.whenStable();
      expect(sortButtonOf(headerOf(fixture, 'price')).textContent).toContain(
        '↓',
      );
    });
  });
});
