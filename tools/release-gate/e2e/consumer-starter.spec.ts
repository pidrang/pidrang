import { Page } from '@playwright/test';

import { expect, rowIds, test } from './support';

function pageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  return errors;
}

test('opens the first generated page of a new app inside the layout', async ({
  page,
}) => {
  const errors = pageErrors(page);
  await page.goto('/');

  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.locator('mat-toolbar')).toContainText('Pidrang starter');
  const menu = page.locator('#app-menu');
  for (const name of ['Create Users', 'Orders', 'Products', 'Fixture items']) {
    await expect(menu.getByRole('link', { name })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('lists a resource from the side menu', async ({ page }) => {
  const errors = pageErrors(page);
  await page.goto('/');

  await page
    .locator('#app-menu')
    .getByRole('link', { name: 'Products' })
    .click();

  await expect(page).toHaveURL(/\/products$/);
  expect(await rowIds(page)).toHaveLength(10);
  expect(errors).toEqual([]);
});

test('points the header to the sign-in path init wrote', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.locator('mat-toolbar').getByRole('link', { name: 'Sign in' }),
  ).toHaveAttribute('href', '/sign-in');
});
