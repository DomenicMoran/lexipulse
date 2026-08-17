import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * The hook rules are not optional here.
 *
 * This package is almost entirely hooks over a canvas, and the same ruleset in the web app
 * caught three real defects while it was being written: state set from an effect that made
 * the wrong document flash on screen, a stale bitmap left stretched during a zoom, and a
 * page number that lagged the scroll by a frame.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.turbo/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);
