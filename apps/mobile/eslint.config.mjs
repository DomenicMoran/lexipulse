import expo from 'eslint-config-expo/flat.js';
import tseslint from 'typescript-eslint';

/**
 * ESLint 9 flat config for the Expo app.
 *
 * `eslint-config-expo/flat` brings the React, React Native and import rules that match
 * the Metro resolver; without it a bare TypeScript config passes while missing the rules
 * that actually catch native-specific mistakes.
 */
const config = [
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'android/**',
      'ios/**',
      '.turbo/**',
      'expo-env.d.ts',
      // Generated bundle: 1.4 MB of pdf.js, built by scripts/build-pdf-bridge.mjs.
      'assets/pdfjs/**',
    ],
  },
  ...expo,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Build scripts and native config are CommonJS running under Node, not app code.
    // `no-undef` also has to go: it has no idea what a TypeScript or Node global is and
    // reports `require`, `module` and `__dirname` as undefined.
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: { require: 'readonly', module: 'writable', __dirname: 'readonly', process: 'readonly', console: 'readonly', Buffer: 'readonly' },
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-named-as-default-member': 'off',
    },
  },
  {
    /*
     * Reanimated and Gesture Handler do not fit the React Compiler's model.
     *
     * `react-hooks/refs` fires on the gesture callbacks built inside `useMemo`, because
     * the compiler cannot prove they are not invoked during render — they are not, they
     * run on the UI thread when a finger moves. `react-hooks/immutability` fires on
     * `sharedValue.value = x`, which is the only way to drive a shared value at all.
     *
     * Scoped to the three files that actually own gestures, so the rules keep working
     * everywhere else. `feedback.ts` was a real violation and got fixed rather than
     * silenced.
     */
    files: ['src/components/swipe.tsx', 'src/components/ui.tsx', 'src/player/scrubber.tsx'],
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
    },
  },
  {
    /*
     * Loading the library on mount. The rule reads `void refresh()` as a synchronous
     * setState, but `refresh` awaits IndexedDB/SQLite first, so the state update lands in
     * a promise callback a tick later. There is no cascading render to avoid here.
     */
    files: ['src/state/library.tsx'],
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
];

export default config;
