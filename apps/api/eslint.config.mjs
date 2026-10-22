// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * ESLint flat config for @elpa/api. Mirrors the strict + type-checked
 * posture from @elpa/web but omits browser/React plugins.
 */
const domainModules = ['access', 'audit', 'catalog', 'curation', 'recommendation', 'research'];
const toolingSchemaRestriction = {
  group: ['**/drizzle/schema', '**/drizzle/schema.*'],
  message: 'The aggregate schema is for drizzle-kit only; import tables from their owner.',
};

/** Barrel-only imports between domain modules, plus the tooling schema restriction. */
const domainPatterns = (owner) => [
  toolingSchemaRestriction,
  ...domainModules
    .filter((target) => target !== owner)
    .map((target) => ({
      group: [`**/${target}/**`, `!**/${target}/index`, `!**/${target}/index.ts`],
      message: 'Import another domain module through its public barrel.',
    })),
];

export default defineConfig(
  {
    ignores: ['dist', 'coverage', '.turbo', '*.tsbuildinfo'],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js', '*.mjs', '*.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Nest decorators frequently declare types that appear "unused" to
      // static analysis; suppress via convention (underscore prefix).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Nest `@Module()` and similar produce classes whose only purpose
      // is to carry metadata for the DI container. Allow classes when a
      // decorator gives them meaning.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },

  {
    files: ['src/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [toolingSchemaRestriction] }] },
  },

  ...domainModules.map((owner) => ({
    files: [`src/${owner}/**/*.ts`],
    rules: {
      'no-restricted-imports': ['error', { patterns: domainPatterns(owner) }],
    },
  })),

  {
    // Rule options replace rather than merge, so the Curation barrel rules are repeated.
    files: ['src/curation/verification/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...domainPatterns('curation'),
            {
              group: [
                '@nestjs/*',
                'drizzle-orm',
                'drizzle-orm/*',
                '@anthropic-ai/*',
                '**/database',
                '**/database/**',
                '**/*.schema',
                '**/*.repository',
                '**/*.service',
              ],
              message:
                'Verification policy logic stays independent of framework, persistence and model providers.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['src/{audit,curation,research}/*.schema.ts'],
    rules: {
      // Drizzle needs the referenced table objects to declare physical foreign keys.
      'no-restricted-imports': ['error', { patterns: [toolingSchemaRestriction] }],
    },
  },

  eslintConfigPrettier,
);
