import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { DataProvider, providePidrang } from '@pidrang/core';

import { ResourceCreatePage } from './resource-create-page';

function setup(create: () => Promise<unknown>) {
  const creates: unknown[] = [];
  const dataProvider: DataProvider = {
    getList: () => Promise.reject(new Error('unused')),
    getOne: () => Promise.reject(new Error('unused')),
    create: <T>(_resource: string, params: { data: unknown }) => {
      creates.push(params.data);
      return create() as Promise<T>;
    },
    update: () => Promise.reject(new Error('unused')),
    delete: () => Promise.reject(new Error('unused')),
  };
  TestBed.configureTestingModule({
    imports: [ResourceCreatePage],
    providers: [
      provideRouter([]),
      providePidrang({
        dataProvider,
        resources: [
          { name: 'products', fields: [{ name: 'name', type: 'text' }] },
          { name: 'orders', fields: [{ name: 'name', type: 'text' }] },
        ],
      }),
    ],
  });
  const navigate = vi
    .spyOn(TestBed.inject(Router), 'navigate')
    .mockResolvedValue(true);
  const fixture = TestBed.createComponent(ResourceCreatePage);
  fixture.componentRef.setInput('resource', 'products');
  return { fixture, creates, navigate };
}

function saveButton(element: HTMLElement): HTMLButtonElement {
  const button = element.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );
  if (!button) {
    throw new Error('save button not rendered');
  }
  return button;
}

describe('ResourceCreatePage', () => {
  it('creates once when save is clicked twice rapidly', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const { fixture, creates, navigate } = setup(
      () => new Promise((resolve) => (finish = resolve)),
    );
    await fixture.whenStable();

    saveButton(fixture.nativeElement).click();
    saveButton(fixture.nativeElement).click();
    finish({});
    await fixture.whenStable();

    expect(creates).toHaveLength(1);
    expect(navigate).toHaveBeenCalledWith(['/', 'products']);
  });

  it('keeps the draft after a failed save and allows a retry', async () => {
    let attempts = 0;
    const { fixture, creates } = setup(() => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new Error('network down'))
        : Promise.resolve({});
    });
    await fixture.whenStable();

    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input');
    input.value = 'Draft';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    saveButton(fixture.nativeElement).click();
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]'),
    ).not.toBeNull();
    expect(input.value).toBe('Draft');

    saveButton(fixture.nativeElement).click();
    await fixture.whenStable();

    expect(creates).toEqual([{ name: 'Draft' }, { name: 'Draft' }]);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('lets another resource save while the previous save is in flight', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const { fixture, creates } = setup(
      () => new Promise((resolve) => (finish = resolve)),
    );
    await fixture.whenStable();

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('resource', 'orders');
    await fixture.whenStable();

    expect(saveButton(fixture.nativeElement).disabled).toBe(false);
    saveButton(fixture.nativeElement).click();
    expect(creates).toHaveLength(2);

    finish({});
    await fixture.whenStable();
  });

  it('does not redirect when a stale create succeeds after leaving and coming back', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const { fixture, navigate } = setup(
      () => new Promise((resolve) => (finish = resolve)),
    );
    await fixture.whenStable();

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('resource', 'orders');
    await fixture.whenStable();
    fixture.componentRef.setInput('resource', 'products');
    await fixture.whenStable();

    finish({ id: 'new' });
    await fixture.whenStable();

    expect(navigate).not.toHaveBeenCalled();
    expect(saveButton(fixture.nativeElement).disabled).toBe(false);
  });

  it('keeps the newer create locked when the previous resource create settles first', async () => {
    const finishes: ((value: unknown) => void)[] = [];
    const { fixture, creates, navigate } = setup(
      () => new Promise((resolve) => finishes.push(resolve)),
    );
    await fixture.whenStable();

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('resource', 'orders');
    await fixture.whenStable();
    saveButton(fixture.nativeElement).click();

    finishes[0]({});
    await fixture.whenStable();

    expect(saveButton(fixture.nativeElement).disabled).toBe(true);
    saveButton(fixture.nativeElement).click();
    expect(creates).toHaveLength(2);
    expect(navigate).not.toHaveBeenCalled();

    finishes[1]({});
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/', 'orders']);
  });
});
