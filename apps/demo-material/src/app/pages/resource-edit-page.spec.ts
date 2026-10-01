import { ErrorHandler, Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  Router,
  provideRouter,
  withComponentInputBinding,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { DataProvider, PidrangError, providePidrang } from '@pidrang/core';
import { provideSignInPath } from '@pidrang/demo-shared';

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

function setup(
  update: (call: UpdateCall) => Promise<unknown>,
  providers: Provider[] = [],
  read: (id: string, count: number) => Promise<unknown> | undefined = () =>
    undefined,
) {
  const updates: UpdateCall[] = [];
  const reads: string[] = [];
  const dataProvider: DataProvider = {
    getList: () => Promise.reject(new Error('unused')),
    getOne: <T>(_resource: string, params: { id: string | number }) => {
      const id = String(params.id);
      reads.push(id);
      const count = reads.filter((read) => read === id).length;
      return (read(id, count) ??
        Promise.resolve({ id: params.id, name: `Record ${id}` })) as Promise<T>;
    },
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
      ...providers,
    ],
  });
  const navigate = vi
    .spyOn(TestBed.inject(Router), 'navigate')
    .mockResolvedValue(true);
  const fixture = TestBed.createComponent(ResourceEditPage);
  fixture.componentRef.setInput('resource', 'products');
  fixture.componentRef.setInput('id', '1');
  return { fixture, updates, reads, navigate };
}

