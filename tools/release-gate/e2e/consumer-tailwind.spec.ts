import { expect, expectations, rowIds, test } from './support';

test('renders installed Tailwind components with their utility styles', async ({
  page,
}) => {
  await page.goto('/');
  const ids = await rowIds(page);
  expect(ids).toHaveLength(10);
  expect(ids[0]).toBe(expectations.resources.products.firstId);

  const header = page.locator('th').first();
  await expect(header).toHaveCSS('font-weight', '500');
  await expect(header).toHaveCSS('padding-left', '12px');

  const save = page.getByRole('button', { name: 'Save' });
  const background = await save.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(background).not.toBe('rgba(0, 0, 0, 0)');
  await expect(save).toHaveCSS('color', 'rgb(255, 255, 255)');

  const input = page.getByLabel('name');
  const idle = await input.evaluate(
    (element) => getComputedStyle(element).borderColor,
  );
  await input.focus();
  await expect
    .poll(() =>
      input.evaluate((element) => getComputedStyle(element).borderColor),
    )
    .not.toBe(idle);
});

test('shows a failed list request and loads it again on retry', async ({
  page,
}) => {
  let failing = true;
  await page.route('**/rest/v1/products?*', (route) =>
    failing ? route.abort('failed') : route.fallback(),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 20_000 });
  failing = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  expect(await rowIds(page)).toHaveLength(10);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
