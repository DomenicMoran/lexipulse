'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { ChartIcon, LibraryIcon, TextIcon } from '@/components/icons';
import { Wordmark } from '@/components/wordmark';

const TABS = [
  { href: '/reader', label: 'Lesen', Icon: TextIcon },
  { href: '/reader/library', label: 'Bibliothek', Icon: LibraryIcon },
  { href: '/reader/stats', label: 'Statistik', Icon: ChartIcon },
];

export function ReaderNav({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--lx-border)] bg-[var(--lx-bg)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-5">
        <Link href="/" className="hidden rounded-[6px] text-[15px] font-semibold sm:block">
          <Wordmark />
        </Link>

        <nav aria-label="Reader-Bereiche" className="flex items-center gap-1">
          {TABS.map(({ href, label, Icon }) => {
            const active = href === '/reader' ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={
                  'inline-flex h-9 items-center gap-2 rounded-[8px] px-3 text-[14px] transition-colors duration-140 ' +
                  (active
                    ? 'bg-[var(--lx-surface-hover)] text-[var(--lx-text)]'
                    : 'text-[var(--lx-text-muted)] hover:text-[var(--lx-text)]')
                }
              >
                <Icon width={16} height={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">{children}</div>
      </div>
    </header>
  );
}
