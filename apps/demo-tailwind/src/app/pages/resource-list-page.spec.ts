import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { DataProvider, PidrangError, providePidrang } from '@pidrang/core';
import { provideSignInPath } from '@pidrang/demo-shared';

import { ResourceListPage } from './resource-list-page';

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

const ROWS = [
  { id: '1', name: 'Keyboard' },
  { id: '2', name: 'Mouse' },
];

async function setup(
  remove: (id: string) => Promise<unknown>,
  providers: Provider[] = [],
) {
  const deletes: string[] = [];
  let lists = 0;
  const dataProvider: DataProvider = {
    getList: <T>() => {
      lists += 1;
      return Promise.resolve({ data: ROWS as T[], total: ROWS.length });
    },
    getOne: () => Promise.reject(new Error('unused')),
    create: () => Promise.reject(new Error('unused')),
    update: () => Promise.reject(new Error('unused')),
    delete: <T>(_resource: string, params: { id: string | number }) => {
      deletes.push(String(params.id));
      return remove(String(params.id)) as Promise<T>;
    },
  };
  TestBed.configureTestingModule({
    imports: [ResourceListPage],
    providers: [
      provideRouter([]),
      ...providers,
      providePidrang({
        dataProvider,
        resources: [
          { name: 'products', fields: [{ name: 'name', type: 'text' }] },
          { name: 'orders', fields: [{ name: 'name', type: 'text' }] },
        ],
      }),
    ],
  });
  const fixture = TestBed.createComponent(ResourceListPage);
  fixture.componentRef.setInput('resource', 'products');
  await settle(fixture);
  return { fixture, deletes, listCalls: () => lists };
}

async function settle(
  fixture: ReturnType<typeof TestBed.createComponent<ResourceListPage>>,
): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function deleteButtons(element: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    element.querySelectorAll<HTMLButtonElement>('button'),
  ).filter((button) => /Delet/.test(button.textContent ?? ''));
}

function pageSizeDisabled(element: HTMLElement): boolean {
  const native = element.querySelector('select');
  if (native) {
    return native.disabled;
  }
  return (
    element.querySelector('mat-select')?.getAttribute('aria-disabled') ===
    'true'
  );
}

function alertText(element: HTMLElement): string {
  return element.querySelector('[role="alert"]')?.textContent ?? '';
}

