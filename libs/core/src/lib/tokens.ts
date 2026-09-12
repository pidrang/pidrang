import { InjectionToken } from '@angular/core';

import { DataProvider } from './data-provider';
import { Resource } from './resource';

export const DATA_PROVIDER = new InjectionToken<DataProvider>('pidrang.data-provider');

export const RESOURCES = new InjectionToken<Resource[]>('pidrang.resources');
