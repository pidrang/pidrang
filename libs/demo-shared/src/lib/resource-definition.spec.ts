import { signal } from '@angular/core';
import { Resource } from '@pidrang/core';

import { resourceSingularTitle, resourceTitle } from './resource-definition';

describe('resourceSingularTitle', () => {
  it('returns the singular label when it is set', () => {
    const title = resourceSingularTitle(
      signal<Resource | undefined>({
        name: 'users',
        label: 'Users',
        labelSingular: 'User',
      }),
    );

    expect(title()).toBe('User');
  });

  it('falls back to the label when no singular label is set', () => {
    const title = resourceSingularTitle(
      signal<Resource | undefined>({ name: 'users', label: 'Users' }),
    );

    expect(title()).toBe('Users');
  });

  it('falls back to the name when no label is set', () => {
    const title = resourceSingularTitle(
      signal<Resource | undefined>({ name: 'users' }),
    );

    expect(title()).toBe('users');
  });
});

describe('resourceTitle', () => {
  it('keeps the plural label even when a singular label is set', () => {
    const title = resourceTitle(
      signal<Resource | undefined>({
        name: 'users',
        label: 'Users',
        labelSingular: 'User',
      }),
    );

    expect(title()).toBe('Users');
  });
});
