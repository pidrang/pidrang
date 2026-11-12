import {
  NG_NEW_INITIAL_WARNING,
  RAISED_INITIAL_WARNING,
  raiseInitialBudget,
} from './edit-budget';

const ngNewWorkspace = (
  budgets: unknown = [
    { type: 'initial', maximumWarning: '500kB', maximumError: '1MB' },
    { type: 'anyComponentStyle', maximumWarning: '4kB', maximumError: '8kB' },
  ],
  defaultConfiguration: string | null = 'production',
) =>
  JSON.stringify({
    projects: {
      shop: {
        projectType: 'application',
        sourceRoot: 'src',
        architect: {
          build: {
            ...(defaultConfiguration === null ? {} : { defaultConfiguration }),
            configurations: {
              production: { budgets },
              development: { optimization: false },
            },
          },
        },
      },
    },
  });

describe('raiseInitialBudget', () => {
  it('uses the warning and error budgets ng new writes', () => {
    expect(NG_NEW_INITIAL_WARNING).toBe('500kB');
    expect(RAISED_INITIAL_WARNING).toBe('850kB');
  });

  it('raises the warning of the initial budget of a new app', () => {
    const result = raiseInitialBudget(ngNewWorkspace(), 'shop');

    expect(JSON.parse(result ?? 'null').projects.shop).toEqual({
      projectType: 'application',
      sourceRoot: 'src',
      architect: {
        build: {
          defaultConfiguration: 'production',
          configurations: {
            production: {
              budgets: [
                {
                  type: 'initial',
                  maximumWarning: '850kB',
                  maximumError: '1MB',
                },
                {
                  type: 'anyComponentStyle',
                  maximumWarning: '4kB',
                  maximumError: '8kB',
                },
              ],
            },
            development: { optimization: false },
          },
        },
      },
    });
  });

  it('leaves a customized initial budget alone', () => {
    const text = ngNewWorkspace([
      { type: 'initial', maximumWarning: '600kB', maximumError: '1MB' },
    ]);

    expect(raiseInitialBudget(text, 'shop')).toBeNull();
  });

  it('leaves the budget alone when the threshold differs in case', () => {
    const text = ngNewWorkspace([
      { type: 'initial', maximumWarning: '500kb', maximumError: '1MB' },
    ]);

    expect(raiseInitialBudget(text, 'shop')).toBeNull();
  });

  it('changes nothing when the configuration has no initial budget', () => {
    const text = ngNewWorkspace([
      { type: 'anyComponentStyle', maximumWarning: '4kB', maximumError: '8kB' },
    ]);

    expect(raiseInitialBudget(text, 'shop')).toBeNull();
  });

  it('changes nothing without a default configuration', () => {
    expect(
      raiseInitialBudget(ngNewWorkspace(undefined, null), 'shop'),
    ).toBeNull();
  });

  it('changes nothing for an unknown project', () => {
    expect(raiseInitialBudget(ngNewWorkspace(), 'other')).toBeNull();
  });

  it('changes nothing for invalid JSON', () => {
    expect(raiseInitialBudget('{', 'shop')).toBeNull();
  });
});
