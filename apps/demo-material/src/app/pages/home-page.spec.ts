import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthProvider, DataProvider, providePidrang } from '@pidrang/core';
import { provideSignInPath } from '@pidrang/demo-shared';

import { HomePage } from './home-page';

const unused = () => Promise.reject(new Error('unused'));

async function render(providers: Provider[]) {
  const dataProvider: DataProvider = {
    getList: unused,
    getOne: unused,
    create: unused,
    update: unused,
    delete: unused,
  };
  const authProvider: AuthProvider = {
    login: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    getIdentity: () => Promise.resolve(null),
  };
  TestBed.configureTestingModule({
    imports: [HomePage],
    providers: [
      provideRouter([]),
      providePidrang({ dataProvider, authProvider, resources: [] }),
      ...providers,
    ],
  });
  const fixture = TestBed.createComponent(HomePage);
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('HomePage sign-in', () => {
  it('links "Sign in" to the sign-in path the app provides', async () => {
    const page = await render([provideSignInPath('/login')]);

    const link = [...page.querySelectorAll('a')].find(
      (candidate) => candidate.textContent?.trim() === 'Sign in',
    );
    expect(link?.getAttribute('href')).toBe('/login');
  });

  it('renders no dead "Sign in" control when the app provides no sign-in path', async () => {
    const page = await render([]);

    expect(
      [...page.querySelectorAll('a, button')].some(
        (element) => element.textContent?.trim() === 'Sign in',
      ),
    ).toBe(false);
  });
});
