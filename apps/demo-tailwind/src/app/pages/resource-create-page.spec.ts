import { ErrorHandler, Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { DataProvider, providePidrang } from '@pidrang/core';

import { ResourceCreatePage } from './resource-create-page';

function setup(create: () => Promise<unknown>, providers: Provider[] = []) {
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
      ...providers,
    ],
  });
  const navigate = vi
    .spyOn(TestBed.inject(Router), 'navigate')
    .mockResolvedValue(true);
  const fixture = TestBed.createComponent(ResourceCreatePage);
  fixture.componentRef.setInput('resource', 'products');
  return { fixture, creates, navigate };
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
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
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    saveButton(fixture.nativeElement).click();
    finish({});
    await settle(fixture);

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
    await settle(fixture);

    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input');
    input.value = 'Draft';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    await settle(fixture);
    expect(
      fixture.nativeElement.querySelector('[role="alert"]'),
    ).not.toBeNull();
    expect(input.value).toBe('Draft');

    saveButton(fixture.nativeElement).click();
    await settle(fixture);

    expect(creates).toEqual([{ name: 'Draft' }, { name: 'Draft' }]);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('lets another resource save while the previous save is in flight', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const { fixture, creates } = setup(
      () => new Promise((resolve) => (finish = resolve)),
    );
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('resource', 'orders');
    await settle(fixture);

    expect(saveButton(fixture.nativeElement).disabled).toBe(false);
    saveButton(fixture.nativeElement).click();
    expect(creates).toHaveLength(2);

    finish({});
    await settle(fixture);
  });

  it('does not redirect when a stale create succeeds after leaving and coming back', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const { fixture, navigate } = setup(
      () => new Promise((resolve) => (finish = resolve)),
    );
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('resource', 'orders');
    await settle(fixture);
    fixture.componentRef.setInput('resource', 'products');
    await settle(fixture);

    finish({ id: 'new' });
    await settle(fixture);

    expect(navigate).not.toHaveBeenCalled();
    expect(saveButton(fixture.nativeElement).disabled).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[role="status"]')?.textContent,
    ).toContain('The earlier create finished');
  });

  it('tells the user that the earlier create failed after coming back', async () => {
    let fail: (reason: unknown) => void = () => undefined;
    const { fixture } = setup(
      () => new Promise((_resolve, reject) => (fail = reject)),
    );
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('resource', 'orders');
    await settle(fixture);
    fixture.componentRef.setInput('resource', 'products');
    await settle(fixture);

    fail(new Error('denied'));
    await settle(fixture);

    expect(
      fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
    ).toContain('The earlier create failed: denied');
  });

  it('keeps the newer create locked when the previous resource create settles first', async () => {
    const finishes: ((value: unknown) => void)[] = [];
    const { fixture, creates, navigate } = setup(
      () => new Promise((resolve) => finishes.push(resolve)),
    );
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('resource', 'orders');
    await settle(fixture);
    saveButton(fixture.nativeElement).click();

    finishes[0]({});
    await settle(fixture);

    expect(saveButton(fixture.nativeElement).disabled).toBe(true);
    saveButton(fixture.nativeElement).click();
    expect(creates).toHaveLength(2);
    expect(navigate).not.toHaveBeenCalled();

    finishes[1]({});
    await settle(fixture);

    expect(navigate).toHaveBeenCalledWith(['/', 'orders']);
  });

  it('replaces the form while an earlier visit creates on the resource', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const { fixture, creates } = setup(
      () => new Promise((resolve) => (finish = resolve)),
    );
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('resource', 'orders');
    await settle(fixture);
    fixture.componentRef.setInput('resource', 'products');
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[role="status"]')?.textContent,
    ).toContain('still running');

    finish({});
    await settle(fixture);

    expect(saveButton(fixture.nativeElement).disabled).toBe(false);
    expect(creates).toHaveLength(1);
  });

  it('replaces the form in a new page for a resource whose create is still running', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const { fixture, creates } = setup(
      () => new Promise((resolve) => (finish = resolve)),
    );
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    fixture.destroy();
    const next = TestBed.createComponent(ResourceCreatePage);
    next.componentRef.setInput('resource', 'products');
    await settle(next);

    expect(next.nativeElement.querySelector('form')).toBeNull();

    finish({});
    await settle(next);

    expect(saveButton(next.nativeElement).disabled).toBe(false);
    expect(creates).toHaveLength(1);
  });

  it('says the row was created when the next page cannot open, and reports the error', async () => {
    const handleError = vi.fn();
    const { fixture, navigate } = setup(
      () => Promise.resolve({ id: 'new' }),
      [{ provide: ErrorHandler, useValue: { handleError } }],
    );
    const failure = new Error('chunk failed to load');
    navigate.mockRejectedValue(failure);
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    await settle(fixture);

    expect(
      fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
    ).toContain('Saved, but the next page could not open');
    expect(handleError).toHaveBeenCalledWith(failure);
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('says the row was created, and hides the draft, when a guard cancels the next page', async () => {
    const { fixture, navigate, creates } = setup(() =>
      Promise.resolve({ id: 'new' }),
    );
    navigate.mockResolvedValue(false);
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    await settle(fixture);

    expect(
      fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
    ).toContain('Saved, but the next page could not open');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(creates).toHaveLength(1);
  });

  it('treats a create that resolves with no row as saved', async () => {
    const { fixture, navigate } = setup(() => Promise.resolve(undefined));
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/', 'products']);
  });

  it('releases the resource when the provider throws instead of rejecting', async () => {
    let attempts = 0;
    const { fixture, creates } = setup(() => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('not a promise');
      }
      return Promise.resolve({});
    });
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    await settle(fixture);

    expect(
      fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
    ).toContain('not a promise');
    expect(saveButton(fixture.nativeElement).disabled).toBe(false);
    saveButton(fixture.nativeElement).click();
    expect(creates).toHaveLength(2);
  });
});
