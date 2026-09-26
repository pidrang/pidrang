import { expect, test, Page } from '@playwright/test';

const SUPABASE_ORIGIN = 'https://hfdtakpqybirvhcfnwes.supabase.co';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'access-control-expose-headers': 'content-range',
};

const PRODUCT = {
  id: '1',
  name: 'Keyboard',
  price: 49,
  created_at: '2026-09-01T00:00:00Z',
};

const DEMO_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'demo@pidrang.dev',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-09-01T00:00:00Z',
};

const ACCESS_TOKEN = 'test-access-token';

const DEMOS = [
  { path: 'demo-material', sibling: 'https://pidrang.dev/demo-tailwind/' },
  { path: 'demo-tailwind', sibling: 'https://pidrang.dev/demo-material/' },
];

const DEEP_LINKS = [
  { route: 'products', heading: /^\s*products\s*$/ },
  { route: 'products/create', heading: /^\s*Create products\s*$/ },
  { route: 'products/1', heading: /^\s*products — Keyboard\s*$/ },
  { route: 'products/1/edit', heading: /^\s*Edit products — Keyboard\s*$/ },
  { route: 'login', heading: /^\s*Sign in\s*$/ },
];

async function mockSupabase(page: Page): Promise<void> {
  await page.route(`${SUPABASE_ORIGIN}/**`, (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    if (request.url().includes('/auth/v1/token')) {
      return route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: ACCESS_TOKEN,
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'test-refresh-token',
          user: DEMO_USER,
        }),
      });
    }
    if (request.url().includes('/auth/v1/user')) {
      const signedIn =
        request.headers()['authorization'] === `Bearer ${ACCESS_TOKEN}`;
      return route.fulfill({
        status: signedIn ? 200 : 401,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify(
          signedIn ? DEMO_USER : { message: 'Auth session missing' },
        ),
      });
    }
    if (request.url().includes('/auth/v1/')) {
      return route.fulfill({
        status: 401,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Auth session missing' }),
      });
    }
    const wantsSingle = (request.headers()['accept'] ?? '').includes(
      'vnd.pgrst.object',
    );
    return route.fulfill({
      status: 200,
      headers: { ...CORS_HEADERS, 'content-range': '0-0/1' },
      contentType: 'application/json',
      body: JSON.stringify(wantsSingle ? PRODUCT : [PRODUCT]),
    });
  });
}

for (const demo of DEMOS) {
  test.describe(demo.path, () => {
    test.beforeEach(async ({ page }) => {
      await mockSupabase(page);
    });

    test('loads under its exact subpath with every asset resolved', async ({
      page,
    }) => {
      const failures: string[] = [];
      page.on('response', (response) => {
        if (
          response.url().startsWith('http://127.0.0.1') &&
          response.status() >= 400
        ) {
          failures.push(`${response.status()} ${response.url()}`);
        }
      });

      await page.goto(`/${demo.path}/`);

      await expect(page.locator('base')).toHaveAttribute(
        'href',
        `/${demo.path}/`,
      );
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Pidrang demo',
      );
      expect(failures).toEqual([]);
    });

    test('links to the sibling demo through its public URL', async ({
      page,
    }) => {
      await page.goto(`/${demo.path}/`);

      await expect(page.locator(`a[href="${demo.sibling}"]`)).toHaveCount(1);
    });

    for (const link of DEEP_LINKS) {
      test(`restores /${link.route} after a hard refresh`, async ({ page }) => {
        const response = await page.goto(`/${demo.path}/${link.route}`);

        expect(response?.status()).toBe(404);
        await expect(page).toHaveURL(`/${demo.path}/${link.route}`);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          link.heading,
        );
      });
    }

    test('shows the shared demo account on the sign-in page and signs in with it', async ({
      page,
    }) => {
      await page.goto(`/${demo.path}/login`);

      await expect(
        page.getByRole('heading', { name: 'Demo account' }),
      ).toBeVisible();
      await expect(page.getByText('demo@pidrang.dev').first()).toBeVisible();

      await page
        .getByRole('button', { name: 'Sign in as the demo account' })
        .click();

      await expect(page).toHaveURL(`/${demo.path}/`);
      await expect(
        page.getByText('Signed in as demo@pidrang.dev'),
      ).toBeVisible();
    });

    test('keeps the query string and the hash of a deep link', async ({
      page,
    }) => {
      await page.goto(`/${demo.path}/products?x=1&y=2#top`);

      await expect(page).toHaveURL(`/${demo.path}/products?x=1&y=2#top`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'products',
      );
    });
  });
}

test('an unknown path shows the not found page without redirecting', async ({
  page,
}) => {
  const response = await page.goto('/nowhere/at/all');

  expect(response?.status()).toBe(404);
  await expect(page).toHaveURL('/nowhere/at/all');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Page not found',
  );
});
