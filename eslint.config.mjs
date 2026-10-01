import nx from '@nx/eslint-plugin';

const noComments = {
  meta: {
    type: 'problem',
    messages: { comment: 'Comments are not allowed in Pidrang sources.' },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type !== 'Shebang') {
            context.report({ loc: comment.loc, messageId: 'comment' });
          }
        }
      },
    };
  },
};

const moduleBoundaries = {
  allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
  depConstraints: [
    {
      sourceTag: '*',
      onlyDependOnLibsWithTags: ['*'],
    },
  ],
};

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/vitest.config.*.timestamp*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      '@nx/enforce-module-boundaries': [
        'error',
        { ...moduleBoundaries, enforceBuildableLibDependency: true },
      ],
    },
  },
  {
    files: ['**/*.conformance.spec.ts'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        { ...moduleBoundaries, enforceBuildableLibDependency: false },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    plugins: { pidrang: { rules: { 'no-comments': noComments } } },
    rules: {
      'pidrang/no-comments': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
