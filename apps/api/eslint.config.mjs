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
          allowDefaultProject: ['*.js', '*.mjs'],
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

  eslintConfigPrettier,
);
