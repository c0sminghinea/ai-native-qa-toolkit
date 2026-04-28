// @ts-check
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'playwright-report/**', 'test-results/**', 'runs/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  // Architectural invariant: the toolkit core (ai-tools/**) is target-agnostic
  // and MUST NOT depend on any bundled example pack. Example packs live under
  // tests/examples/** and import FROM ai-tools, never the other way around.
  // See docs/architecture.md ("Architectural Invariants").
  {
    files: ['ai-tools/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/tests/examples/**', '../tests/examples/**', '../../tests/examples/**'],
              message:
                'ai-tools/** must not import from tests/examples/**. The toolkit core is target-agnostic — example packs depend on the toolkit, not the other way around. See docs/architecture.md.',
            },
          ],
        },
      ],
    },
  },
];