describe('ResourceListPage delete', () => {
  afterEach(() => vi.restoreAllMocks());

  it('asks for confirmation naming the record and makes no call when cancelled', async () => {
    const { fixture, deletes } = await setup(() => Promise.resolve({}));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    deleteButtons(fixture.nativeElement)[0].click();
    await settle(fixture);

    expect(confirm).toHaveBeenCalledWith('Delete Keyboard from products?');
    expect(deletes).toEqual([]);
  });

  it('deletes once and reloads the list when confirmed', async () => {
    const { fixture, deletes, listCalls } = await setup(() =>
      Promise.resolve({}),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const before = listCalls();

    deleteButtons(fixture.nativeElement)[0].click();
    await settle(fixture);

    expect(deletes).toEqual(['1']);
    expect(listCalls()).toBe(before + 1);
    expect(alertText(fixture.nativeElement)).toBe('');
  });

  it('ignores repeated clicks while a delete is in flight', async () => {
    const pending = deferred<unknown>();
    const { fixture, deletes } = await setup(() => pending.promise);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    deleteButtons(fixture.nativeElement)[0].click();
    fixture.detectChanges();
    const buttons = deleteButtons(fixture.nativeElement);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(buttons[0].textContent).toContain('Deleting');
    await fixture.componentInstance['remove'](ROWS[1]);

    pending.resolve({});
    await settle(fixture);

    expect(deletes).toEqual(['1']);
  });

  it('keeps the row, offers sign-in and allows a retry on an unauthenticated failure', async () => {
    let attempt = 0;
    const { fixture, deletes } = await setup(() => {
      attempt += 1;
      return attempt === 1
        ? Promise.reject(
            new PidrangError('JWT expired', { category: 'unauthenticated' }),
          )
        : Promise.resolve({});
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    deleteButtons(fixture.nativeElement)[0].click();
    await settle(fixture);

    expect(alertText(fixture.nativeElement)).toContain('JWT expired');
    expect(alertText(fixture.nativeElement)).toContain('sign in');
    expect(fixture.nativeElement.textContent).toContain('Keyboard');
    expect(deleteButtons(fixture.nativeElement)[0].disabled).toBe(false);

    deleteButtons(fixture.nativeElement)[0].click();
    await settle(fixture);

    expect(deletes).toEqual(['1', '1']);
    expect(alertText(fixture.nativeElement)).toBe('');
  });

  it('says the user is not allowed on a forbidden failure, without a sign-in hint', async () => {
    const { fixture } = await setup(() =>
      Promise.reject(
        new PidrangError('permission denied for table products', {
          category: 'forbidden',
        }),
      ),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    deleteButtons(fixture.nativeElement)[0].click();
    await settle(fixture);

    expect(alertText(fixture.nativeElement)).toContain(
      'You are not allowed to delete this record.',
    );
    expect(alertText(fixture.nativeElement)).not.toContain('sign in');
  });

  it('shows a network failure as plain feedback', async () => {
    const { fixture } = await setup(() =>
      Promise.reject(new TypeError('Failed to fetch')),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    deleteButtons(fixture.nativeElement)[0].click();
    await settle(fixture);

    expect(alertText(fixture.nativeElement)).toContain('Failed to fetch');
    expect(alertText(fixture.nativeElement)).not.toContain('sign in');
    expect(alertText(fixture.nativeElement)).not.toContain('not allowed');
  });

  it('re-enables delete buttons after switching to another resource', async () => {
    const pending = deferred<unknown>();
    const { fixture } = await setup(() => pending.promise);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    deleteButtons(fixture.nativeElement)[0].click();
    fixture.detectChanges();
    expect(
      deleteButtons(fixture.nativeElement).every((button) => button.disabled),
    ).toBe(true);

    fixture.componentRef.setInput('resource', 'orders');
    await settle(fixture);

    expect(
      deleteButtons(fixture.nativeElement).every((button) => !button.disabled),
    ).toBe(true);

    pending.resolve({});
    await settle(fixture);
  });

  it('keeps a newer delete locked when a stale one settles after a round trip', async () => {
    const calls: Deferred<unknown>[] = [];
    const { fixture, deletes } = await setup(() => {
      const call = deferred<unknown>();
      calls.push(call);
      return call.promise;
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    deleteButtons(fixture.nativeElement)[0].click();
    fixture.componentRef.setInput('resource', 'orders');
    await settle(fixture);
    fixture.componentRef.setInput('resource', 'products');
    await settle(fixture);
    deleteButtons(fixture.nativeElement)[0].click();
    fixture.detectChanges();

    calls[0].resolve({});
    await settle(fixture);

    expect(
      deleteButtons(fixture.nativeElement).every((button) => button.disabled),
    ).toBe(true);
    await fixture.componentInstance['remove'](ROWS[1]);
    expect(deletes).toEqual(['1', '1']);

    calls[1].resolve({});
    await settle(fixture);
    await settle(fixture);

    expect(
      deleteButtons(fixture.nativeElement).every((button) => !button.disabled),
    ).toBe(true);
  });

  it('does not show a stale failure after leaving and coming back to the resource', async () => {
    const pending = deferred<unknown>();
    const { fixture } = await setup(() => pending.promise);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    deleteButtons(fixture.nativeElement)[0].click();
    fixture.componentRef.setInput('resource', 'orders');
    await settle(fixture);
    fixture.componentRef.setInput('resource', 'products');
    await settle(fixture);

    pending.reject(
      new PidrangError('permission denied for table products', {
        category: 'forbidden',
      }),
    );
    await settle(fixture);

    expect(alertText(fixture.nativeElement)).toBe('');
  });

  it('locks pagination while a delete is in flight', async () => {
    const pending = deferred<unknown>();
    const { fixture } = await setup(() => pending.promise);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(pageSizeDisabled(fixture.nativeElement)).toBe(false);

    deleteButtons(fixture.nativeElement)[0].click();
    fixture.detectChanges();
    expect(pageSizeDisabled(fixture.nativeElement)).toBe(true);

    pending.resolve({});
    await settle(fixture);
    await settle(fixture);
    expect(pageSizeDisabled(fixture.nativeElement)).toBe(false);
  });
  it('shows the sign-in prompt as plain text when the app provides no sign-in path', async () => {
    const { fixture } = await setup(() =>
      Promise.reject(
        new PidrangError('JWT expired', { category: 'unauthenticated' }),
      ),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    deleteButtons(fixture.nativeElement)[0].click();
    await settle(fixture);

    expect(alertText(fixture.nativeElement)).toContain('sign in');
    expect(fixture.nativeElement.querySelector('[role="alert"] a')).toBeNull();
  });

  it('links the sign-in prompt to the sign-in path the app provides', async () => {
    const { fixture } = await setup(
      () =>
        Promise.reject(
          new PidrangError('JWT expired', { category: 'unauthenticated' }),
        ),
      [provideSignInPath('/auth/sign-in')],
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    deleteButtons(fixture.nativeElement)[0].click();
    await settle(fixture);

    expect(
      fixture.nativeElement
        .querySelector('[role="alert"] a')
        ?.getAttribute('href'),
    ).toBe('/auth/sign-in');
  });
});

describe('ResourceListPage delete consistency', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the database state after two deletes whose refreshes overlap', async () => {
    let rows = [...ROWS];
    let holdLists = false;
    const listGates: Deferred<void>[] = [];
    const deleteCalls = new Map<string, Deferred<void>>();
    const dataProvider: DataProvider = {
      getList: <T>() => {
        const snapshot = { data: [...rows] as T[], total: rows.length };
        if (!holdLists) {
          return Promise.resolve(snapshot);
        }
        const gate = deferred<void>();
        listGates.push(gate);
        return gate.promise.then(() => snapshot);
      },
      getOne: () => Promise.reject(new Error('unused')),
      create: () => Promise.reject(new Error('unused')),
      update: () => Promise.reject(new Error('unused')),
      delete: <T>(_resource: string, params: { id: string | number }) => {
        const id = String(params.id);
        const call = deferred<void>();
        deleteCalls.set(id, call);
        return call.promise.then(() => {
          rows = rows.filter((row) => row.id !== id);
          return {} as T;
        });
      },
    };
    TestBed.configureTestingModule({
      imports: [ResourceListPage],
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
    const fixture = TestBed.createComponent(ResourceListPage);
    fixture.componentRef.setInput('resource', 'products');
    await settle(fixture);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    deleteButtons(fixture.nativeElement)[0].click();
    fixture.componentRef.setInput('resource', 'orders');
    await settle(fixture);
    fixture.componentRef.setInput('resource', 'products');
    await settle(fixture);
    deleteButtons(fixture.nativeElement)[1].click();
    fixture.detectChanges();

    holdLists = true;
    deleteCalls.get('1')?.resolve();
    await flush(fixture);
    deleteCalls.get('2')?.resolve();
    await flush(fixture);
    holdLists = false;
    for (const gate of listGates) {
      gate.resolve();
      await flush(fixture);
    }
    await settle(fixture);

    expect(rows).toEqual([]);
    expect(fixture.nativeElement.textContent).not.toContain('Mouse');
    expect(fixture.nativeElement.textContent).toContain('No records yet.');
  });
});

async function flush(
  fixture: ReturnType<typeof TestBed.createComponent<ResourceListPage>>,
): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
    TestBed.tick();
  }
  fixture.detectChanges();
}

describe('ResourceListPage sign-in link inside a route', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolves a relative sign-in path from the app root, not from the current page', async () => {
    const dataProvider: DataProvider = {
      getList: <T>() =>
        Promise.resolve({ data: ROWS as T[], total: ROWS.length }),
      getOne: () => Promise.reject(new Error('unused')),
      create: () => Promise.reject(new Error('unused')),
      update: () => Promise.reject(new Error('unused')),
      delete: () =>
        Promise.reject(
          new PidrangError('JWT expired', { category: 'unauthenticated' }),
        ),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: ':resource', component: ResourceListPage }],
          withComponentInputBinding(),
        ),
        providePidrang({
          dataProvider,
          resources: [
            { name: 'products', fields: [{ name: 'name', type: 'text' }] },
          ],
        }),
        provideSignInPath('auth/sign-in'),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/products', ResourceListPage);
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const page = harness.routeNativeElement as HTMLElement;
    deleteButtons(page)[0].click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(page.querySelector('[role="alert"] a')?.getAttribute('href')).toBe(
      '/auth/sign-in',
    );
  });
});
