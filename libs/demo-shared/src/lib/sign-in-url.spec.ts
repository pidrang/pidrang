import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { provideSignInPath } from './provide-sign-in-path';
import { injectSignInUrl } from './sign-in-url';

function signInUrl(path: string | null): string | null {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      ...(path === null ? [] : [provideSignInPath(path)]),
    ],
  });
  const url = TestBed.runInInjectionContext(() => injectSignInUrl());
  return url === null ? null : TestBed.inject(Router).serializeUrl(url);
}

describe('injectSignInUrl', () => {
  it('returns null when the app provides no sign-in path', () => {
    expect(signInUrl(null)).toBeNull();
  });

  it.each([
    ['/login', '/login'],
    ['login', '/login'],
    ['/auth?mode=signin', '/auth?mode=signin'],
  ])('resolves %s from the app root as %s', (path, expected) => {
    expect(signInUrl(path)).toBe(expected);
  });
});

describe('provideSignInPath', () => {
  it.each([
    'https://auth.example.com/sign-in',
    '//auth.example.com/sign-in',
    'javascript:alert(1)',
    '',
    '   ',
    '/%',
    ' /login',
    '/login ',
    './sign-in',
    '../sign-in',
    '/auth/../sign-in',
    '/%2e%2e/sign-in',
    '/auth/%2E/sign-in',
  ])('refuses %j as soon as it is called, before the app starts', (path) => {
    expect(() => provideSignInPath(path)).toThrow('SIGN_IN_PATH must be');
  });

  it.each([
    '/your-sign-in-route',
    'your-sign-in-route',
    '/your-sign-in-route/',
  ])('refuses the placeholder pidrang init prints, written as %j', (path) => {
    expect(() => provideSignInPath(path)).toThrow('replace the placeholder');
  });

  it.each([undefined, 42, null])(
    'refuses %j from a plain JavaScript caller with a clear message',
    (path) => {
      expect(() => provideSignInPath(path as never)).toThrow(
        'SIGN_IN_PATH must be a string',
      );
    },
  );
});
