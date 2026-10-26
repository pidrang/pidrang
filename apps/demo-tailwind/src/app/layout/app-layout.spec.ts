import { Component, ViewEncapsulation } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthProvider, DataProvider, providePidrang } from '@pidrang/core';

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
  getIdentity: () => Promise.resolve(null),
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

async function render(): Promise<ComponentFixture<AppLayout>> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', component: EmptyPage }]),
      providePidrang({
        dataProvider: noopDataProvider,
        authProvider: noopAuthProvider,
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
