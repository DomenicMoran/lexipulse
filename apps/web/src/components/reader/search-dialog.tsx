'use client';

import {
  searchTokens,
  type DocumentChapter,
  type RsvpToken,
  type SearchHit,
} from '@lexipulse/core';
import { IconButton } from '@lexipulse/ui';
import * as React from 'react';
import { CloseIcon, type IconProps } from '@/components/icons';
import { formatNumber } from '@/lib/format';

/** The magnifier, drawn to the same hairline grid as the rest of the set. */
export const SearchIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={18}
    height={18}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

/** Below this the result list is noise: two letters already match half the book. */
const MIN_QUERY = 2;

/**
 * Full-text search over the open document.
 *
 * The matching lives in core (`searchTokens`), so this dialog behaves exactly like the
 * one on the phone — including the diacritic folding that lets someone type "fur" and
 * find "für", which is what readers type when they are in a hurry.
 */
export function SearchDialog({
  tokens,
  chapters,
  onSelect,
  onClose,
}: {
  tokens: RsvpToken[];
  chapters: DocumentChapter[];
  onSelect: (tokenIndex: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /*
   * The field keeps the typed value, the scan runs on the value React hands over when it
   * has time. Without this every keystroke walked a whole book before the letter appeared
   * on screen — at 400 000 tokens that is a visibly stuttering input.
   */
  const deferred = React.useDeferredValue(query);
  const hits = React.useMemo(() => {
    const needle = deferred.trim();
    if (needle.length < MIN_QUERY) return [];
    return searchTokens(tokens, needle, { limit: 120 });
  }, [tokens, deferred]);

  const trimmed = query.trim();
  const stale = query !== deferred;
  const searched = deferred.trim().length >= MIN_QUERY;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--lx-overlay)] p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lx-search-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
          }
        }}
        className="flex max-h-full w-full max-w-xl flex-col rounded-[14px] border border-[var(--lx-border-strong)] bg-[var(--lx-surface)] shadow-[0_16px_48px_rgba(0,0,0,0.36)]"
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-4">
          <div className="min-w-0 flex-1">
            <h2 id="lx-search-title" className="text-[17px] font-semibold tracking-[-0.015em]">
              Im Dokument suchen
            </h2>
            <label htmlFor="lx-search-input" className="sr-only">
              Suchbegriff
            </label>
            <input
              id="lx-search-input"
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Wort oder Wendung"
              autoComplete="off"
              spellCheck={false}
              className="mt-3 h-10 w-full rounded-[10px] border border-[var(--lx-border)] bg-[var(--lx-bg)] px-3 text-[15px] text-[var(--lx-text)] outline-none placeholder:text-[var(--lx-text-faint)] focus-visible:border-[var(--lx-accent)]"
            />
          </div>
          <IconButton label="Suche schließen" variant="ghost" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>

        <p aria-live="polite" className="px-5 pb-3 text-[13px] text-[var(--lx-text-muted)]">
          {trimmed.length > 0 && trimmed.length < MIN_QUERY
            ? 'Mindestens zwei Zeichen eingeben.'
            : searched
              ? hits.length === 1
                ? '1 Treffer'
                : `${formatNumber(hits.length)} Treffer`
              : 'Groß- und Kleinschreibung sowie Umlaute spielen keine Rolle.'}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--lx-border)]">
          {searched && hits.length === 0 ? (
            <p className="px-5 py-6 text-[14px] text-[var(--lx-text-muted)]">
              Keine Fundstelle für „{deferred.trim()}“.
            </p>
          ) : (
            <ul
              // The stale list stays readable and stays clickable while the next scan is
              // pending; blanking it would make every keystroke flash the panel empty.
              className={stale ? 'opacity-60 transition-opacity duration-140' : undefined}
            >
              {hits.map((hit, position) => (
                <li key={`${hit.tokenIndex}-${position}`}>
                  <Hit
                    hit={hit}
                    chapter={chapters[hit.chapterIndex]?.title ?? null}
                    onSelect={onSelect}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** One result: the surrounding words with the match itself picked out. */
function Hit({
  hit,
  chapter,
  onSelect,
}: {
  hit: SearchHit;
  chapter: string | null;
  onSelect: (tokenIndex: number) => void;
}) {
  const at = hit.previewOffset;
  const before = hit.preview.slice(0, at);
  const match = hit.preview.slice(at, at + hit.matchLength);
  const after = hit.preview.slice(at + hit.matchLength);

  return (
    <button
      type="button"
      onClick={() => onSelect(hit.tokenIndex)}
      className="w-full border-b border-[var(--lx-border)] px-5 py-3 text-left transition-colors duration-140 hover:bg-[var(--lx-surface-hover)]"
    >
      <span className="block text-[12px] text-[var(--lx-text-faint)]">
        {chapter ?? `Kapitel ${hit.chapterIndex + 1}`}
      </span>
      <span className="mt-0.5 block text-[14px] leading-relaxed text-[var(--lx-text-muted)]">
        {before}
        <mark className="rounded-[3px] bg-[var(--lx-accent-soft)] px-[2px] font-semibold text-[var(--lx-accent-text)]">
          {match}
        </mark>
        {after}
      </span>
    </button>
  );
}
