import { Component, Provider, ViewEncapsulation } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter } from '@angular/router';
import {
  AuthIdentity,
  AuthProvider,
  DataProvider,
  providePidrang,
} from '@pidrang/core';
import { canMatchSignedIn, provideSignInPath } from '@pidrang/demo-shared';

import { AppLayout } from './app-layout';

const noopDataProvider: DataProvider = {
  getList: <T>() =>
    Promise.resolve({ data: [], total: 0 } as { data: T[]; total: number }),
  getOne: <T>() => Promise.resolve({} as T),
  create: <T>() => Promise.resolve({} as T),
  update: <T>() => Promise.resolve({} as T),
  delete: <T>() => Promise.resolve({} as T),
};

const noopAuthProvider: AuthProvider = {
  login: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  getIdentity: () => Promise.resolve({ id: 'writer' }),
};

@Component({ template: '' })
class EmptyPage {}

@Component({
  imports: [AppLayout],
  template: '<app-layout appName="Demo" />',
  encapsulation: ViewEncapsulation.ShadowDom,
})
class ShadowHost {}

interface Width {
  matches: boolean;
}

function stubWidth(width: Width | null): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value:
      width === null
        ? undefined
        : (query: string) =>
            query === '(width < 48rem)'
              ? width
              : {
                  matches: false,
                  media: query,
                  addEventListener: () => undefined,
                  removeEventListener: () => undefined,
                },
  });
}

interface RenderOptions {
  routes?: Routes;
  authProvider?: AuthProvider | null;
  providers?: Provider[];
}

async function render(
  options: RenderOptions = {},
): Promise<ComponentFixture<AppLayout>> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(options.routes ?? [{ path: '**', component: EmptyPage }]),
      ...(options.providers ?? []),
      providePidrang({
        dataProvider: noopDataProvider,
        ...(options.authProvider === null
          ? {}
          : { authProvider: options.authProvider ?? noopAuthProvider }),
        resources: [
          { name: 'products', label: 'Products' },
          { name: 'notes', label: 'Notes', list: false },
        ],
      }),
    ],
  });
  const fixture = TestBed.createComponent(AppLayout);
  fixture.componentRef.setInput('appName', 'Demo');
  await fixture.whenStable();
  return fixture;
}

async function settle(fixture: ComponentFixture<AppLayout>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
}

function menuLinks(fixture: ComponentFixture<AppLayout>): string[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll('#app-menu a'),
    (anchor) => (anchor as HTMLElement).textContent?.trim() ?? '',
  );
}

function controlledAuth(initial: AuthIdentity | null): {
  provider: AuthProvider;
  setIdentity(identity: AuthIdentity | null): void;
} {
  let identity = initial;
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };
  return {
    provider: {
      login: () => Promise.resolve(),
      logout: () => {
        identity = null;
        notify();
        return Promise.resolve();
      },
      getIdentity: () => Promise.resolve(identity),
      onSessionChange: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    setIdentity: (next) => {
      identity = next;
      notify();
    },
  };
}

function menu(fixture: ComponentFixture<AppLayout>): HTMLElement | null {
  return fixture.nativeElement.querySelector('#app-menu');
}

function menuButton(fixture: ComponentFixture<AppLayout>): HTMLButtonElement {
  return fixture.nativeElement.querySelector('[aria-controls="app-menu"]');
}

async function clickMenuButton(
  fixture: ComponentFixture<AppLayout>,
): Promise<void> {
  menuButton(fixture).click();
  await fixture.whenStable();
}

async function clickLink(
  fixture: ComponentFixture<AppLayout>,
  name: string,
): Promise<void> {
  const link = Array.from(
    fixture.nativeElement.querySelectorAll('#app-menu a'),
  ).find((anchor) => (anchor as HTMLElement).textContent?.trim() === name);
  if (!(link instanceof HTMLElement)) {
    throw new Error(`No menu link named ${name}`);
  }
  link.click();
  await fixture.whenStable();
}

