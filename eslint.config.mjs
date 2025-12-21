import js from '@eslint/js';

export default [
  {
    ignores: [
      'public/sw.js',
      'public/workbox-*.js',
      'node_modules/**',
      '.next/**',
      'out/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'warn',
      'prefer-const': 'warn',
      'no-var': 'warn',
    },
  },
];