function nameInput(element: HTMLElement): HTMLInputElement {
  const input = element.querySelector('input');
  if (!input) {
    throw new Error('name input not rendered');
  }
  return input;
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

describe('ResourceEditPage', () => {
  it('writes once when save is clicked twice rapidly', async () => {
    const write = deferred<unknown>();
    const { fixture, updates } = setup(() => write.promise);
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    saveButton(fixture.nativeElement).click();
    write.resolve({});
    await settle(fixture);

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
    await settle(fixture);

    const input = nameInput(fixture.nativeElement);
    input.value = 'Edited';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    await settle(fixture);

    expect(
      fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
    ).toContain('network down');
    expect(nameInput(fixture.nativeElement).value).toBe('Edited');
    expect(navigate).not.toHaveBeenCalled();

    saveButton(fixture.nativeElement).click();
    await settle(fixture);

    expect(updates.map((call) => call.data)).toEqual([
      { name: 'Edited' },
      { name: 'Edited' },
    ]);
    expect(navigate).toHaveBeenCalledWith(['/', 'products', '1']);
  });

  it('neither redirects nor writes to the new record when the route changes mid-save', async () => {
    const write = deferred<unknown>();
    const { fixture, updates, navigate } = setup(() => write.promise);
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('id', '2');
    write.resolve({});
    await settle(fixture);

    expect(updates.map((call) => call.id)).toEqual(['1']);
    expect(navigate).not.toHaveBeenCalled();
    expect(nameInput(fixture.nativeElement).value).toBe('Record 2');
  });

  it('clears a save error when navigating to another record', async () => {
    const { fixture } = setup(() => Promise.reject(new Error('denied')));
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    await settle(fixture);
    expect(
      fixture.nativeElement.querySelector('[role="alert"]'),
    ).not.toBeNull();

    fixture.componentRef.setInput('id', '2');
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('lets the next record save while the previous save is in flight', async () => {
    const write = deferred<unknown>();
    const { fixture, updates } = setup(() => write.promise);
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('id', '2');
    await settle(fixture);

    expect(saveButton(fixture.nativeElement).disabled).toBe(false);
    saveButton(fixture.nativeElement).click();
    expect(updates.map((call) => call.id)).toEqual(['1', '2']);

    write.resolve({});
    await settle(fixture);
  });

  it.each([
    ['as plain text without a sign-in path', [], null],
    [
      'as a link to the sign-in path the app provides',
      [provideSignInPath('/auth/sign-in')],
      '/auth/sign-in',
    ],
  ] as const)(
    'asks to sign in after an earlier save failed for lack of a session, %s',
    async (_label, providers, href) => {
      const write = deferred<unknown>();
      const { fixture } = setup(() => write.promise, [...providers]);
      await settle(fixture);

      saveButton(fixture.nativeElement).click();
      fixture.componentRef.setInput('id', '2');
      await settle(fixture);
      fixture.componentRef.setInput('id', '1');
      await settle(fixture);
      write.reject(
        new PidrangError('JWT expired', { category: 'unauthenticated' }),
      );
      await settle(fixture);

      const link = [...fixture.nativeElement.querySelectorAll('a')].find(
        (candidate: Element) => candidate.textContent?.includes('sign in'),
      );
      expect(fixture.nativeElement.textContent).toContain('sign in');
      expect(link?.getAttribute('href') ?? null).toBe(href);
    },
  );

  it('tells the user that the earlier save failed after coming back', async () => {
    const write = deferred<unknown>();
    const { fixture } = setup(() => write.promise);
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('id', '2');
    await settle(fixture);
    fixture.componentRef.setInput('id', '1');
    await settle(fixture);

    write.reject(new Error('denied'));
    await settle(fixture);

    expect(
      fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
    ).toContain('The earlier save failed: denied');
    expect(saveButton(fixture.nativeElement).disabled).toBe(false);
  });

  it('does not redirect when a stale save succeeds after leaving and coming back', async () => {
    const write = deferred<unknown>();
    const { fixture, navigate } = setup(() => write.promise);
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('id', '2');
    await settle(fixture);
    fixture.componentRef.setInput('id', '1');
    await settle(fixture);

    write.resolve({});
    await settle(fixture);

    expect(navigate).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('[role="status"]')?.textContent,
    ).toContain('The earlier save finished');
  });

  it('keeps the newer save locked when the previous record save settles first', async () => {
    const writes: Deferred<unknown>[] = [];
    const { fixture, updates, navigate } = setup(() => {
      const write = deferred<unknown>();
      writes.push(write);
      return write.promise;
    });
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('id', '2');
    await settle(fixture);
    saveButton(fixture.nativeElement).click();

    writes[0].reject(new Error('denied'));
    await settle(fixture);

    expect(saveButton(fixture.nativeElement).disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    saveButton(fixture.nativeElement).click();
    expect(updates.map((call) => call.id)).toEqual(['1', '2']);
    expect(navigate).not.toHaveBeenCalled();

    writes[1].resolve({});
    await settle(fixture);

    expect(navigate).toHaveBeenCalledWith(['/', 'products', '2']);
  });

  it('replaces the form while an earlier visit saves the record, then reads it again once saved', async () => {
    const write = deferred<unknown>();
    const { fixture, updates, reads } = setup(() => write.promise);
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('id', '2');
    await settle(fixture);
    fixture.componentRef.setInput('id', '1');
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[role="status"]')?.textContent,
    ).toContain('being saved');
    const readsBeforeSaving = reads.length;

    write.resolve({});
    await settle(fixture);

    expect(reads.slice(readsBeforeSaving)).toEqual(['1']);
    expect(saveButton(fixture.nativeElement).disabled).toBe(false);
    expect(updates).toHaveLength(1);
  });

  it('reads the record again when the earlier save finishes while the record is still loading', async () => {
    const write = deferred<unknown>();
    const pendingRead = deferred<unknown>();
    const { fixture, reads } = setup(
      () => write.promise,
      [],
      (id, count) =>
        id === '1' && count === 2 ? pendingRead.promise : undefined,
    );
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('id', '2');
    await settle(fixture);
    fixture.componentRef.setInput('id', '1');
    await new Promise((resolve) => setTimeout(resolve));
    expect(reads[reads.length - 1]).toBe('1');
    const readsBeforeSaving = reads.length;

    write.resolve({});
    await settle(fixture);

    expect(reads.slice(readsBeforeSaving)).toEqual(['1']);
    expect(nameInput(fixture.nativeElement).value).toBe('Record 1');
  });

  it('does not read the record again after its own save', async () => {
    const { fixture, reads } = setup(() => Promise.resolve({}));
    await settle(fixture);
    const readsBeforeSaving = reads.length;

    saveButton(fixture.nativeElement).click();
    await settle(fixture);

    expect(reads.length).toBe(readsBeforeSaving);
    expect(nameInput(fixture.nativeElement)).toBeTruthy();
  });

  it('keeps what was loaded and reads nothing again when the earlier save fails', async () => {
    const write = deferred<unknown>();
    const { fixture, reads } = setup(() => write.promise);
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('id', '2');
    await settle(fixture);
    fixture.componentRef.setInput('id', '1');
    await settle(fixture);
    const readsBeforeFailing = reads.length;

    write.reject(new Error('denied'));
    await settle(fixture);

    expect(reads.length).toBe(readsBeforeFailing);
    expect(saveButton(fixture.nativeElement).disabled).toBe(false);
  });

  it('replaces the form in a new page for a record whose save is still running', async () => {
    const write = deferred<unknown>();
    const { fixture, updates } = setup(() => write.promise);
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    fixture.destroy();
    const next = TestBed.createComponent(ResourceEditPage);
    next.componentRef.setInput('resource', 'products');
    next.componentRef.setInput('id', '1');
    await settle(next);

    expect(next.nativeElement.querySelector('form')).toBeNull();

    write.resolve({});
    await settle(next);

    expect(saveButton(next.nativeElement).disabled).toBe(false);
    expect(updates).toHaveLength(1);
  });

  it('says the record was saved when the next page cannot open, and reports the error', async () => {
    const handleError = vi.fn();
    const { fixture, navigate } = setup(
      () => Promise.resolve({}),
      [{ provide: ErrorHandler, useValue: { handleError } }],
    );
    const failure = new Error('chunk failed to load');
    navigate.mockRejectedValue(failure);
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    await settle(fixture);
    await vi.waitFor(() => expect(handleError).toHaveBeenCalled());

    expect(
      fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
    ).toContain('Saved, but the next page could not open');
    expect(handleError).toHaveBeenCalledWith(failure);
  });

  it('says the server did not answer after 30 seconds and keeps the form disabled until it does', async () => {
    const { fixture, updates, navigate } = setup(
      () => new Promise(() => undefined),
    );
    await settle(fixture);

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    saveButton(fixture.nativeElement).click();
    await vi.advanceTimersByTimeAsync(30_000);
    vi.useRealTimers();
    await settle(fixture);

    expect(
      fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
    ).toContain('No answer from the server after 30 seconds');
    expect(saveButton(fixture.nativeElement).disabled).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    expect(updates).toHaveLength(1);
  });

  it('keeps the form disabled after a timeout when the user leaves and comes back', async () => {
    const { fixture } = setup(() => new Promise(() => undefined));
    await settle(fixture);

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    saveButton(fixture.nativeElement).click();
    await vi.advanceTimersByTimeAsync(30_000);
    vi.useRealTimers();
    fixture.componentRef.setInput('id', '2');
    await settle(fixture);
    fixture.componentRef.setInput('id', '1');
    await settle(fixture);

    expect(
      fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
    ).toContain('No answer from the server after 30 seconds');
    expect(saveButton(fixture.nativeElement).disabled).toBe(true);
  });

  it('keeps what the user typed when a timed-out save fails late', async () => {
    const late = deferred<unknown>();
    const { fixture } = setup(() => late.promise);
    await settle(fixture);
    const input = nameInput(fixture.nativeElement);
    input.value = 'Draft';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    saveButton(fixture.nativeElement).click();
    await vi.advanceTimersByTimeAsync(30_000);
    vi.useRealTimers();
    await settle(fixture);
    late.reject(new Error('denied late'));
    await settle(fixture);

    expect(nameInput(fixture.nativeElement).value).toBe('Draft');
    expect(
      fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
    ).toContain('The earlier save failed: denied late');
    expect(saveButton(fixture.nativeElement).disabled).toBe(false);
  });

  it('says the record was saved when a guard cancels the next page', async () => {
    const { fixture, navigate } = setup(() => Promise.resolve({}));
    navigate.mockResolvedValue(false);
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    await settle(fixture);

    expect(
      fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
    ).toContain('Saved, but the next page could not open');
  });

  it('asks the user to sign in when the earlier save failed for lack of a session', async () => {
    const write = deferred<unknown>();
    const { fixture } = setup(() => write.promise);
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('id', '2');
    await settle(fixture);
    fixture.componentRef.setInput('id', '1');
    await settle(fixture);

    write.reject(
      new PidrangError('JWT expired', { category: 'unauthenticated' }),
    );
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain(
      'The earlier save failed: JWT expired',
    );
    expect(fixture.nativeElement.textContent.replace(/\s+/g, ' ')).toContain(
      'You may need to sign in',
    );
  });

  it('clears the earlier-save message when the user saves again', async () => {
    const writes: Deferred<unknown>[] = [];
    const { fixture } = setup(() => {
      const write = deferred<unknown>();
      writes.push(write);
      return write.promise;
    });
    await settle(fixture);

    saveButton(fixture.nativeElement).click();
    fixture.componentRef.setInput('id', '2');
    await settle(fixture);
    fixture.componentRef.setInput('id', '1');
    await settle(fixture);
    writes[0].resolve({});
    await settle(fixture);
    expect(fixture.nativeElement.textContent).toContain(
      'The earlier save finished',
    );

    saveButton(fixture.nativeElement).click();
    writes[1].reject(new Error('denied'));
    await settle(fixture);

    expect(fixture.nativeElement.textContent).not.toContain(
      'The earlier save finished',
    );
    expect(fixture.nativeElement.textContent).toContain('denied');
  });

  it('releases the record when the provider throws instead of rejecting', async () => {
    let attempts = 0;
    const { fixture, updates } = setup(() => {
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
    expect(updates).toHaveLength(2);
  });

  it('shows the sign-in prompt as plain text when the app provides no sign-in path', async () => {
    const { fixture } = setup(() =>
      Promise.reject(
        new PidrangError('JWT expired', { category: 'unauthenticated' }),
      ),
    );
    await fixture.whenStable();

    saveButton(fixture.nativeElement).click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('sign in');
    expect(
      [...fixture.nativeElement.querySelectorAll('a')].some((link: Element) =>
        link.textContent?.includes('sign in'),
      ),
    ).toBe(false);
  });

  it('links the sign-in prompt to the sign-in path the app provides', async () => {
    const { fixture } = setup(
      () =>
        Promise.reject(
          new PidrangError('JWT expired', { category: 'unauthenticated' }),
        ),
      [provideSignInPath('/auth/sign-in')],
    );
    await fixture.whenStable();

    saveButton(fixture.nativeElement).click();
    await fixture.whenStable();

    const link = [...fixture.nativeElement.querySelectorAll('a')].find(
      (candidate: Element) => candidate.textContent?.includes('sign in'),
    );
    expect(link?.getAttribute('href')).toBe('/auth/sign-in');
  });
});

describe('ResourceEditPage sign-in link inside a route', () => {
  it('resolves a relative sign-in path from the app root, not from the current page', async () => {
    const dataProvider: DataProvider = {
      getList: () => Promise.reject(new Error('unused')),
      getOne: <T>(_resource: string, params: { id: string | number }) =>
        Promise.resolve({ id: params.id, name: 'Keyboard' } as T),
      create: () => Promise.reject(new Error('unused')),
      update: () =>
        Promise.reject(
          new PidrangError('JWT expired', { category: 'unauthenticated' }),
        ),
      delete: () => Promise.reject(new Error('unused')),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: ':resource/:id/edit', component: ResourceEditPage }],
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
    await harness.navigateByUrl('/products/1/edit', ResourceEditPage);
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();

    const page = harness.routeNativeElement as HTMLElement;
    saveButton(page).click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    const link = [...page.querySelectorAll('a')].find((candidate) =>
      candidate.textContent?.includes('sign in'),
    );
    expect(link?.getAttribute('href')).toBe('/auth/sign-in');
  });
});
