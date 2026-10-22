import { Page } from '@playwright/test';

import { expect, expectations, publishableKey, rowIds, test } from './support';

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

test('signs in from the generated page, then creates and edits', async ({
  page,
}) => {
  const errors = pageErrors(page);
  await page.goto('/');
  const signIn = page
    .locator('mat-toolbar')
    .getByRole('link', { name: 'Sign in' });
  await expect(signIn).toBeVisible();
  await signIn.click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByLabel('Email').fill(expectations.writer.email);
  await page.getByLabel('Password').fill(expectations.writer.password);
  await page.getByLabel('Password').press('Enter');
  await expect(page.locator('mat-card')).toContainText(
    expectations.writer.email,
  );

  const name = `Starter sign-in ${Date.now()}`;
  await page.goto('/fixture_items/create');
  await page.getByLabel('name').fill(name);
  await page.getByLabel('name').press('Enter');
  await expect(page).toHaveURL(/\/fixture_items$/);

  const created = await page.request.get(
    `http://127.0.0.1:54321/rest/v1/fixture_items?name=eq.${encodeURIComponent(name)}&select=id`,
    { headers: { apikey: publishableKey } },
  );
  const [{ id }] = (await created.json()) as { id: string }[];

  await page.goto(`/fixture_items/${id}/edit`);
  await page.getByLabel('name').fill(`${name} edited`);
  await page.getByLabel('name').press('Enter');
  await expect(page).toHaveURL(/\/fixture_items$/);

  await page.goto(`/fixture_items/${id}`);
  await expect(page.locator('dd').nth(1)).toHaveText(`${name} edited`);
  expect(errors).toEqual([]);
});
