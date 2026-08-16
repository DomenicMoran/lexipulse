import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderMarkdown, type MarkdownDocument } from './markdown';

/**
 * The legal texts are authored once in `store/legal` and shipped to the stores from
 * there. The website reads the same files at build time instead of keeping a second
 * copy that would quietly drift out of sync with the submitted version.
 */
const LEGAL_DIR = join(process.cwd(), '..', '..', 'store', 'legal');

export type LegalSlug = 'impressum' | 'datenschutz' | 'agb';

const FILES: Record<LegalSlug, string> = {
  impressum: 'impressum.de.md',
  datenschutz: 'datenschutz.de.md',
  agb: 'agb.de.md',
};

export function loadLegal(slug: LegalSlug): MarkdownDocument {
  return renderMarkdown(readFileSync(join(LEGAL_DIR, FILES[slug]), 'utf8'));
}
