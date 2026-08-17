import { fileURLToPath } from 'node:url';

/**
 * Module directories searched before the usual walk up the tree.
 *
 * pnpm's hoisted linker keeps one copy of a package per version at the repository root
 * and gives every workspace that pins a different version a physical copy of its own.
 * When `packages/ui` pinned React 19.2.0 and the apps ran 19.2.3, its source — which this
 * app transpiles — resolved `react` to that private copy. Two React instances in one tree
 * means every hook reads a null dispatcher, and the build died while prerendering with
 * "Cannot read properties of null (reading 'useRef')".
 *
 * Every workspace now pins the same version, so there is exactly one copy at the root.
 * This stays as a guard: listing the app's and the workspace root's `node_modules` first
 * makes every bare specifier land on the same copy even if the versions drift again.
 * Unlike an alias it still goes through normal package resolution, so React's
 * `react-server` export condition keeps working for the server components layer.
 */
const PREFERRED_MODULES = [
  fileURLToPath(new URL('node_modules', import.meta.url)),
  fileURLToPath(new URL('../../node_modules', import.meta.url)),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The workspace packages ship TypeScript source, not a build artefact.
  transpilePackages: ['@lexipulse/core', '@lexipulse/pdf', '@lexipulse/ui'],
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['framer-motion'],
  },
  /**
   * `@lexipulse/core` and `@lexipulse/ui` are TypeScript sources that import each other
   * with explicit `.js` specifiers, the way Node's ESM resolver wants them. TypeScript
   * maps those back to `.ts` on its own; webpack does not, and reports every one of them
   * as a missing module. This alias teaches it the same mapping.
   */
  webpack(config) {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    config.resolve.modules = [
      ...PREFERRED_MODULES,
      ...(config.resolve.modules ?? ['node_modules']),
    ];
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
