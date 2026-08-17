/**
 * Copy pdf.js out of the installed package into `public/pdfjs/`.
 *
 * Three kinds of file, all for the same reason: they must come from our own origin.
 *
 * - `cmaps` and `standard_fonts` are what pdf.js fetches at render time for CJK encodings
 *   and the fourteen standard font programs. Its defaults point at a CDN, and a reader who
 *   opens a document must not cause a request to a third party.
 * - `pdf.mjs` and `pdf.worker.mjs` are the library itself. It is loaded as a real ES module
 *   by the browser rather than bundled: pdf.js ships one 2 MB `.mjs` file in a package
 *   without `"type": "module"`, and webpack's interop for that combination breaks in
 *   development — the module factory receives no exports object and the import dies on the
 *   first line. Loading it by URL sidesteps the bundler entirely, behaves identically in
 *   development and production, and keeps two megabytes out of every build.
 *
 * Run from `prebuild`/`predev`, so the copy can never drift from the installed version.
 */

import { copyFile, cp, mkdir, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json'));
const target = join(process.cwd(), 'public', 'pdfjs');

const DIRECTORIES = ['cmaps', 'standard_fonts'];
const FILES = ['build/pdf.mjs', 'build/pdf.worker.mjs'];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

await mkdir(target, { recursive: true });

for (const name of DIRECTORIES) {
  const from = join(pdfjsRoot, name);
  if (!(await exists(from))) {
    console.error(`pdfjs assets: ${name} not found in ${pdfjsRoot}`);
    process.exit(1);
  }
  const to = join(target, name);
  await rm(to, { recursive: true, force: true });
  await cp(from, to, { recursive: true });
  console.warn(`pdfjs assets: ${name} → public/pdfjs/${name}`);
}

for (const path of FILES) {
  const from = join(pdfjsRoot, path);
  if (!(await exists(from))) {
    console.error(`pdfjs assets: ${path} not found in ${pdfjsRoot}`);
    process.exit(1);
  }
  const name = path.split('/').pop();
  await copyFile(from, join(target, name));
  console.warn(`pdfjs assets: ${path} → public/pdfjs/${name}`);
}
