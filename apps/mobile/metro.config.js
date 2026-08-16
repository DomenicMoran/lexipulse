// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('node:path');
const fs = require('node:fs');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// `@lexipulse/core` and `@lexipulse/ui` are consumed as TypeScript source, so Metro has
// to watch the whole monorepo — otherwise an edit in packages/ never triggers a rebuild.
config.watchFolders = [workspaceRoot];

// The repo pins `node-linker=hoisted`, so almost everything lives in the root store and
// only the workspace links sit in apps/mobile/node_modules. Both have to be searched.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Hierarchical lookup stays on (Expo's default): with a hoisted store, walking up from a
// workspace package to the root `node_modules` is exactly how its dependencies are found.

// The workspace packages declare `"exports"` maps that point straight at .ts files.
config.resolver.unstable_enablePackageExports = true;

// The pdf.js bridge page is shipped as a file, not as a string in the JS bundle: 1.4 MB
// of inlined source would be parsed on every cold start for a feature most sessions
// never touch.
config.resolver.assetExts = [...config.resolver.assetExts, 'html'];

/**
 * `@lexipulse/core` is written for NodeNext-style ESM: every relative import carries a
 * `.js` suffix even though the file on disk is `.ts`. TypeScript rewrites that at compile
 * time; Metro does not, and would fail on `./types.js`. Retry those specifiers against the
 * real extensions instead of forcing the shared package to change for one consumer.
 */
const TS_EXTENSIONS = ['.ts', '.tsx'];

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  try {
    return resolve(context, moduleName, platform);
  } catch (error) {
    if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
      const base = moduleName.slice(0, -3);
      for (const ext of TS_EXTENSIONS) {
        const candidate = path.resolve(path.dirname(context.originModulePath), base + ext);
        if (fs.existsSync(candidate)) {
          return { type: 'sourceFile', filePath: candidate };
        }
      }
    }
    throw error;
  }
};

module.exports = config;
