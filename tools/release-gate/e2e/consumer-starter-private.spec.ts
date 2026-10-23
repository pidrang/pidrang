import { Page } from '@playwright/test';

import { expect, expectations, rowIds, test } from './support';

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

async function signIn(page: Page): Promise<void> {
  await page.getByLabel('Email').fill(expectations.writer.email);
  await page.getByLabel('Password').fill(expectations.writer.password);
  await page.getByLabel('Password').press('Enter');
}

test('opens a new app whose reads need a signed-in user on the sign-in page', async ({
  page,
}) => {
  const errors = pageErrors(page);
  await page.goto('/');

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('sends a signed-out visitor of a private table to the sign-in page', async ({
  page,
}) => {
  await page.goto('/staff_notes');

  await expect(page).toHaveURL(/\/sign-in$/);
});

test('lands on the first list after signing in, private tables included', async ({
  page,
}) => {
  const errors = pageErrors(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in$/);

  await signIn(page);

  await expect(page).toHaveURL(/\/orders$/);
  expect(await rowIds(page)).toHaveLength(expectations.counts['orders']);

  await page
    .locator('#app-menu')
    .getByRole('link', { name: 'Staff notes' })
    .click();

  await expect(page).toHaveURL(/\/staff_notes$/);
  expect(await rowIds(page)).toHaveLength(expectations.counts['staff_notes']);
  expect(errors).toEqual([]);
});
