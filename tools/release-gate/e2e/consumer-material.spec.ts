import { Page } from '@playwright/test';

import {
  expect,
  expectations,
  productIdsNewestFirst,
  publishableKey,
  rowIds,
  test,
} from './support';

const { fixture_items } = expectations.resources;

async function signIn(page: Page): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(expectations.writer.email);
  await page.getByLabel('Password').fill(expectations.writer.password);
  await page.getByLabel('Password').press('Enter');
  await expect(page.getByTestId('identity')).toHaveText(
    expectations.writer.email,
  );
}

function deleteRequests(page: Page): string[] {
  const sent: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'DELETE') {
      sent.push(request.url());
    }
  });
  return sent;
}

test('signs in with the keyboard and out again', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByTestId('identity')).toHaveCount(0);
});

test('says a sign-in failed and clears the message on the next try', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(expectations.writer.email);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByLabel('Password').press('Enter');
  await expect(page.getByRole('alert')).toBeVisible();

  await page.getByLabel('Password').fill(expectations.writer.password);
  await page.getByLabel('Password').press('Enter');
  await expect(page.getByTestId('identity')).toHaveText(
    expectations.writer.email,
  );
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('lists a resource page by page up to row eleven', async ({ page }) => {
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: 'products' })).toBeVisible();
  const newest = await productIdsNewestFirst(page);
  expect(await rowIds(page)).toEqual(newest.slice(0, 10));

  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('tbody tr').first()).toContainText(newest[10]);
});

test('creates, shows, edits and deletes a record as the writer', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/products/create');
  await page.getByLabel('name').fill('Gate keyboard');
  await page.getByLabel('price').fill('42');
  await page.getByLabel('price').press('Enter');
  await expect(page).toHaveURL(/\/products$/);

  const created = await page.request.get(
    `http://127.0.0.1:54321/rest/v1/products?name=eq.Gate%20keyboard&select=id`,
    { headers: { apikey: publishableKey } },
  );
  const [{ id }] = (await created.json()) as { id: string }[];

  await page.goto(`/products/${id}`);
  await expect(
    page.getByRole('heading', { name: 'products — Gate keyboard' }),
  ).toBeVisible();
  await expect(page.locator('dd').nth(2)).toHaveText('42');

  await page.goto(`/products/${id}/edit`);
  await page.getByLabel('name').fill('Gate keyboard renamed');
  await page.getByLabel('name').press('Enter');
  await expect(
    page.getByRole('heading', { name: 'products — Gate keyboard renamed' }),
  ).toBeVisible();

  await page.goto('/products');
  const sent = deleteRequests(page);
  const firstRow = page.locator('tbody tr').first();
  const messages: string[] = [];
  page.once('dialog', (dialog) => {
    messages.push(dialog.message());
    return dialog.dismiss();
  });
  await firstRow.getByRole('button', { name: 'Delete' }).click();
  await expect.poll(() => messages).toHaveLength(1);
  expect(messages[0]).toContain('from products?');
  await page.reload();
  await expect(page.locator('tbody tr').first()).toContainText(id);
  expect(sent).toEqual([]);

  page.once('dialog', (dialog) => dialog.accept());
  await page
    .locator('tbody tr')
    .first()
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page.locator('tbody tr').first()).not.toContainText(id);
  expect(sent).toHaveLength(1);
});

test('retries a delete after a network failure and clears the error', async ({
  page,
}) => {
  await signIn(page);
  const [newestId] = await productIdsNewestFirst(page);
  await page.goto('/products');
  const sent = deleteRequests(page);
  let failNext = true;
  await page.route('**/rest/v1/products?*', (route) => {
    if (route.request().method() === 'DELETE' && failNext) {
      failNext = false;
      return route.abort('failed');
    }
    return route.fallback();
  });
  page.on('dialog', (dialog) => dialog.accept());
  const firstRow = page.locator('tbody tr').first();

  await firstRow.getByRole('button', { name: 'Delete' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).not.toContainText('sign in');
  await expect(firstRow).toContainText(newestId);

  await firstRow.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('tbody tr').first()).not.toContainText(newestId);
  await expect(alert).toHaveCount(0);
  expect(sent).toHaveLength(2);
});

test('says a refused delete is not allowed and keeps the row', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/fixture_items');
  page.on('dialog', (dialog) => dialog.accept());
  const firstRow = page.locator('tbody tr').first();
  const id = await firstRow.locator('td').first().innerText();

  await firstRow.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'You are not allowed to delete this record.',
  );
  await expect(page.getByRole('alert')).not.toContainText('sign in');
  await page.reload();
  await expect(page.locator('tbody tr').first()).toContainText(id);
});

test('reports a write that row-level security refuses and keeps the row', async ({
  page,
}) => {
  await signIn(page);
  const listed = await page.request.get(
    `http://127.0.0.1:54321/rest/v1/fixture_items?name=neq.Locked%20item&select=id,name&order=id&limit=1`,
    { headers: { apikey: publishableKey } },
  );
  const [{ id, name }] = (await listed.json()) as {
    id: string;
    name: string;
  }[];
  await page.goto(`/fixture_items/${id}/edit`);
  await page.getByLabel('name').fill('Locked item');
  await page.getByLabel('name').press('Enter');
  await expect(page.getByRole('alert')).toContainText('row-level security');
  await expect(page.getByRole('alert')).not.toContainText('sign in');
  expect((await storedAsText(page, id)).name).toBe(name);
});

