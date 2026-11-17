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

const PRODUCTS = [
  PRODUCT,
  { id: '2', name: 'Mouse', price: 19, created_at: '2026-09-03T00:00:00Z' },
  { id: '3', name: 'Monitor', price: 199, created_at: '2026-09-02T00:00:00Z' },
];

function isProductKey(key: string): key is keyof typeof PRODUCT {
  return key in PRODUCT;
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b));
}

function sortedProducts(url: string): typeof PRODUCTS {
  const order = new URL(url).searchParams.get('order');
  if (order === null) {
    return PRODUCTS;
  }
  const [term = ''] = order.split(',');
  const [key = '', direction = ''] = term.split('.');
  if (!isProductKey(key)) {
    return PRODUCTS;
  }
  const factor = direction === 'desc' ? -1 : 1;
  return [...PRODUCTS].sort((a, b) => factor * compareValues(a[key], b[key]));
}

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
  { route: 'products/create', heading: /^\s*Create product\s*$/ },
  { route: 'products/1', heading: /^\s*product — Keyboard\s*$/ },
  { route: 'products/1/edit', heading: /^\s*Edit product — Keyboard\s*$/ },
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
    if (wantsSingle) {
      return route.fulfill({
        status: 200,
        headers: { ...CORS_HEADERS, 'content-range': '0-0/1' },
        contentType: 'application/json',
        body: JSON.stringify(PRODUCT),
      });
    }
    return route.fulfill({
      status: 200,
      headers: { ...CORS_HEADERS, 'content-range': '0-2/3' },
      contentType: 'application/json',
      body: JSON.stringify(sortedProducts(request.url())),
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

    test('requests no host but the app and Supabase', async ({ page }) => {
      const hosts: string[] = [];
      page.on('request', (request) => {
        hosts.push(new URL(request.url()).hostname);
      });

      const pages = [
        { route: '', heading: 'Pidrang demo' },
        { route: 'products', heading: /^\s*products\s*$/ },
        { route: 'products/1', heading: /^\s*product — Keyboard\s*$/ },
        {
          route: 'products/1/edit',
          heading: /^\s*Edit product — Keyboard\s*$/,
        },
      ];
      for (const entry of pages) {
        await page.goto(`/${demo.path}/${entry.route}`);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          entry.heading,
        );
      }

      const allowed = ['127.0.0.1', new URL(SUPABASE_ORIGIN).hostname];
      const unexpected = [...new Set(hosts)].filter(
        (host) => !allowed.includes(host),
      );
      expect(unexpected).toEqual([]);
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

    test('sorts the products list by clicking a column header', async ({
      page,
    }) => {
      await page.goto(`/${demo.path}/products`);

      const names = page.locator('tr:has(td) > td:nth-child(2)');
      const header = page.getByRole('columnheader', {
        name: 'price',
        exact: true,
      });
      const button = header.getByRole('button');

      await expect(header).toHaveAttribute('aria-sort', 'none');
      await expect(names).toHaveText(['Mouse', 'Monitor', 'Keyboard']);

      await button.click();
      await expect(header).toHaveAttribute('aria-sort', 'ascending');
      await expect(names).toHaveText(['Mouse', 'Keyboard', 'Monitor']);

      await button.press('Enter');
      await expect(header).toHaveAttribute('aria-sort', 'descending');
      await expect(names).toHaveText(['Monitor', 'Keyboard', 'Mouse']);
      await expect(button).toBeFocused();

      await button.press(' ');
      await expect(header).toHaveAttribute('aria-sort', 'none');
      await expect(names).toHaveText(['Mouse', 'Monitor', 'Keyboard']);
      await expect(button).toBeFocused();
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

async function themeColor(
  page: Page,
  property: 'color' | 'background-color',
  token: string,
): Promise<string> {
  return page.evaluate(
    ([cssProperty, cssToken]) => {
      const probe = document.createElement('span');
      probe.style.setProperty(cssProperty, `var(${cssToken})`);
      document.body.append(probe);
      const value = getComputedStyle(probe).getPropertyValue(cssProperty);
      probe.remove();
      return value;
    },
    [property, token] as const,
  );
}

test.describe('demo-material page styles', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
  });

  test('uses Roboto for headings and body text', async ({ page }) => {
    await page.goto('/demo-material/');
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveText('Pidrang demo');

    const bodyFont = await page.evaluate(
      () => getComputedStyle(document.body).fontFamily,
    );
    const headingFont = await heading.evaluate(
      (element) => getComputedStyle(element).fontFamily,
    );
    expect(bodyFont).toMatch(/^"?Roboto/);
    expect(headingFont).toMatch(/^"?Roboto/);

    await page.goto('/demo-material/products');
    const listHeading = page.getByRole('heading', { level: 1 });
    await expect(listHeading).toHaveText(/^\s*products\s*$/);
    const listHeadingFont = await listHeading.evaluate(
      (element) => getComputedStyle(element).fontFamily,
    );
    expect(listHeadingFont).toMatch(/^"?Roboto/);
  });

  test('paints the page with the theme surface and text colors', async ({
    page,
  }) => {
    await page.goto('/demo-material/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Pidrang demo',
    );

    const body = page.locator('body');
    await expect(body).toHaveCSS(
      'background-color',
      await themeColor(page, 'background-color', '--mat-sys-surface'),
    );
    await expect(body).toHaveCSS(
      'color',
      await themeColor(page, 'color', '--mat-sys-on-surface'),
    );
    await expect(body).toHaveCSS('margin', '0px');
  });

  test('follows the dark color scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/demo-material/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Pidrang demo',
    );
    const lightBackground = await page
      .locator('body')
      .evaluate((element) => getComputedStyle(element).backgroundColor);

    await page.emulateMedia({ colorScheme: 'dark' });
    const darkBackground = await page
      .locator('body')
      .evaluate((element) => getComputedStyle(element).backgroundColor);

    expect(darkBackground).not.toBe(lightBackground);
    expect(darkBackground).toBe(
      await themeColor(page, 'background-color', '--mat-sys-surface'),
    );
  });

  test('shows alerts in the theme error color and status messages in the text color', async ({
    page,
  }) => {
    await page.goto('/demo-material/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Pidrang demo',
    );

    await page.evaluate(() => {
      const host = document.querySelector('main') ?? document.body;
      const alert = document.createElement('p');
      alert.id = 'probe-alert';
      alert.setAttribute('role', 'alert');
      alert.textContent = 'x';
      const status = document.createElement('p');
      status.id = 'probe-status';
      status.setAttribute('role', 'status');
      status.textContent = 'y';
      host.append(alert, status);
    });

    await expect(page.locator('#probe-alert')).toHaveCSS(
      'color',
      await themeColor(page, 'color', '--mat-sys-error'),
    );
    await expect(page.locator('#probe-status')).toHaveCSS(
      'color',
      await themeColor(page, 'color', '--mat-sys-on-surface'),
    );
  });

  test('drops the default list bullets on the home page', async ({ page }) => {
    await page.goto('/demo-material/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Pidrang demo',
    );

    await expect(page.locator('app-home-page ul')).toHaveCSS(
      'list-style-type',
      'none',
    );
  });

  test('loads Roboto from the app itself', async ({ page }) => {
    const fontUrls: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('.woff2')) {
        fontUrls.push(request.url());
      }
    });

    await page.goto('/demo-material/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Pidrang demo',
    );
    const robotoLoaded: boolean = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('16px Roboto');
    });

    expect(robotoLoaded).toBe(true);
    expect(fontUrls.length).toBeGreaterThan(0);
    for (const url of fontUrls) {
      expect(new URL(url).hostname).toBe('127.0.0.1');
    }
  });
});