describe('AppLayout', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');

  afterEach(() => {
    if (original === undefined) {
      Reflect.deleteProperty(window, 'matchMedia');
    } else {
      Object.defineProperty(window, 'matchMedia', original);
    }
  });

  it('starts with the menu hidden on a narrow screen and opens it from the Menu button', async () => {
    stubWidth({ matches: true });
    const fixture = await render();

    expect(menu(fixture)).toBeNull();
    expect(menuButton(fixture).getAttribute('aria-expanded')).toBe('false');

    await clickMenuButton(fixture);

    expect(menu(fixture)).not.toBeNull();
    expect(menuButton(fixture).getAttribute('aria-expanded')).toBe('true');
  });

  for (const name of ['Home', 'Products', 'Create Notes']) {
    it(`closes the menu after the ${name} link on a narrow screen`, async () => {
      stubWidth({ matches: true });
      const fixture = await render();
      await clickMenuButton(fixture);

      await clickLink(fixture, name);

      expect(menu(fixture)).toBeNull();
    });
  }

  it('moves the focus back to the Menu button after a link closes the menu', async () => {
    stubWidth({ matches: true });
    const fixture = await render();
    await clickMenuButton(fixture);

    await clickLink(fixture, 'Products');

    expect(document.activeElement).toBe(menuButton(fixture));
  });

  it('closes the menu on a tap outside it on a narrow screen', async () => {
    stubWidth({ matches: true });
    const fixture = await render();
    await clickMenuButton(fixture);

    fixture.nativeElement.querySelector('main').click();
    await fixture.whenStable();

    expect(menu(fixture)).toBeNull();
  });

  it('keeps the menu open on a tap inside it, and the Menu button still closes it', async () => {
    stubWidth({ matches: true });
    const fixture = await render();
    await clickMenuButton(fixture);

    menu(fixture)?.click();
    await fixture.whenStable();

    expect(menu(fixture)).not.toBeNull();

    await clickMenuButton(fixture);

    expect(menu(fixture)).toBeNull();
  });

  it('opens the menu from the Menu button inside a shadow root', async () => {
    stubWidth({ matches: true });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: EmptyPage }]),
        providePidrang({
          dataProvider: noopDataProvider,
          authProvider: noopAuthProvider,
          resources: [{ name: 'products', label: 'Products' }],
        }),
      ],
    });
    const fixture = TestBed.createComponent(ShadowHost);
    await fixture.whenStable();
    const root = fixture.nativeElement.shadowRoot as ShadowRoot;
    const button = root.querySelector<HTMLButtonElement>(
      '[aria-controls="app-menu"]',
    );

    button?.click();
    await fixture.whenStable();

    expect(root.querySelector('#app-menu')).not.toBeNull();
  });

  it('keeps the menu open on a tap outside it on a wide screen', async () => {
    stubWidth({ matches: false });
    const fixture = await render();

    fixture.nativeElement.querySelector('main').click();
    await fixture.whenStable();

    expect(menu(fixture)).not.toBeNull();
  });

  it('keeps the menu open on load and after a link on a wide screen', async () => {
    stubWidth({ matches: false });
    const fixture = await render();

    expect(menu(fixture)).not.toBeNull();

    await clickLink(fixture, 'Products');

    expect(menu(fixture)).not.toBeNull();
  });

  it('closes after a link when the screen became narrow after load', async () => {
    const width = { matches: false };
    stubWidth(width);
    const fixture = await render();

    width.matches = true;
    await clickLink(fixture, 'Products');

    expect(menu(fixture)).toBeNull();
  });

  it('keeps the menu after a link when the screen became wide after load', async () => {
    const width = { matches: true };
    stubWidth(width);
    const fixture = await render();
    await clickMenuButton(fixture);

    width.matches = false;
    await clickLink(fixture, 'Products');

    expect(menu(fixture)).not.toBeNull();
  });

  it('starts with the menu open when the browser has no matchMedia', async () => {
    stubWidth(null);
    const fixture = await render();

    expect(menu(fixture)).not.toBeNull();
  });
});

function signOutButton(fixture: ComponentFixture<AppLayout>): HTMLElement {
  const button = Array.from(
    fixture.nativeElement.querySelectorAll('button'),
  ).find(
    (candidate) =>
      (candidate as HTMLElement).textContent?.trim() === 'Sign out',
  );
  if (!(button instanceof HTMLElement)) {
    throw new Error('No Sign out button');
  }
  return button;
}

describe('AppLayout and the session', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');

  afterEach(() => {
    if (original === undefined) {
      Reflect.deleteProperty(window, 'matchMedia');
    } else {
      Object.defineProperty(window, 'matchMedia', original);
    }
  });

  it('hides the guarded resources from the menu until someone signs in', async () => {
    stubWidth({ matches: false });
    const auth = controlledAuth(null);
    const fixture = await render({
      authProvider: auth.provider,
      routes: [
        {
          path: 'products',
          canMatch: [canMatchSignedIn(['products'])],
          component: EmptyPage,
        },
        { path: '**', component: EmptyPage },
      ],
    });
    await settle(fixture);

    expect(menuLinks(fixture)).toEqual(['Home']);

    auth.setIdentity({ id: 'writer' });
    await settle(fixture);

    expect(menuLinks(fixture)).toEqual(['Home', 'Products', 'Create Notes']);
  });

  it('keeps the readable resources in the menu when nothing is guarded', async () => {
    stubWidth({ matches: false });
    const fixture = await render({
      authProvider: controlledAuth(null).provider,
    });
    await settle(fixture);

    expect(menuLinks(fixture)).toEqual(['Home', 'Products']);
  });

  it('shows the whole menu and no sign-in controls without an auth provider', async () => {
    stubWidth({ matches: false });
    const fixture = await render({
      authProvider: null,
      providers: [provideSignInPath('sign-in')],
    });
    await settle(fixture);

    expect(menuLinks(fixture)).toEqual(['Home', 'Products', 'Create Notes']);
    const texts = Array.from(
      fixture.nativeElement.querySelectorAll('a, button'),
      (element) => (element as HTMLElement).textContent?.trim() ?? '',
    );
    expect(texts).not.toContain('Sign in');
    expect(texts).not.toContain('Sign out');
  });

  it('opens the sign-in page after a sign-out on a create page', async () => {
    stubWidth({ matches: false });
    const auth = controlledAuth({ id: 'writer' });
    const fixture = await render({
      authProvider: auth.provider,
      providers: [provideSignInPath('sign-in')],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/products/create');
    await settle(fixture);
    const navigate = vi.spyOn(router, 'navigateByUrl');

    signOutButton(fixture).click();
    await settle(fixture);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(String(navigate.mock.calls[0]?.[0])).toBe('/sign-in');
  });

  it('stays on a list page after a sign-out', async () => {
    stubWidth({ matches: false });
    const auth = controlledAuth({ id: 'writer' });
    const fixture = await render({
      authProvider: auth.provider,
      providers: [provideSignInPath('sign-in')],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/products');
    await settle(fixture);
    const navigate = vi.spyOn(router, 'navigateByUrl');

    signOutButton(fixture).click();
    await settle(fixture);

    expect(navigate).not.toHaveBeenCalled();
  });
});
