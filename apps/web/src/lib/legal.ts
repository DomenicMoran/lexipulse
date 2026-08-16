import { LEGAL_SOURCES, type LegalSlug } from '@/generated/legal';
import { renderMarkdown, type MarkdownDocument } from './markdown';

/**
 * The legal texts are authored once in `store/legal` and shipped to the stores from
 * there. The website renders the same files, so the published page and the submitted
 * version cannot drift apart.
 *
 * They arrive through a generated module rather than `readFileSync`, because a file
 * outside the module graph does not invalidate Next's build cache: the imprint changed,
 * the build succeeded, and the site quietly kept serving the previous text.
 * `scripts/generate-legal.mjs` runs before every build.
 */
export type { LegalSlug };

export function loadLegal(slug: LegalSlug): MarkdownDocument {
  return renderMarkdown(LEGAL_SOURCES[slug]);
}
