import { InjectionToken } from '@angular/core';

import { AuthProvider } from './auth-provider';
import { DataProvider } from './data-provider';
import { Resource } from './resource';

export const DATA_PROVIDER = new InjectionToken<DataProvider>('pidrang.data-provider');

export const RESOURCES = new InjectionToken<Resource[]>('pidrang.resources');

export const AUTH_PROVIDER = new InjectionToken<AuthProvider>('pidrang.auth-provider');
