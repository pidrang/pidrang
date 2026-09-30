import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { DataProvider, providePidrang } from '@pidrang/core';

import { ResourceEditPage } from './resource-edit-page';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface UpdateCall {
  id: string;
  data: unknown;
}

function setup(update: (call: UpdateCall) => Promise<unknown>) {
  const updates: UpdateCall[] = [];
  const dataProvider: DataProvider = {
    getList: () => Promise.reject(new Error('unused')),
    getOne: <T>(_resource: string, params: { id: string | number }) =>
      Promise.resolve({ id: params.id, name: `Record ${params.id}` } as T),
    create: () => Promise.reject(new Error('unused')),
    update: <T>(
      _resource: string,
      params: { id: string | number; data: unknown },
    ) => {
      const call = { id: String(params.id), data: params.data };
      updates.push(call);
      return update(call) as Promise<T>;
    },
    delete: () => Promise.reject(new Error('unused')),
  };
  TestBed.configureTestingModule({
    imports: [ResourceEditPage],
    providers: [
      provideRouter([]),
      providePidrang({
        dataProvider,
        resources: [
          { name: 'products', fields: [{ name: 'name', type: 'text' }] },
        ],
      }),
    ],
  });
  const navigate = vi
    .spyOn(TestBed.inject(Router), 'navigate')
    .mockResolvedValue(true);
  const fixture = TestBed.createComponent(ResourceEditPage);
  fixture.componentRef.setInput('resource', 'products');
  fixture.componentRef.setInput('id', '1');
  return { fixture, updates, navigate };
}

function nameInput(element: HTMLElement): HTMLInputElement {
  const input = element.querySelector('input');
  if (!input) {
    throw new Error('name input not rendered');
  }
  return input;
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

describe('ResourceEditPage', () => {
  it('writes once when save is clicked twice rapidly', async () => {
    const write = deferred<unknown>();
    const { fixture, updates } = setup(() => write.promise);
    await fixture.whenStable();

    saveButton(fixture.nativeElement).click();
    saveButton(fixture.nativeElement).click();
    write.resolve({});
    await fixture.whenStable();

    expect(updates).toHaveLength(1);
  });

  it('keeps the edits after a failed save and allows a retry', async () => {
    let attempts = 0;
    const { fixture, updates, navigate } = setup(() => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new Error('network down'))
        : Promise.resolve({});
    });
    await fixture.whenStable();

    const input = nameInput(fixture.nativeElement);
    input.value = 'Edited';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    saveButton(fixture.nativeElement).click();
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
    ).toContain('network down');
    expect(nameInput(fixture.nativeElement).value).toBe('Edited');
    expect(navigate).not.toHaveBeenCalled();

    saveButton(fixture.nativeElement).click();
    await fixture.whenStable();

    expect(updates.map((call) => call.data)).toEqual([
      { name: 'Edited' },
      { name: 'Edited' },
    ]);
    expect(navigate).toHaveBeenCalledWith(['/', 'products', '1']);
  });

  it('neither redirects nor writes to the new record when the route changes mid-save', async () => {
    const write = deferred<unknown>();
    const { fixture, updates, navigate } = setup(() => write.promise);
    await fixture.whenStable();

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('id', '2');
    write.resolve({});
    await fixture.whenStable();

    expect(updates.map((call) => call.id)).toEqual(['1']);
    expect(navigate).not.toHaveBeenCalled();
    expect(nameInput(fixture.nativeElement).value).toBe('Record 2');
  });

  it('clears a save error when navigating to another record', async () => {
    const { fixture } = setup(() => Promise.reject(new Error('denied')));
    await fixture.whenStable();

    saveButton(fixture.nativeElement).click();
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]'),
    ).not.toBeNull();

    fixture.componentRef.setInput('id', '2');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('lets the next record save while the previous save is in flight', async () => {
    const write = deferred<unknown>();
    const { fixture, updates } = setup(() => write.promise);
    await fixture.whenStable();

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('id', '2');
    await fixture.whenStable();

    expect(saveButton(fixture.nativeElement).disabled).toBe(false);
    saveButton(fixture.nativeElement).click();
    expect(updates.map((call) => call.id)).toEqual(['1', '2']);

    write.resolve({});
    await fixture.whenStable();
  });

  it('ignores a stale save failure after leaving and coming back to the record', async () => {
    const write = deferred<unknown>();
    const { fixture } = setup(() => write.promise);
    await fixture.whenStable();

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('id', '2');
    await fixture.whenStable();
    fixture.componentRef.setInput('id', '1');
    await fixture.whenStable();

    write.reject(new Error('denied'));
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(saveButton(fixture.nativeElement).disabled).toBe(false);
  });

  it('does not redirect when a stale save succeeds after leaving and coming back', async () => {
    const write = deferred<unknown>();
    const { fixture, navigate } = setup(() => write.promise);
    await fixture.whenStable();

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('id', '2');
    await fixture.whenStable();
    fixture.componentRef.setInput('id', '1');
    await fixture.whenStable();

    write.resolve({});
    await fixture.whenStable();

    expect(navigate).not.toHaveBeenCalled();
  });
});
