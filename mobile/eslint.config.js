// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Type safety is a hard requirement across the project: no `any` leaks.
    // Scoped to TS files — the @typescript-eslint plugin is registered by
    // eslint-config-expo for these globs only.
    files: ['**/*.ts', '**/*.tsx', '**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    ignores: ["dist/*"],
  }
]);
