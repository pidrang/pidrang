import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DataProvider, PidrangError, providePidrang } from '@pidrang/core';

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

async function setup(remove: (id: string) => Promise<unknown>) {
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
});
