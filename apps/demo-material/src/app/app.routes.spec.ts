import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  Router,
  provideRouter,
  withComponentInputBinding,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  DataProvider,
  Resource,
  ResourceAction,
  providePidrang,
} from '@pidrang/core';

import { appRoutes } from './app.routes';
import { NotFoundPage } from './pages/not-found-page';
import { ResourceCreatePage } from './pages/resource-create-page';
import { ResourceEditPage } from './pages/resource-edit-page';
import { ResourceListPage } from './pages/resource-list-page';

const ROUTED_ACTIONS: { action: ResourceAction; url: string }[] = [
  { action: 'list', url: '/products' },
  { action: 'create', url: '/products/create' },
  { action: 'show', url: '/products/1' },
  { action: 'edit', url: '/products/1/edit' },
];

const ALL_FALSE: Resource = {
  name: 'products',
  list: false,
  create: false,
  show: false,
  edit: false,
  delete: false,
};

function recordingDataProvider(calls: string[]): DataProvider {
  const record = { id: '1', name: 'Keyboard' };
  const one = <T>(method: string): Promise<T> => {
    calls.push(method);
    return Promise.resolve(record as unknown as T);
  };
  return {
    getList: <T>() => {
      calls.push('getList');
      return Promise.resolve({ data: [record as unknown as T], total: 1 });
    },
    getOne: <T>() => one<T>('getOne'),
    create: <T>() => one<T>('create'),
    update: <T>() => one<T>('update'),
    delete: <T>() => one<T>('delete'),
  };
}

async function setup(resource: Resource) {
  const calls: string[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideRouter(appRoutes, withComponentInputBinding()),
      providePidrang({
        dataProvider: recordingDataProvider(calls),
        resources: [resource],
      }),
    ],
  });
  const harness = await RouterTestingHarness.create();
  return { calls, harness };
}

async function settle(harness: RouterTestingHarness): Promise<void> {
  harness.detectChanges();
  await harness.fixture.whenStable();
  harness.detectChanges();
}

function hrefs(harness: RouterTestingHarness): (string | null)[] {
  return Array.from(
    harness.routeNativeElement?.querySelectorAll('a') ?? [],
  ).map((link) => link.getAttribute('href'));
}

describe('resource routes', () => {
  it.each(ROUTED_ACTIONS)(
    'refuses $url without provider calls when only $action is disabled',
    async ({ action, url }) => {
      const { calls, harness } = await setup({
        name: 'products',
        [action]: false,
      });

      await harness.navigateByUrl(url, NotFoundPage);

      expect(calls).toEqual([]);
    },
  );

  it.each(ROUTED_ACTIONS)(
    'refuses $url for an all-false resource',
    async ({ url }) => {
      const { calls, harness } = await setup(ALL_FALSE);

      await harness.navigateByUrl(url, NotFoundPage);

      expect(calls).toEqual([]);
    },
  );

  it.each(ROUTED_ACTIONS.map(({ url }) => url.replace('products', 'unknown')))(
    'refuses %s for an unregistered resource',
    async (url) => {
      const { calls, harness } = await setup({ name: 'products' });

      await harness.navigateByUrl(url, NotFoundPage);

      expect(calls).toEqual([]);
    },
  );

  it.each(ROUTED_ACTIONS)(
    'opens $url when flags are omitted',
    async ({ url }) => {
      const { harness } = await setup({ name: 'products' });

      await harness.navigateByUrl(url);

      expect(harness.routeNativeElement?.textContent).not.toContain(
        'Page not available',
      );
    },
  );

  it('keeps every link when flags are omitted', async () => {
    const { harness } = await setup({ name: 'products' });

    await harness.navigateByUrl('/products', ResourceListPage);
    await settle(harness);

    expect(hrefs(harness)).toEqual([
      '/products/create',
      '/products/1',
      '/products/1/edit',
    ]);
    expect(harness.routeNativeElement?.textContent).toContain('Delete');
  });

  it('hides delete and makes remove a no-op when delete is disabled', async () => {
    const { calls, harness } = await setup({ name: 'products', delete: false });

    const page = await harness.navigateByUrl('/products', ResourceListPage);
    await settle(harness);
    await page['remove']({ id: '1', name: 'Keyboard' });

    expect(harness.routeNativeElement?.textContent).not.toContain('Delete');
    expect(calls).not.toContain('delete');
  });

  it.each<[ResourceAction, string]>([
    ['create', '/products/create'],
    ['show', '/products/1'],
    ['edit', '/products/1/edit'],
  ])('never links to %s when it is disabled', async (action, href) => {
    const { harness } = await setup({ name: 'products', [action]: false });

    await harness.navigateByUrl('/products', ResourceListPage);
    await settle(harness);

    expect(hrefs(harness)).not.toContain(href);
  });

  it('makes create submit a no-op when create is disabled', async () => {
    const { calls } = await setup({ name: 'products', create: false });
    const fixture = TestBed.createComponent(ResourceCreatePage);
    fixture.componentRef.setInput('resource', 'products');

    await fixture.componentInstance['submit']({ name: 'Mouse' });

    expect(calls).toEqual([]);
  });

  it('makes edit submit a no-op when edit is disabled', async () => {
    const { calls } = await setup({ name: 'products', edit: false });
    const fixture = TestBed.createComponent(ResourceEditPage);
    fixture.componentRef.setInput('resource', 'products');
    fixture.componentRef.setInput('id', '1');

    await fixture.componentInstance['submit']({ name: 'Mouse' });

    expect(calls).not.toContain('update');
  });

  it('hides the back link and lands on show after create when list is disabled', async () => {
    const { calls, harness } = await setup({ name: 'products', list: false });

    const page = await harness.navigateByUrl(
      '/products/create',
      ResourceCreatePage,
    );
    await settle(harness);
    expect(hrefs(harness)).not.toContain('/products');

    await page['submit']({ name: 'Mouse' });

    expect(calls).toEqual(['create']);
    expect(TestBed.inject(Router).url).toBe('/products/1');
  });

  it('lands on the list after edit when show is disabled', async () => {
    const { harness } = await setup({ name: 'products', show: false });

    const page = await harness.navigateByUrl(
      '/products/1/edit',
      ResourceEditPage,
    );
    await settle(harness);
    expect(hrefs(harness)).toContain('/products');
    expect(hrefs(harness)).not.toContain('/products/1');

    await page['submit']({ name: 'Mouse' });

    expect(TestBed.inject(Router).url).toBe('/products');
  });
});

@Component({ selector: 'app-settings-stub', template: 'Settings' })
class SettingsStubPage {}

describe('resource routes next to app routes', () => {
  it('lets an app route declared after them match a one-segment path', async () => {
    const calls: string[] = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            ...appRoutes.slice(0, -1),
            { path: 'settings', component: SettingsStubPage },
            ...appRoutes.slice(-1),
          ],
          withComponentInputBinding(),
        ),
        providePidrang({
          dataProvider: recordingDataProvider(calls),
          resources: [{ name: 'products' }],
        }),
      ],
    });
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/settings', SettingsStubPage);

    expect(calls).toEqual([]);
  });
});
