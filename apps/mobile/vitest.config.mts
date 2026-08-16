import { defineConfig } from 'vitest/config';

/**
 * Only the pure modules are covered here.
 *
 * Anything that touches a native module cannot run under Node, and mocking Expo's
 * surface to assert on the mock proves nothing. The logic that is genuinely worth
 * testing — the base64 encoder the PDF bridge depends on, and the URL heuristics — was
 * deliberately kept free of native imports so it can be tested for real.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
