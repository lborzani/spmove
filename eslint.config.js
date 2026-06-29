const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const globals = require('globals');

module.exports = defineConfig([
  ...expoConfig,
  {
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // PanResponder e Animated.Value usam padrões de ref idiomáticos em React Native
      'react-hooks/refs': 'off',
      // setState em effects é válido em debounce e subscriptions
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'android/**', 'ios/**', 'scripts/**'],
  },
]);
