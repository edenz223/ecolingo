module.exports = {
  root: true,

  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 2021,
  },

  env: {
    node: true,
    browser: true,
  },

  extends: ['plugin:vue/vue3-essential', 'prettier'],

  plugins: ['vue'],

  overrides: [
    {
      files: ['**/*.ts'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      },
    },
  ],

  rules: {
    'prefer-promise-reject-errors': 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
  },
};
