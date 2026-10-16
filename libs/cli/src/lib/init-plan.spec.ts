import { parseInitPlan } from './init-plan';

function plan(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    provider: 'supabase',
    connection: { strategy: 'graphql' },
    tables: [{ table: 'products', actions: ['list'] }],
    ...overrides,
  };
}

function table(overrides: Record<string, unknown>): Record<string, unknown> {
  return plan({
    tables: [{ table: 'products', actions: ['list'], ...overrides }],
  });
}

describe('parseInitPlan', () => {
  it('reads a valid plan and defaults hiddenFields to none', () => {
    expect(
      parseInitPlan(
        plan({
          tables: [
            { table: 'products', actions: ['list', 'edit'] },
            { table: 'orders', actions: ['show'], hiddenFields: ['id'] },
          ],
        }),
      ),
    ).toEqual({
      provider: 'supabase',
      connection: { strategy: 'graphql' },
      tables: [
        { table: 'products', actions: ['list', 'edit'], hiddenFields: [] },
        { table: 'orders', actions: ['show'], hiddenFields: ['id'] },
      ],
    });
  });

  it.each([
    ['null', null, 'the plan must be a JSON object'],
    ['a list', [], 'the plan must be a JSON object'],
    ['a string', 'plan', 'the plan must be a JSON object'],
    [
      'an unknown property',
      plan({ force: true }),
      'the plan has an unknown property "force"',
    ],
    [
      'no provider',
      plan({ provider: undefined }),
      'provider must be the id of a data source',
    ],
    [
      'an empty provider',
      plan({ provider: '' }),
      'provider must be the id of a data source',
    ],
    [
      'no connection',
      plan({ connection: undefined }),
      'connection must be an object',
    ],
    [
      'a list as connection',
      plan({ connection: [] }),
      'connection must be an object',
    ],
    [
      'no tables',
      plan({ tables: undefined }),
      'tables must list at least one table',
    ],
    [
      'an empty table list',
      plan({ tables: [] }),
      'tables must list at least one table',
    ],
    [
      'tables as an object',
      plan({ tables: {} }),
      'tables must list at least one table',
    ],
    [
      'a table that is not an object',
      plan({ tables: ['products'] }),
      'tables[0] must be an object',
    ],
    [
      'a table without a name',
      table({ table: undefined }),
      'tables[0].table must be a string',
    ],
    [
      'a table with a number as name',
      table({ table: 1 }),
      'tables[0].table must be a string',
    ],
    [
      'an unknown table property',
      table({ label: 'x' }),
      'tables[0] has an unknown property "label"',
    ],
    [
      'no actions',
      table({ actions: undefined }),
      'tables[0].actions must be a list',
    ],
    [
      'an empty action list',
      table({ actions: [] }),
      'tables[0].actions must list at least one action',
    ],
    [
      'actions as a string',
      table({ actions: 'list' }),
      'tables[0].actions must be a list',
    ],
    [
      'an unknown action',
      table({ actions: ['list', 'update'] }),
      'tables[0].actions[1] must be one of list, create, show, edit, delete, got "update"',
    ],
    [
      'an action that is not a string',
      table({ actions: [1] }),
      'tables[0].actions[0] must be a string',
    ],
    [
      'a repeated action',
      table({ actions: ['list', 'list'] }),
      'tables[0].actions repeats list',
    ],
    [
      'hiddenFields as a string',
      table({ hiddenFields: 'id' }),
      'tables[0].hiddenFields must be a list',
    ],
    [
      'a hidden field that is not a string',
      table({ hiddenFields: [null] }),
      'tables[0].hiddenFields[0] must be a string',
    ],
    [
      'a repeated hidden field',
      table({ hiddenFields: ['id', 'id'] }),
      'tables[0].hiddenFields repeats id',
    ],
    [
      'a repeated table',
      plan({
        tables: [
          { table: 'products', actions: ['list'] },
          { table: 'products', actions: ['show'] },
        ],
      }),
      'tables repeats "products"',
    ],
  ])('refuses a plan with %s', (_, value, message) => {
    expect(() => parseInitPlan(value)).toThrow(message);
  });

  it('lists every problem at once', () => {
    const error = (() => {
      try {
        parseInitPlan(
          plan({
            provider: 1,
            tables: [{ table: 'a', actions: [] }, { actions: ['nope'] }],
          }),
        );
        return null;
      } catch (err) {
        return err as Error;
      }
    })();

    expect(error?.message).toBe(
      'Invalid plan: provider must be the id of a data source, such as "supabase"; tables[0].actions must list at least one action; tables[1].table must be a string; tables[1].actions[0] must be one of list, create, show, edit, delete, got "nope".',
    );
  });

  it('never repeats a connection value in its messages', () => {
    expect(() =>
      parseInitPlan(
        plan({ connection: { anonKey: 'secret-value' }, tables: [] }),
      ),
    ).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining('secret-value'),
      }),
    );
  });
});
