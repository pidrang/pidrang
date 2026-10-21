import { readableLabel } from './readable-label';

describe('readableLabel', () => {
  it.each([
    ['products', 'Products'],
    ['order_items', 'Order items'],
    ['created_at', 'Created at'],
    ['userId', 'User id'],
    ['userID', 'User id'],
    ['kebab-case', 'Kebab case'],
    ['_leading', 'Leading'],
    ['v2_orders', 'V2 orders'],
    ['2fa_enabled', '2fa enabled'],
  ])('turns %s into %s', (name, label) => {
    expect(readableLabel(name)).toBe(label);
  });

  it('keeps a name it cannot split as it is', () => {
    expect(readableLabel('___')).toBe('___');
  });
});