test('asks an anonymous user to sign in, then lets the write through', async ({
  page,
}) => {
  await page.goto('/fixture_items');
  page.on('dialog', (dialog) => dialog.accept());
  await page
    .locator('tbody tr')
    .first()
    .getByRole('button', { name: 'Delete' })
    .click();

  const link = page.getByRole('alert').getByRole('link', { name: 'sign in' });
  await expect(link).toHaveAttribute('href', '/sign-in');
  await link.click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByLabel('Email').fill(expectations.writer.email);
  await page.getByLabel('Password').fill(expectations.writer.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByTestId('identity')).toBeVisible();

  const [newestId] = await productIdsNewestFirst(page);
  await page.goto('/products');
  await page
    .locator('tbody tr')
    .first()
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page.locator('tbody tr').first()).not.toContainText(newestId);
});

test('honours the generated action flags', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/')) {
      requested.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.goto('/orders');
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Show' }).first()).toBeVisible();

  requested.length = 0;
  await page.goto('/orders/create');
  await expect(
    page.getByRole('heading', { name: 'Page not available' }),
  ).toBeVisible();
  await page.goto('/users');
  await expect(
    page.getByRole('heading', { name: 'Page not available' }),
  ).toBeVisible();
  expect(requested).toEqual([]);

  await page.goto(`/users/create`);
  await expect(
    page.getByRole('heading', { name: 'Create users' }),
  ).toBeVisible();
});

test('keeps unknown resources, missing records and app routes apart', async ({
  page,
}) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.goto('/no_such_resource');
  await expect(
    page.getByRole('heading', { name: 'Page not available' }),
  ).toBeVisible();

  await page.goto('/products/00000000-0000-4000-8002-999999999999');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});

test('renders a record into the show page through route input binding', async ({
  page,
}) => {
  await page.goto(`/fixture_items/${fixture_items.lockedId}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'fixture_items — ',
  );
  await expect(page.locator('dd').first()).toHaveText(fixture_items.lockedId);
});

test('styles the generated pages with the Material theme', async ({ page }) => {
  await page.goto('/products');
  const create = page.getByRole('link', { name: 'Create' });
  await expect(create).toBeVisible();
  const background = await create.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(background).not.toBe('rgba(0, 0, 0, 0)');
  expect(background).not.toBe('transparent');
});

function capturedBody(page: Page, method: string): () => unknown {
  let body: unknown;
  page.on('request', (request) => {
    if (
      request.method() === method &&
      request.url().includes('/rest/v1/fixture_items')
    ) {
      body = request.postDataJSON();
    }
  });
  return () => body;
}

async function storedAsText(
  page: Page,
  id: string,
): Promise<Record<string, string | null>> {
  const response = await page.request.get(
    `http://127.0.0.1:54321/rest/v1/fixture_items?id=eq.${id}&select=name,quantity::text,amount::text,available_on::text,note`,
    { headers: { apikey: publishableKey } },
  );
  const [row] = (await response.json()) as Record<string, string | null>[];
  return row;
}

test('creates without sending untouched defaults and keeps exact values', async ({
  page,
}) => {
  await signIn(page);
  const body = capturedBody(page, 'POST');
  await page.goto('/fixture_items/create');
  await page.getByLabel('name').fill('Gate precise item');
  await page.getByLabel('amount').fill('12345678901234.5678');
  await page.getByLabel('available_on').fill('2026-03-04');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/fixture_items$/);

  expect(body()).toEqual({
    name: 'Gate precise item',
    amount: '12345678901234.5678',
    available_on: '2026-03-04',
  });
  const created = await page.request.get(
    `http://127.0.0.1:54321/rest/v1/fixture_items?name=eq.Gate%20precise%20item&select=id`,
    { headers: { apikey: publishableKey } },
  );
  const [{ id }] = (await created.json()) as { id: string }[];
  expect(await storedAsText(page, id)).toEqual({
    name: 'Gate precise item',
    quantity: '1',
    amount: '12345678901234.5678',
    available_on: '2026-03-04',
    note: null,
  });
});

test('sends an explicit zero instead of the default', async ({ page }) => {
  await signIn(page);
  const body = capturedBody(page, 'POST');
  await page.goto('/fixture_items/create');
  await page.getByLabel('name').fill('Gate zero item');
  await page.getByLabel('quantity').fill('0');
  await page.getByLabel('amount').fill('1');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/fixture_items$/);
  expect(body()).toMatchObject({ quantity: 0 });
});

test('edits only the changed field and leaves a precise value untouched', async ({
  page,
}) => {
  await signIn(page);
  const body = capturedBody(page, 'PATCH');
  const { id, stored } = expectations.precision;
  await page.goto(`/fixture_items/${id}/edit`);
  await expect(page.getByLabel('amount')).toHaveValue(/^1234/);
  await page.getByLabel('name').fill('Gate renamed precise row');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'fixture_items — Gate renamed precise row',
    }),
  ).toBeVisible();
  expect(body()).toEqual({ name: 'Gate renamed precise row' });
  expect((await storedAsText(page, id)).amount).toBe(stored);
});

test('clears a nullable date to null', async ({ page }) => {
  await signIn(page);
  const body = capturedBody(page, 'PATCH');
  const listed = await page.request.get(
    `http://127.0.0.1:54321/rest/v1/fixture_items?available_on=not.is.null&name=neq.Locked%20item&select=id&order=id&limit=1`,
    { headers: { apikey: publishableKey } },
  );
  const [{ id }] = (await listed.json()) as { id: string }[];
  await page.goto(`/fixture_items/${id}/edit`);
  await expect(page.getByLabel('available_on')).not.toHaveValue('');
  await page.getByLabel('available_on').fill('');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 1 })).not.toContainText(
    'Edit',
  );
  expect(body()).toEqual({ available_on: null });
  expect((await storedAsText(page, id)).available_on).toBeNull();
});
