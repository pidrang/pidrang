import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import {
  AuthIdentity,
  AuthProvider,
  DataProvider,
  providePidrang,
} from '@pidrang/core';

import { DEMO_ACCOUNT, DemoAccount } from '@pidrang/demo-shared';
import { SignInPage } from './sign-in-page';

const dataProvider: DataProvider = {
  getList: () => Promise.resolve({ data: [], total: 0 }),
  getOne: <T>() => Promise.resolve({} as T),
  create: <T>() => Promise.resolve({} as T),
  update: <T>() => Promise.resolve({} as T),
  delete: <T>() => Promise.resolve({} as T),
};

const account: DemoAccount = {
  email: 'demo@example.test',
  password: 'shared-demo-password',
};

let logout: AuthProvider['logout'] = () => Promise.resolve();

function authProvider(login: AuthProvider['login']): AuthProvider {
  return {
    login,
    logout: () => logout(),
    getIdentity: () => Promise.resolve(identity),
    onSessionChange: (listener) => {
      sessionChanged = listener;
      return () => undefined;
    },
  };
}

let sessionChanged: () => void = () => undefined;
let identity: AuthIdentity | null = null;

function configure(
  login: AuthProvider['login'],
  demoAccount: DemoAccount | null,
  signedIn: AuthIdentity | null = null,
): void {
  identity = signedIn;
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      providePidrang({
        dataProvider,
        resources: [],
        authProvider: authProvider(login),
      }),
      { provide: DEMO_ACCOUNT, useValue: demoAccount },
    ],
  });
}

const signedIn: AuthIdentity = { id: '1', email: 'writer@example.test' };

function demoButton(element: HTMLElement): HTMLButtonElement | undefined {
  return Array.from(element.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Sign in as the demo account'),
  );
}

describe('SignInPage demo account', () => {
  it('shows no demo account when none is configured', async () => {
    configure(() => Promise.resolve(), null);

    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();

    expect(demoButton(fixture.nativeElement)).toBeUndefined();
    expect(fixture.nativeElement.textContent).not.toContain('Demo account');
  });

  it('shows the shared credentials when a demo account is configured', async () => {
    configure(() => Promise.resolve(), account);

    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain(account.email);
    expect(text).toContain(account.password);
    expect(demoButton(fixture.nativeElement)).toBeDefined();
  });

  it('signs in with the demo credentials and goes home', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    configure(login, account);
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);

    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();
    demoButton(fixture.nativeElement)?.click();
    await fixture.whenStable();

    expect(login).toHaveBeenCalledWith({
      email: account.email,
      password: account.password,
    });
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('shows the error when the demo sign-in fails', async () => {
    configure(
      () => Promise.reject(new Error('Invalid login credentials')),
      account,
    );
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();
    demoButton(fixture.nativeElement)?.click();
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
    ).toContain('Invalid login credentials');
  });
});

function fill(element: HTMLElement, email: string, password: string): void {
  const [emailInput, passwordInput] = Array.from(
    element.querySelectorAll<HTMLInputElement>('form input'),
  );
  emailInput.value = email;
  emailInput.dispatchEvent(new Event('input'));
  passwordInput.value = password;
  passwordInput.dispatchEvent(new Event('input'));
}

function form(element: HTMLElement): HTMLFormElement {
  const found = element.querySelector('form');
  if (!found) {
    throw new Error('no sign-in form');
  }
  return found;
}

function submitButton(element: HTMLElement): HTMLButtonElement | null {
  return element.querySelector<HTMLButtonElement>('form button[type="submit"]');
}

