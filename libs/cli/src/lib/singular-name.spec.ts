import { singularName } from './singular-name';

describe('singularName', () => {
  it.each([
    ['users', 'user'],
    ['categories', 'category'],
    ['addresses', 'address'],
    ['boxes', 'box'],
    ['batches', 'batch'],
    ['wishes', 'wish'],
    ['fixture_items', 'fixture_item'],
    ['UserAccounts', 'UserAccount'],
    ['ORDERS', 'ORDER'],
  ])('turns %s into %s', (name, singular) => {
    expect(singularName(name)).toBe(singular);
  });

  it.each(['news', 'News', 'status', 'class', 'analysis', 'person', 'people'])(
    'gives no singular for %s',
    (name) => {
      expect(singularName(name)).toBeUndefined();
    },
  );

  it.each([
    ['movies', 'movy'],
    ['cookies', 'cooky'],
    ['statuses', 'statuse'],
  ])('keeps the known miss of %s, which gives %s', (name, singular) => {
    expect(singularName(name)).toBe(singular);
  });
});
