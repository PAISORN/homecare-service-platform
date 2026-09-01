import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tsParser },
    rules: { 'no-undef': 'off', 'no-unused-vars': 'error' },
  },
];
