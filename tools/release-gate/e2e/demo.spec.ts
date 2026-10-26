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

test('moves the focus back to the Menu button after a link picked with the keyboard on a narrow screen', async ({
  page,
}) => {
  await page.setViewportSize(NARROW);
  await page.goto('/products');
  await rowIds(page);
  await page.getByRole('button', { name: 'Menu' }).click();

  await page.locator('#app-menu').getByRole('link', { name: 'orders' }).focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.locator('#app-menu')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Menu' })).toBeFocused();
});

test('closes the side menu on a tap outside it on a narrow screen', async ({
  page,
}) => {
  await page.setViewportSize(NARROW);
  await page.goto('/products');
  await rowIds(page);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.locator('#app-menu')).toBeVisible();

  await page.mouse.click(NARROW.width - 8, NARROW.height - 8);

  await expect(page.locator('#app-menu')).toHaveCount(0);
  await expect(page).toHaveURL(/\/products$/);
});

test('ends the app name with an ellipsis on a narrow screen only', async ({
  page,
}) => {
  await page.goto('/products');
  const name = page.getByText(/^Pidrang (Material|Tailwind)$/);
  const overflow = () =>
    name.evaluate((element) => getComputedStyle(element).textOverflow);

  expect(await overflow()).not.toBe('ellipsis');

  await page.setViewportSize(NARROW);

  expect(await overflow()).toBe('ellipsis');
});

test('shows the app name and the signed-in email in full on a wide screen', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(expectations.writer.email);
  await page.getByLabel('Password').fill(expectations.writer.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const identity = page.getByText(expectations.writer.email, { exact: true });
  await expect(identity).toBeVisible();
  const overflow = (locator: typeof identity) =>
    locator.evaluate((element) => getComputedStyle(element).textOverflow);

  expect(await overflow(identity)).not.toBe('ellipsis');
  expect(
    await overflow(page.getByText(/^Pidrang (Material|Tailwind)$/)),
  ).not.toBe('ellipsis');

  await page.setViewportSize(NARROW);

  expect(await overflow(identity)).toBe('ellipsis');
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

test('scrolls inside the open menu on a narrow screen when its links are taller than the page', async ({
  page,
}) => {
  await page.setViewportSize({ width: NARROW.width, height: 240 });
  await page.goto('/');
  await page.addStyleTag({
    content: 'html { font-size: 32px; } main > * { display: none; }',
  });
  await page.getByRole('button', { name: 'Menu' }).click();
  const menu = page.locator('#app-menu');
  await expect(menu).toBeVisible();

  const last = menu.getByRole('link').last();
  await last.scrollIntoViewIfNeeded();

  const box = await menu.boundingBox();
  const link = await last.boundingBox();
  if (box === null || link === null) {
    throw new Error('the menu or its last link has no box');
  }
  expect(link.y + link.height).toBeLessThanOrEqual(box.y + box.height + 1);
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
