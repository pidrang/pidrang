import { generateResourceRoutesFile } from '@pidrang/cli';
import { existingSignedInGuards } from './existing-signed-in-guards';

describe('existingSignedInGuards', () => {
  it('reads the guarded tables of resource routes init wrote', () => {
    const content = generateResourceRoutesFile(true, [
      'products',
      'staff_notes',
    ]).content;

    expect(existingSignedInGuards(content, true)).toEqual([
      'products',
      'staff_notes',
    ]);
  });

  it('reads no guard from unguarded resource routes init wrote', () => {
    expect(
      existingSignedInGuards(generateResourceRoutesFile(false).content, false),
    ).toEqual([]);
  });

  it('reads a name holding a closing bracket', () => {
    const content = generateResourceRoutesFile(true, [
      'items]archive',
      'notes',
    ]).content;

    expect(existingSignedInGuards(content, true)).toEqual([
      'items]archive',
      'notes',
    ]);
  });

  it('reads a name holding a quote', () => {
    const content = generateResourceRoutesFile(true, ["o'clock"]).content;

    expect(existingSignedInGuards(content, true)).toEqual(["o'clock"]);
  });

  it('reads Windows line endings like the file init wrote', () => {
    const content = generateResourceRoutesFile(true, [
      'products',
    ]).content.replace(/\n/g, '\r\n');

    expect(existingSignedInGuards(content, true)).toEqual(['products']);
  });

  it('reads resource routes a formatter turned to double quotes', () => {
    const content = generateResourceRoutesFile(true, [
      'products',
      "o'clock",
    ]).content.replace(/'((?:[^'\\]|\\.)*)'/g, (_, body: string) =>
      JSON.stringify(body.replace(/\\'/g, "'")),
    );
    expect(content).not.toContain("'products'");

    expect(existingSignedInGuards(content, true)).toEqual([
      'products',
      "o'clock",
    ]);
  });

  it.each([
    [
      'edited by hand',
      `${generateResourceRoutesFile(true, ['products']).content}// mine\n`,
      true,
    ],
    [
      'written for the other sign-in route choice',
      generateResourceRoutesFile(true, ['products']).content,
      false,
    ],
    ['not written by init', 'export const resourceRoutes = [];\n', true],
  ])('refuses resource routes %s', (_, content, signInRoute) => {
    expect(existingSignedInGuards(content, signInRoute)).toBeNull();
  });
});
