module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import', 'prettier'],
  globals: {
    window: 'writable',
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'airbnb-base',
    'prettier/@typescript-eslint',
    'plugin:prettier/recommended',
  ],
  overrides: [
    {
      files: ['**/*.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
  env: {
    es6: true,
    node: true,
    jest: true,
  },
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-use-before-define': 2,
    'no-use-before-define': 'off',
    'import/no-unresolved': 'off',
    'import/prefer-default-export': 'off',
    'no-underscore-dangle': 'off',
    'no-console': 'off',
    camelcase: 'off',
    'prettier/prettier': 'error',
    '@typescript-eslint/camelcase': 'off',
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        jsx: 'never',
        ts: 'never',
        tsx: 'never',
      },
    ],
    '@typescript-eslint/ban-ts-ignore': 'off',
    'max-classes-per-file': 'off',
  },
  settings: {
    'import/resolver': {
      alias: {
        map: ['src', './src'],
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      },
      node: {
        map: ['src', './src'],
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
}