function pending(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (reason: unknown) => void;
} {
  let resolve: () => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('SignInPage form', () => {
  it('signs in when its form is submitted, through a submit button inside the form', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    configure(login, null);
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();

    expect(submitButton(fixture.nativeElement)?.textContent).toContain(
      'Sign in',
    );
    fill(fixture.nativeElement, 'writer@example.test', 'secret');
    form(fixture.nativeElement).requestSubmit();
    await fixture.whenStable();

    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith({
      email: 'writer@example.test',
      password: 'secret',
    });
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('sends one sign-in while one is running, with both buttons disabled', async () => {
    const running = pending();
    const login = vi.fn().mockReturnValue(running.promise);
    configure(login, account);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();

    fill(fixture.nativeElement, 'writer@example.test', 'secret');
    form(fixture.nativeElement).requestSubmit();
    fixture.detectChanges();
    form(fixture.nativeElement).requestSubmit();
    demoButton(fixture.nativeElement)?.click();
    fixture.detectChanges();

    expect(login).toHaveBeenCalledTimes(1);
    expect(submitButton(fixture.nativeElement)?.disabled).toBe(true);
    expect(demoButton(fixture.nativeElement)?.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Signing in…');
    expect(fixture.nativeElement.querySelector('form input')?.value).toBe(
      'writer@example.test',
    );

    running.resolve();
    await fixture.whenStable();
  });

  it('stays on the page after a rejected sign-in and clears the error on the next try', async () => {
    const second = pending();
    const login = vi
      .fn()
      .mockRejectedValueOnce(new Error('Invalid login credentials'))
      .mockReturnValueOnce(second.promise);
    configure(login, null);
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();

    fill(fixture.nativeElement, 'writer@example.test', 'wrong');
    form(fixture.nativeElement).requestSubmit();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Invalid login credentials',
    );
    expect(navigate).not.toHaveBeenCalled();

    form(fixture.nativeElement).requestSubmit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(
      'Invalid login credentials',
    );

    second.resolve();
    await fixture.whenStable();
  });

  it('does not navigate when the page was left before the sign-in finished', async () => {
    const running = pending();
    const login = vi.fn().mockReturnValue(running.promise);
    configure(login, null);
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();

    fill(fixture.nativeElement, 'writer@example.test', 'secret');
    form(fixture.nativeElement).requestSubmit();
    expect(login).toHaveBeenCalledTimes(1);
    fixture.destroy();
    running.resolve();
    await new Promise((resolve) => setTimeout(resolve));

    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('SignInPage across visits', () => {
  it('keeps sign-in disabled on a new visit while an earlier sign-in runs', async () => {
    const first = pending();
    const login = vi.fn().mockReturnValue(first.promise);
    configure(login, account);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();
    fill(fixture.nativeElement, 'alice@example.test', 'secret');
    form(fixture.nativeElement).requestSubmit();
    fixture.destroy();

    const next = TestBed.createComponent(SignInPage);
    await next.whenStable();
    next.detectChanges();
    fill(next.nativeElement, 'bob@example.test', 'secret');
    form(next.nativeElement).requestSubmit();
    demoButton(next.nativeElement)?.click();
    next.detectChanges();

    expect(login).toHaveBeenCalledTimes(1);
    expect(submitButton(next.nativeElement)?.disabled).toBe(true);
    expect(next.nativeElement.textContent).toContain('Signing in…');

    first.resolve();
    await new Promise((resolve) => setTimeout(resolve));
    next.detectChanges();
    expect(submitButton(next.nativeElement)?.disabled).toBe(false);
  });
});

describe('SignInPage success across visits', () => {
  it('goes home when the sign-in finishes after the page was left and opened again', async () => {
    const running = pending();
    const login = vi.fn().mockReturnValue(running.promise);
    configure(login, null);
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();
    fill(fixture.nativeElement, 'writer@example.test', 'secret');
    form(fixture.nativeElement).requestSubmit();
    fixture.destroy();

    const next = TestBed.createComponent(SignInPage);
    await next.whenStable();
    running.resolve();
    await new Promise((resolve) => setTimeout(resolve));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('does not navigate when the page was opened again and left before the sign-in finished', async () => {
    const running = pending();
    const login = vi.fn().mockReturnValue(running.promise);
    configure(login, null);
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();
    fill(fixture.nativeElement, 'writer@example.test', 'secret');
    form(fixture.nativeElement).requestSubmit();
    fixture.destroy();

    const next = TestBed.createComponent(SignInPage);
    await next.whenStable();
    next.destroy();
    running.resolve();
    await new Promise((resolve) => setTimeout(resolve));

    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('SignInPage stalled sign-in', () => {
  afterEach(() => vi.useRealTimers());

  it('says to reload after 30 seconds without an answer, on every visit, and keeps sign-in disabled', async () => {
    const first = pending();
    const login = vi.fn().mockReturnValue(first.promise);
    configure(login, null);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();
    fill(fixture.nativeElement, 'writer@example.test', 'secret');

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    form(fixture.nativeElement).requestSubmit();
    await vi.advanceTimersByTimeAsync(30_000);
    vi.useRealTimers();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'No answer from the server after 30 seconds. Reload the page',
    );
    expect(submitButton(fixture.nativeElement)?.disabled).toBe(true);
    fixture.destroy();

    const next = TestBed.createComponent(SignInPage);
    next.detectChanges();
    expect(next.nativeElement.textContent).toContain('Reload the page');

    first.resolve();
    await new Promise((resolve) => setTimeout(resolve));
    next.detectChanges();
    expect(next.nativeElement.textContent).not.toContain('Reload the page');
    expect(submitButton(next.nativeElement)?.disabled).toBe(false);
  });
});

describe('SignInPage failure across visits', () => {
  it('shows a failure to the visit waiting on it, and not on a later visit', async () => {
    const first = pending();
    configure(() => first.promise, null);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();
    fill(fixture.nativeElement, 'writer@example.test', 'wrong');
    form(fixture.nativeElement).requestSubmit();
    fixture.destroy();

    const waiting = TestBed.createComponent(SignInPage);
    waiting.detectChanges();
    first.reject(new Error('Invalid login credentials'));
    await new Promise((resolve) => setTimeout(resolve));
    waiting.detectChanges();
    expect(waiting.nativeElement.textContent).toContain(
      'Invalid login credentials',
    );
    waiting.destroy();

    const later = TestBed.createComponent(SignInPage);
    later.detectChanges();
    expect(later.nativeElement.textContent).not.toContain(
      'Invalid login credentials',
    );
  });
});

describe('SignInPage failure with no visit open', () => {
  it('drops a failure that arrives while no sign-in page is open', async () => {
    const first = pending();
    configure(() => first.promise, null);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();
    fill(fixture.nativeElement, 'alice@example.test', 'wrong');
    form(fixture.nativeElement).requestSubmit();
    fixture.destroy();

    first.reject(new Error('Invalid login credentials'));
    await new Promise((resolve) => setTimeout(resolve));

    const later = TestBed.createComponent(SignInPage);
    later.detectChanges();
    expect(later.nativeElement.textContent).not.toContain(
      'Invalid login credentials',
    );
    expect(submitButton(later.nativeElement)?.disabled).toBe(false);
  });
});

describe('SignInPage failure and session changes', () => {
  it('clears a shown failure and drops a late one once the session changes', async () => {
    const first = pending();
    const login = vi
      .fn()
      .mockRejectedValueOnce(new Error('Invalid login credentials'))
      .mockReturnValueOnce(first.promise);
    configure(login, null);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();
    fill(fixture.nativeElement, 'alice@example.test', 'wrong');

    form(fixture.nativeElement).requestSubmit();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Invalid login credentials',
    );
    sessionChanged();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(
      'Invalid login credentials',
    );

    form(fixture.nativeElement).requestSubmit();
    sessionChanged();
    first.reject(new Error('Invalid login credentials'));
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(
      'Invalid login credentials',
    );
  });
});

function signOutButton(element: HTMLElement): HTMLButtonElement | undefined {
  return Array.from(element.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === 'Sign out',
  );
}

describe('SignInPage sign-out', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    logout = () => Promise.resolve();
    sessionChanged = () => undefined;
  });

  it('shows no sign-out when no one is signed in', async () => {
    configure(() => Promise.resolve(), null);

    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();

    expect(signOutButton(fixture.nativeElement)).toBeUndefined();
    expect(fixture.nativeElement.textContent).not.toContain('Signed in as');
  });

  it('says who is signed in and signs out through the provider', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    logout = signOut;
    configure(() => Promise.resolve(), null, signedIn);
    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Signed in as');
    expect(fixture.nativeElement.textContent).toContain(signedIn.email);

    signOutButton(fixture.nativeElement)?.click();
    await fixture.whenStable();

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('disables Sign out while a sign-in runs', async () => {
    const running = pending();
    configure(() => running.promise, null, signedIn);
    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(signOutButton(fixture.nativeElement)?.disabled).toBe(false);

    fill(fixture.nativeElement, 'writer@example.test', 'secret');
    form(fixture.nativeElement).requestSubmit();
    fixture.detectChanges();

    expect(signOutButton(fixture.nativeElement)?.disabled).toBe(true);

    running.resolve();
    await fixture.whenStable();
  });
});
