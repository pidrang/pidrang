import {
  NARROW,
  expect,
  expectMenuOverContent,
  expectNoHorizontalScroll,
  expectations,
  productIdsNewestFirst,
  rowIds,
  test,
} from './support';

const { products } = expectations.resources;

test('opens the home page and the products list up to row eleven', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Pidrang demo' }),
  ).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'products' }).click();

  const newest = await productIdsNewestFirst(page);
  expect(await rowIds(page)).toEqual(newest.slice(0, 10));
  await page.getByRole('button', { name: /^Next( page)?$/ }).click();
  await expect(page.locator('tbody tr').first()).toContainText(newest[10]);
});

test('opens the show, edit and create pages of a record', async ({ page }) => {
  await page.goto(`/products/${products.firstId}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'products — ',
  );
  await expect(page.locator('dd').first()).toHaveText(products.firstId);

  await page.goto(`/products/${products.firstId}/edit`);
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();

  await page.goto('/products/create');
  await expect(
    page.getByRole('heading', { name: 'Create products' }),
  ).toBeVisible();
});

test('signs in with the fixture writer and deletes a record', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(expectations.writer.email);
  await page.getByLabel('Password').fill(expectations.writer.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByText(`Signed in as ${expectations.writer.email}`),
  ).toBeVisible();

  const [newestId] = await productIdsNewestFirst(page);
  await page.goto('/products');
  page.on('dialog', (dialog) => dialog.accept());
  await page
    .locator('tbody tr')
    .first()
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page.locator('tbody tr').first()).not.toContainText(newestId);
});

test('shows the not-available page for an unknown resource', async ({
  page,
}) => {
  await page.goto('/no_such_resource');
  await expect(
    page.getByRole('heading', { name: 'Page not available' }),
  ).toBeVisible();
});

test('opens the side menu over the page on a narrow screen and closes it after a link', async ({
  page,
}) => {
  await page.setViewportSize(NARROW);
  await page.goto('/products');
  await rowIds(page);
  await expectNoHorizontalScroll(page);

  await expectMenuOverContent(page);
  await page.locator('#app-menu').getByRole('link', { name: 'orders' }).click();

  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.locator('#app-menu')).toHaveCount(0);
  await rowIds(page);
  await expectNoHorizontalScroll(page);
});

test('keeps a narrow screen from scrolling sideways once signed in', async ({
  page,
}) => {
  await page.setViewportSize(NARROW);
  await page.goto('/login');
  await page.getByLabel('Email').fill(expectations.writer.email);
  await page.getByLabel('Password').fill(expectations.writer.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByText(`Signed in as ${expectations.writer.email}`),
  ).toBeVisible();

  await page.goto('/products');
  await rowIds(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.locator('#app-menu')).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('keeps the side menu open beside the page on a wide screen', async ({
  page,
}) => {
  await page.goto('/products');
  const menu = page.locator('#app-menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('link', { name: 'orders' }).click();

  await expect(page).toHaveURL(/\/orders$/);
  await expect(menu).toBeVisible();
  const opened = await menu.boundingBox();
  const content = await page.getByRole('main').boundingBox();
  if (opened === null || content === null) {
    throw new Error('the menu or the page has no box');
  }
  expect(opened.x + opened.width).toBeLessThanOrEqual(content.x);
});

test('keeps the open menu inside a narrow screen with a large root font', async ({
  page,
}) => {
  await page.setViewportSize(NARROW);
  await page.goto('/products');
  await rowIds(page);
  await page.addStyleTag({ content: 'html { font-size: 32px; }' });

  await page.getByRole('button', { name: 'Menu' }).click();

  await expect(page.locator('#app-menu')).toBeVisible();
  await expectNoHorizontalScroll(page);
});
