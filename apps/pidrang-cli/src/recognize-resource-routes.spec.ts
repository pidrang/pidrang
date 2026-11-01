import { generateResourceRoutesFile } from '@pidrang/cli';
import { recognizeResourceRoutes } from './recognize-resource-routes';

function doubleQuoted(content: string): string {
  return content.replace(/'((?:[^'\\]|\\.)*)'/g, (_, body: string) =>
    JSON.stringify(body.replace(/\\'/g, "'")),
  );
}

describe('recognizeResourceRoutes', () => {
  it.each([true, false])(
    'reads the guarded tables of resource routes init wrote (sign-in route: %s)',
    (signIn) => {
      const content = generateResourceRoutesFile(signIn, [
        'products',
        'staff_notes',
      ]).content;

      expect(recognizeResourceRoutes(content)).toEqual({
        signIn,
        guards: ['products', 'staff_notes'],
      });
    },
  );

  it.each([true, false])(
    'reads no guard from unguarded resource routes init wrote (sign-in route: %s)',
    (signIn) => {
      expect(
        recognizeResourceRoutes(generateResourceRoutesFile(signIn).content),
      ).toEqual({ signIn, guards: [] });
    },
  );

  it('reads a name holding a closing bracket', () => {
    const content = generateResourceRoutesFile(true, [
      'items]archive',
      'notes',
    ]).content;

    expect(recognizeResourceRoutes(content)?.guards).toEqual([
      'items]archive',
      'notes',
    ]);
  });

  it('reads a name holding a quote', () => {
    const content = generateResourceRoutesFile(true, ["o'clock"]).content;

    expect(recognizeResourceRoutes(content)?.guards).toEqual(["o'clock"]);
  });

  it.each([true, false])(
    'reads Windows line endings like the file init wrote (sign-in route: %s)',
    (signIn) => {
      const content = generateResourceRoutesFile(signIn, [
        'products',
      ]).content.replace(/\n/g, '\r\n');

      expect(recognizeResourceRoutes(content)).toEqual({
        signIn,
        guards: ['products'],
      });
    },
  );

  it.each([true, false])(
    'reads resource routes a formatter turned to double quotes (sign-in route: %s)',
    (signIn) => {
      const content = doubleQuoted(
        generateResourceRoutesFile(signIn, ['products', "o'clock"]).content,
      );
      expect(content).not.toContain("'products'");

      expect(recognizeResourceRoutes(content)).toEqual({
        signIn,
        guards: ['products', "o'clock"],
      });
    },
  );

  it.each([
    [
      'edited by hand',
      `${generateResourceRoutesFile(true, ['products']).content}// mine\n`,
    ],
    [
      'edited by hand, without the sign-in route',
      `${generateResourceRoutesFile(false, ['products']).content}// mine\n`,
    ],
    [
      'whose sign-in route was changed',
      generateResourceRoutesFile(true).content.replace(
        "path: 'sign-in'",
        "path: 'login'",
      ),
    ],
    ['not written by init', 'export const resourceRoutes = [];\n'],
  ])('refuses resource routes %s', (_, content) => {
    expect(recognizeResourceRoutes(content)).toBeNull();
  });
});
