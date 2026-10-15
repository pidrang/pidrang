import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Field } from '@pidrang/core';
import {
  ResourceForm as MaterialResourceForm,
  ResourceTable as MaterialResourceTable,
} from '@pidrang/material';
import {
  ResourceForm as TailwindResourceForm,
  ResourceTable as TailwindResourceTable,
} from '@pidrang/tailwind';

@Component({
  imports: [
    MaterialResourceForm,
    MaterialResourceTable,
    TailwindResourceForm,
    TailwindResourceTable,
  ],
  template: `
    <pidrang-material-resource-table [fields]="fields" [data]="data" />
    <pidrang-tailwind-resource-table [fields]="fields" [data]="data" />
    <pidrang-material-resource-form
      mode="create"
      [fields]="fields"
      [value]="value"
    />
    <pidrang-tailwind-resource-form
      mode="create"
      [fields]="fields"
      [value]="value"
    />
  `,
})
class BothAdapters {
  protected readonly fields: Field[] = [{ name: 'name', type: 'text' }];
  protected readonly data = [{ id: '1', name: 'Alice' }];
  protected readonly value = { name: '' };
}

function element(root: HTMLElement, selector: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(selector);
  if (!found) {
    throw new Error(`${selector} is not rendered`);
  }
  return found;
}

describe('Material and Tailwind adapters in one component', () => {
  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({ imports: [BothAdapters] });
    const fixture = TestBed.createComponent(BothAdapters);
    await fixture.whenStable();
    return fixture.nativeElement;
  }

  it('renders each table with its own adapter', async () => {
    const root = await render();

    const material = element(root, 'pidrang-material-resource-table');
    const tailwind = element(root, 'pidrang-tailwind-resource-table');

    expect(material.querySelector('table.mat-mdc-table')).not.toBeNull();
    expect(material.textContent).toContain('Alice');
    expect(tailwind.querySelector('table.mat-mdc-table')).toBeNull();
    expect(tailwind.querySelector('table.border-collapse')).not.toBeNull();
    expect(tailwind.textContent).toContain('Alice');
  });

  it('renders each form with its own adapter', async () => {
    const root = await render();

    const material = element(root, 'pidrang-material-resource-form');
    const tailwind = element(root, 'pidrang-tailwind-resource-form');

    expect(material.querySelector('mat-form-field input')).not.toBeNull();
    expect(tailwind.querySelector('mat-form-field')).toBeNull();
    expect(tailwind.querySelector('input')).not.toBeNull();
  });
});
