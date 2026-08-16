import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main
        id="inhalt"
        className="mx-auto flex max-w-xl flex-col items-center gap-6 px-5 py-32 text-center"
      >
        <span
          className="font-mono text-[61px] leading-none tracking-[-0.03em] text-[var(--lx-accent)]"
        >
          404
        </span>
        <h1 className="text-[25px] font-semibold tracking-[-0.015em]">Seite nicht gefunden</h1>
        <p className="max-w-[46ch] text-[16px] leading-relaxed text-[var(--lx-text-muted)]">
          Diese Adresse führt ins Leere. Von hier kommen Sie zurück zur Startseite oder
          direkt in den Reader.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-[10px] border border-[var(--lx-border)] bg-[var(--lx-surface)] px-5 text-[15px]"
          >
            Zur Startseite
          </Link>
          <Link
            href="/reader"
            className="inline-flex h-11 items-center rounded-[10px] bg-[var(--lx-accent)] px-5 text-[15px] font-medium text-[var(--lx-accent-on)]"
          >
            Zum Reader
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
