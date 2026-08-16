import * as React from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { loadLegal, type LegalSlug } from '@/lib/legal';

const UPDATED = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

function formatUpdated(iso: string): string | null {
  const timestamp = Date.parse(iso);
  return Number.isNaN(timestamp) ? null : UPDATED.format(new Date(timestamp));
}

/**
 * Renders one of the three legal documents.
 *
 * The Markdown is read from `store/legal` and converted at build time, so the page ships
 * as static HTML — no client-side Markdown parser, no runtime file access.
 */
export function LegalPage({ slug }: { slug: LegalSlug }) {
  const document = loadLegal(slug);
  const updated = formatUpdated(document.updated);

  return (
    <>
      <SiteHeader />
      <main id="inhalt" className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <article className="lx-prose">
          <h1>{document.title}</h1>
          {updated && (
            <p className="-mt-6 mb-10 text-[14px] text-[var(--lx-text-muted)]">
              Stand: {updated}
            </p>
          )}
          {/* The source is a file in this repository, converted by our own renderer,
              which escapes every character before emitting a single tag. */}
          <div dangerouslySetInnerHTML={{ __html: document.html }} />
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
