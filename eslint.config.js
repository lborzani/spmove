const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
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
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'android/**', 'ios/**', 'scripts/**'],
  },
]);
