import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DataProvider, providePidrang } from '@pidrang/core';

import { ResourceShowPage } from './resource-show-page';

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

function setup(getOne: (id: string) => Promise<unknown>) {
  const dataProvider: DataProvider = {
    getList: () => Promise.reject(new Error('unused')),
    getOne: <T>(_resource: string, params: { id: string | number }) =>
      getOne(String(params.id)) as Promise<T>,
    create: () => Promise.reject(new Error('unused')),
    update: () => Promise.reject(new Error('unused')),
    delete: () => Promise.reject(new Error('unused')),
  };
  TestBed.configureTestingModule({
    imports: [ResourceShowPage],
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
  const fixture = TestBed.createComponent(ResourceShowPage);
  fixture.componentRef.setInput('resource', 'products');
  return fixture;
}

function text(element: HTMLElement): string {
  return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('ResourceShowPage', () => {
  it('shows only the latest record when fetches resolve in reverse order', async () => {
    const pending = new Map<string, Deferred<unknown>>();
    const fixture = setup((id) => {
      const request = deferred<unknown>();
      pending.set(id, request);
      return request.promise;
    });

    fixture.componentRef.setInput('id', '1');
    fixture.detectChanges();
    fixture.componentRef.setInput('id', '2');
    fixture.detectChanges();

    pending.get('2')?.resolve({ id: '2', name: 'Second' });
    await fixture.whenStable();
    pending.get('1')?.resolve({ id: '1', name: 'First' });
    await fixture.whenStable();

    expect(text(fixture.nativeElement)).toContain('Second');
    expect(text(fixture.nativeElement)).not.toContain('First');
  });

  it('does not let a previous error hide the next record', async () => {
    const fixture = setup((id) =>
      id === '1'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve({ id: '2', name: 'Second' }),
    );

    fixture.componentRef.setInput('id', '1');
    await fixture.whenStable();
    expect(text(fixture.nativeElement)).toContain('boom');

    fixture.componentRef.setInput('id', '2');
    await fixture.whenStable();

    expect(text(fixture.nativeElement)).not.toContain('boom');
    expect(text(fixture.nativeElement)).toContain('Second');
  });

  it('retries a failed fetch', async () => {
    let attempts = 0;
    const fixture = setup(() => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new Error('network down'))
        : Promise.resolve({ id: '1', name: 'First' });
    });

    fixture.componentRef.setInput('id', '1');
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]'),
    ).not.toBeNull();

    const retry = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) => text(button) === 'Retry');
    retry?.click();
    await fixture.whenStable();

    expect(attempts).toBe(2);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(text(fixture.nativeElement)).toContain('First');
  });
});
