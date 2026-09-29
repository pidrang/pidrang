import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthProvider, DataProvider, providePidrang } from '@pidrang/core';

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

function authProvider(login: AuthProvider['login']): AuthProvider {
  return {
    login,
    logout: () => Promise.resolve(),
    getIdentity: () => Promise.resolve(null),
  };
}

function configure(
  login: AuthProvider['login'],
  demoAccount: DemoAccount | null,
): void {
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

    expect(fixture.nativeElement.textContent).toContain(
      'Invalid login credentials',
    );
  });
});
