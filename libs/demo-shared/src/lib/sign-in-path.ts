import { InjectionToken } from '@angular/core';
import { UrlTree } from '@angular/router';

export const SIGN_IN_PATH = new InjectionToken<UrlTree | null>(
  'pidrang.sign-in-path',
  { factory: () => null },
);
