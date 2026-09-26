import { InjectionToken } from '@angular/core';

export interface DemoAccount {
  email: string;
  password: string;
}

export const DEMO_ACCOUNT = new InjectionToken<DemoAccount | null>(
  'demo-account',
  { factory: () => null },
);
