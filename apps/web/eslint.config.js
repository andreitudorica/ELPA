// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      'dist',
      'coverage',
      'storybook-static',
      'playwright-report',
      'test-results',
      'public/mockServiceWorker.js',
      'src/app/router/routeTree.gen.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  jsxA11y.flatConfigs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  reactRefresh.configs.vite,

  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js', '*.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'unused-imports': unusedImports,
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: ['tsconfig.app.json', 'tsconfig.node.json'],
          noWarnOnMultipleProjects: true,
        }),
      ],
    },
    rules: {
      // Imports
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/no-cycle': ['error', { maxDepth: 4 }],
      'import-x/no-duplicates': 'error',
      'unused-imports/no-unused-imports': 'error',

      // TypeScript
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // TanStack Router signals redirects/not-found by throwing plain objects.
      '@typescript-eslint/only-throw-error': [
        'error',
        {
          allow: [
            { from: 'package', package: '@tanstack/router-core', name: 'Redirect' },
            { from: 'package', package: '@tanstack/router-core', name: 'NotFoundError' },
          ],
        },
      ],

      // React
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Node-context files (configs, e2e) — no browser globals, relaxed React rules
  {
    files: ['*.config.{js,ts,mjs}', 'e2e/**/*.ts', '.storybook/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // Playwright fixtures use a `use()` callback that trips the React hook rule.
  {
    files: ['e2e/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },

  // Route files export the Route object next to route components by convention.
  {
    files: ['src/app/router/routes/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // Route family boundary (ADR 0015): the anonymous Recommendation Product
  // surface cannot depend on Data Studio route implementations, admin-scoped
  // API namespaces, or the identity boundary. The API is the enforcer of
  // authorization; this rule prevents accidental client-side coupling.
  {
    files: ['src/app/router/routes/_public/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/app/router/routes/studio/**',
                '@/lib/identity',
                '@/lib/identity/**',
                '@/lib/apiClient/generated/studio/**',
              ],
              message:
                'Public (`_public`) routes may not depend on Data Studio routes, the identity boundary, or admin API namespaces (ADR 0015).',
            },
          ],
        },
      ],
    },
  },

  // Symmetric boundary: guarded Data Studio routes must not depend on the
  // Recommendation Product surface. Keeps the two audiences cleanly separated.
  {
    files: ['src/app/router/routes/studio/_authenticated/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/router/routes/_public/**'],
              message:
                'Data Studio routes must not depend on Recommendation Product route implementations (ADR 0015).',
            },
          ],
        },
      ],
    },
  },

  // MSW is a dev/test-only transport mock (ADR 0016). It must never appear
  // in production code paths; keep imports inside the mocks and test scopes.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/mocks/**', 'src/test/**', 'src/**/*.stories.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'msw',
              message:
                'Import from `msw` is restricted to src/mocks/** and src/test/** (ADR 0016).',
            },
            {
              name: 'msw/browser',
              message: 'Import from `msw/browser` is restricted to src/mocks/** (ADR 0016).',
            },
            {
              name: 'msw/node',
              message: 'Import from `msw/node` is restricted to src/mocks/** (ADR 0016).',
            },
          ],
        },
      ],
    },
  },

  // Test files
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },

  // Stories (ADR 0017): the component workshop must remain scoped to
  // components/layouts/theme — no route trees, guards, or feature modules.
  {
    files: ['src/**/*.stories.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/router/**', '@/lib/identity', '@/lib/identity/**', '@/features/**'],
              message:
                'Stories must not depend on route trees, guards, or feature modules (ADR 0017).',
            },
          ],
        },
      ],
    },
  },

  // Plain JS config files: not part of a tsconfig, so no type-aware rules.
  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',
    },
  },

  eslintConfigPrettier,
);
