import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Page, expect, test as base } from '@playwright/test';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

function supabaseDirectory(): string {
  const directory = process.env['PIDRANG_SUPABASE_DIR'];
  if (!directory) {
    throw new Error(
      'PIDRANG_SUPABASE_DIR must point at a pidrang/supabase checkout',
    );
  }
  return directory;
}

interface Expectations {
  writer: { email: string; password: string };
  precision: { id: string; stored: string; javascript: string };
  counts: Record<string, number>;
  resources: {
    products: { firstId: string; eleventhId: string };
    fixture_items: { lockedId: string };
  };
}

export const expectations: Expectations = JSON.parse(
  readFileSync(
    join(supabaseDirectory(), 'supabase/fixtures/expectations.json'),
    'utf8',
  ),
);

export const publishableKey = (() => {
  const key = process.env['PIDRANG_PUBLISHABLE_KEY'];
  if (!key) {
    throw new Error(
      'PIDRANG_PUBLISHABLE_KEY must hold the local stack publishable key',
    );
  }
  return key;
})();

export function reloadFixtures(): void {
  execFileSync(join(supabaseDirectory(), 'scripts/load-fixtures.sh'), {
    stdio: 'pipe',
  });
}

export const test = base.extend<{ blocked: string[] }>({
  blocked: [
    async ({ page }, use) => {
      const blocked: string[] = [];
      await page.route('**/*', (route) => {
        const url = new URL(route.request().url());
        if (LOOPBACK.has(url.hostname)) {
          return route.continue();
        }
        blocked.push(url.href);
        return route.abort('blockedbyclient');
      });
      await use(blocked);
      expect(blocked, 'requests to a non-loopback host').toEqual([]);
    },
    { auto: true },
  ],
});

test.beforeEach(() => reloadFixtures());

export { expect };

export async function productIdsNewestFirst(page: Page): Promise<string[]> {
  const response = await page.request.get(
    'http://127.0.0.1:54321/rest/v1/products?select=id&order=created_at.desc,id.asc',
    { headers: { apikey: publishableKey } },
  );
  const rows = (await response.json()) as { id: string }[];
  return rows.map(({ id }) => id);
}

export async function rowIds(page: Page): Promise<string[]> {
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toBeVisible();
  return rows.locator('td:first-child').allInnerTexts();
}

export const NARROW = { width: 390, height: 844 };

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, 'document wider than the viewport').toBeLessThanOrEqual(
    clientWidth,
  );
}

export async function expectMenuOverContent(page: Page): Promise<void> {
  const menu = page.locator('#app-menu');
  const content = page.getByRole('main');
  await expect(menu).toHaveCount(0);
  const closed = await content.boundingBox();

  await page.getByRole('button', { name: 'Menu' }).click();

  await expect(menu).toBeVisible();
  expect(await content.boundingBox()).toEqual(closed);
  const opened = await menu.boundingBox();
  if (closed === null || opened === null) {
    throw new Error('the menu or the page has no box');
  }
  expect(opened.x).toBeCloseTo(closed.x, 0);
  expect(opened.y).toBeCloseTo(closed.y, 0);
  expect(opened.width).toBeLessThan(closed.width);
  expect(
    await menu.evaluate((element) => getComputedStyle(element).backgroundColor),
    'the open menu lets the page show through',
  ).not.toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/);
  await expectNoHorizontalScroll(page);
}
