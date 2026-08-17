'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist';
import * as React from 'react';
import { formatNumber } from '@/lib/format';
import {
  readOutline,
  searchPdf,
  type OutlineEntry,
  type PageSize,
  type SearchHit,
} from './pdf-doc';
import { PdfPage } from './pdf-page';

/**
 * The original surface: the PDF as its author laid it out.
 *
 * Scrolling is virtualised by arithmetic rather than by a library. Every page's box is in
 * the document from the start — the sizes are known before anything is drawn — so the
 * scrollbar is the right length immediately and never jumps. Only the pages within a
 * screen of the viewport actually get a canvas.
 */

/** Space between pages, in CSS pixels. */
const PAGE_GAP = 16;
/** Padding inside the scroller, so a fit-width page is not glued to the edge. */
const SCROLLER_PADDING = 16;
/** Screens' worth of pages drawn above and below the visible area. */
const OVERSCAN_SCREENS = 0.75;

/** One shared empty result, so "no hits" keeps its identity between renders. */
const NO_HITS: SearchHit[] = [];

export type ZoomMode = 'fit-width' | 'fit-page' | 'fixed';

export interface PdfViewerHandle {
  goToPage(page: number): void;
  currentPage(): number;
}

export interface PdfViewerProps {
  doc: PDFDocumentProxy;
  sizes: PageSize[];
  onPageSize: (pageNumber: number, size: PageSize) => void;
  /** 1-based page the viewer should open on. */
  initialPage?: number;
  onPageChange?: (page: number) => void;
  /** Rendered inside each page box, on top of the canvas. */
  pageOverlay?: (pageNumber: number, geometry: PageGeometry) => React.ReactNode;
  /** Extra controls for the toolbar's right-hand side. */
  toolbarExtra?: React.ReactNode;
  /** Shown above the page list — the editing toolbar lives here. */
  banner?: React.ReactNode;
}

export interface PageGeometry {
  size: PageSize;
  scale: number;
  rotation: number;
}

export const PdfViewer = React.forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer(
  { doc, sizes, onPageSize, initialPage = 1, onPageChange, pageOverlay, toolbarExtra, banner },
  ref,
) {
  const scroller = React.useRef<HTMLDivElement | null>(null);

  const [zoomMode, setZoomMode] = React.useState<ZoomMode>('fit-width');
  const [fixedScale, setFixedScale] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [invert, setInvert] = React.useState(false);
  const [viewport, setViewport] = React.useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = React.useState(0);
  const [sidebar, setSidebar] = React.useState<'none' | 'thumbs' | 'outline'>('none');
  const [outline, setOutline] = React.useState<OutlineEntry[] | null>(null);

  const [query, setQuery] = React.useState('');
  const [search, setSearch] = React.useState<{ query: string; hits: SearchHit[]; done: boolean }>({
    query: '',
    hits: [],
    done: true,
  });
  const [hitIndex, setHitIndex] = React.useState(0);
  const [searchOpen, setSearchOpen] = React.useState(false);

  const turn = ((rotation % 360) + 360) % 360;
  const swapped = turn === 90 || turn === 270;

  /** Widest and tallest page, in points, after rotation. The fit modes measure against it. */
  const extent = React.useMemo(() => {
    let width = 0;
    let height = 0;
    for (const size of sizes) {
      width = Math.max(width, swapped ? size.height : size.width);
      height = Math.max(height, swapped ? size.width : size.height);
    }
    return { width: width || 612, height: height || 792 };
  }, [sizes, swapped]);

  const scale = React.useMemo(() => {
    if (zoomMode === 'fixed') return fixedScale;
    const available = viewport.width - SCROLLER_PADDING * 2;
    if (available <= 0) return 1;
    if (zoomMode === 'fit-width') return available / extent.width;
    const vertical = (viewport.height - SCROLLER_PADDING * 2) / extent.height;
    return Math.min(available / extent.width, vertical);
  }, [zoomMode, fixedScale, viewport, extent]);

  /** Top offset and height of every page box, in CSS pixels. */
  const layout = React.useMemo(() => {
    const offsets: number[] = [];
    const heights: number[] = [];
    let top = SCROLLER_PADDING;
    for (const size of sizes) {
      const height = (swapped ? size.width : size.height) * scale;
      offsets.push(top);
      heights.push(height);
      top += height + PAGE_GAP;
    }
    return { offsets, heights, total: top - PAGE_GAP + SCROLLER_PADDING };
  }, [sizes, scale, swapped]);

  React.useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    setViewport({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, []);

  /**
   * The page under the viewport's upper third — what a reader means by "here".
   *
   * Derived from the scroll offset, never stored: a second copy in state would lag the
   * scroll by a frame and the page number in the toolbar would always be one behind.
   */
  const page = React.useMemo(() => {
    const probe = scrollTop + viewport.height * 0.3;
    let found = 1;
    for (let i = 0; i < layout.offsets.length; i += 1) {
      if ((layout.offsets[i] as number) <= probe) found = i + 1;
      else break;
    }
    return found;
  }, [scrollTop, viewport.height, layout.offsets]);

  React.useEffect(() => {
    onPageChange?.(page);
  }, [page, onPageChange]);

  /** The pages worth drawing: everything the viewport touches, plus the overscan. */
  const range = React.useMemo(() => {
    const margin = Math.max(viewport.height * OVERSCAN_SCREENS, 200);
    const from = scrollTop - margin;
    const to = scrollTop + viewport.height + margin;

    let first = 0;
    let last = 0;
    for (let i = 0; i < layout.offsets.length; i += 1) {
      const top = layout.offsets[i] as number;
      const bottom = top + (layout.heights[i] as number);
      if (bottom < from) continue;
      if (top > to) break;
      if (first === 0) first = i + 1;
      last = i + 1;
    }
    // Before the first measurement nothing is in range; draw the opening page anyway, or
    // the viewer shows an empty scroller until the reader touches it.
    if (first === 0) return { first: 1, last: Math.min(2, layout.offsets.length) };
    return { first, last };
  }, [scrollTop, viewport.height, layout]);

  const goToPage = React.useCallback(
    (target: number) => {
      const element = scroller.current;
      if (!element) return;
      const clamped = Math.min(Math.max(1, Math.round(target)), sizes.length);
      const top = layout.offsets[clamped - 1];
      if (top === undefined) return;
      element.scrollTo({ top: top - SCROLLER_PADDING, behavior: 'auto' });
    },
    [layout.offsets, sizes.length],
  );

  React.useImperativeHandle(ref, () => ({ goToPage, currentPage: () => page }), [goToPage, page]);

  // The opening jump waits for a real layout: before the scroller has been measured every
  // offset is zero and the jump would land on page one.
  const jumped = React.useRef(false);
  React.useEffect(() => {
    if (jumped.current || viewport.height === 0 || initialPage <= 1) return;
    jumped.current = true;
    goToPage(initialPage);
  }, [goToPage, initialPage, viewport.height]);

  React.useEffect(() => {
    if (sidebar !== 'outline' || outline !== null) return;
    void readOutline(doc).then(setOutline);
  }, [sidebar, outline, doc]);

  /* ------------------------------------------------------------------ search */

  /*
   * The result carries the query it belongs to, so "these hits are for what is in the box"
   * is answered during render. Clearing the previous hits from the effect would show the
   * old document's matches highlighted under a new search term for one frame.
   */
  const searchable = query.trim().length >= 2;
  // Memoised for its identity, not its cost: a fresh empty array on every render would
  // rebuild the per-page highlight map and re-render every visible page on every scroll.
  const hits = React.useMemo(
    () => (searchable && search.query === query ? search.hits : NO_HITS),
    [searchable, search, query],
  );
  const searching = searchable && (search.query !== query || !search.done);

  React.useEffect(() => {
    if (!searchable) return;
    const controller = new AbortController();

    // Debounced: every keystroke would otherwise start a walk over the whole document, and
    // on a long book the first letter is still being searched when the last one arrives.
    const timer = window.setTimeout(() => {
      setSearch({ query, hits: [], done: false });
      setHitIndex(0);
      void searchPdf(doc, query, {
        signal: controller.signal,
        onBatch: (batch) => {
          if (controller.signal.aborted) return;
          setSearch((current) =>
            current.query === query ? { ...current, hits: [...current.hits, ...batch] } : current,
          );
        },
      }).finally(() => {
        if (controller.signal.aborted) return;
        setSearch((current) => (current.query === query ? { ...current, done: true } : current));
      });
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [doc, query, searchable]);

  const hitsByPage = React.useMemo(() => {
    const map = new Map<number, number[][]>();
    for (const hit of hits) {
      if (hit.rects.length === 0) continue;
      const existing = map.get(hit.page);
      if (existing) existing.push(...hit.rects);
      else map.set(hit.page, [...hit.rects]);
    }
    return map;
  }, [hits]);

  const gotoHit = React.useCallback(
    (index: number) => {
      const hit = hits[index];
      if (!hit) return;
      setHitIndex(index);
      goToPage(hit.page);
    },
    [hits, goToPage],
  );

  /* ------------------------------------------------------------------ zoom */

  const zoomBy = React.useCallback(
    (factor: number) => {
      setFixedScale((current) => {
        const from = zoomMode === 'fixed' ? current : scale;
        return Math.min(Math.max(from * factor, 0.1), 8);
      });
      setZoomMode('fixed');
    },
    [zoomMode, scale],
  );

  /* ------------------------------------------------------------------ keyboard */

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) {
        if (event.key === 'Escape') (target as HTMLInputElement).blur();
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        if (event.key === '+' || event.key === '=') {
          event.preventDefault();
          zoomBy(1.25);
        } else if (event.key === '-') {
          event.preventDefault();
          zoomBy(0.8);
        } else if (event.key === '0') {
          event.preventDefault();
          setZoomMode('fit-width');
        } else if (event.key.toLowerCase() === 'f') {
          event.preventDefault();
          setSearchOpen(true);
        }
        return;
      }
      switch (event.key) {
        case 'PageDown':
        case 'n':
          event.preventDefault();
          goToPage(page + 1);
          break;
        case 'PageUp':
        case 'p':
          event.preventDefault();
          goToPage(page - 1);
          break;
        case 'Home':
          event.preventDefault();
          goToPage(1);
          break;
        case 'End':
          event.preventDefault();
          goToPage(sizes.length);
          break;
        case '/':
          event.preventDefault();
          setSearchOpen(true);
          break;
        case 'r':
          setRotation((current) => (current + 90) % 360);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToPage, page, sizes.length, zoomBy]);

  /* ------------------------------------------------------------------ render */

  const pages: React.ReactNode[] = [];
  for (let number = 1; number <= sizes.length; number += 1) {
    const size = sizes[number - 1] as PageSize;
    const active = number >= range.first && number <= range.last;
    pages.push(
      <div
        key={number}
        style={{ position: 'absolute', top: `${layout.offsets[number - 1]}px`, left: '50%' }}
        className="-translate-x-1/2"
      >
        <PdfPage
          doc={doc}
          pageNumber={number}
          scale={scale}
          rotation={turn}
          active={active}
          size={size}
          onSize={onPageSize}
          onNavigate={goToPage}
          highlights={hitsByPage.get(number)}
          currentHighlight={hits[hitIndex]?.page === number ? (hits[hitIndex]?.rects[0] ?? null) : null}
          invert={invert}
        >
          {pageOverlay?.(number, { size, scale, rotation: turn })}
        </PdfPage>
      </div>,
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar
        page={page}
        pageCount={sizes.length}
        scale={scale}
        zoomMode={zoomMode}
        invert={invert}
        sidebar={sidebar}
        onPage={goToPage}
        onZoomIn={() => zoomBy(1.25)}
        onZoomOut={() => zoomBy(0.8)}
        onZoomMode={setZoomMode}
        onRotate={() => setRotation((current) => (current + 90) % 360)}
        onInvert={() => setInvert((current) => !current)}
        onSidebar={setSidebar}
        onSearch={() => setSearchOpen((open) => !open)}
        extra={toolbarExtra}
      />

      {banner}

      {searchOpen && (
        <SearchBar
          query={query}
          hits={hits}
          hitIndex={hitIndex}
          searching={searching}
          onQuery={setQuery}
          onGoto={gotoHit}
          onClose={() => {
            setSearchOpen(false);
            setQuery('');
          }}
        />
      )}

      <div className="flex min-h-0 flex-1">
        {sidebar !== 'none' && (
          <aside className="w-[220px] shrink-0 overflow-y-auto border-r border-[var(--lx-border)] bg-[var(--lx-surface)] py-3">
            {sidebar === 'thumbs' ? (
              <Thumbnails
                doc={doc}
                sizes={sizes}
                current={page}
                onSelect={goToPage}
                onSize={onPageSize}
              />
            ) : (
              <Outline entries={outline} current={page} onSelect={goToPage} />
            )}
          </aside>
        )}

        <div
          ref={scroller}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          className="relative min-h-0 flex-1 overflow-auto bg-[var(--lx-bg-deep,#18181b)]"
          tabIndex={0}
          aria-label="Originalseiten"
        >
          <div style={{ position: 'relative', height: `${layout.total}px`, width: '100%' }}>
            {pages}
          </div>
        </div>
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ toolbar */

function Toolbar({
  page,
  pageCount,
  scale,
  zoomMode,
  invert,
  sidebar,
  onPage,
  onZoomIn,
  onZoomOut,
  onZoomMode,
  onRotate,
  onInvert,
  onSidebar,
  onSearch,
  extra,
}: {
  page: number;
  pageCount: number;
  scale: number;
  zoomMode: ZoomMode;
  invert: boolean;
  sidebar: 'none' | 'thumbs' | 'outline';
  onPage: (page: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomMode: (mode: ZoomMode) => void;
  onRotate: () => void;
  onInvert: () => void;
  onSidebar: (value: 'none' | 'thumbs' | 'outline') => void;
  onSearch: () => void;
  extra?: React.ReactNode;
}) {
  /*
   * The box shows what the reader typed while they are typing, and the real page number
   * as soon as the page changes underneath them. Keyed by page rather than synchronised
   * from an effect, so scrolling never fights an edit in progress.
   */
  const [draft, setDraft] = React.useState({ page, text: String(page) });
  const value = draft.page === page ? draft.text : String(page);

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--lx-border)] bg-[var(--lx-surface)] px-3 py-2">
      <ToolButton
        label="Miniaturen"
        pressed={sidebar === 'thumbs'}
        onClick={() => onSidebar(sidebar === 'thumbs' ? 'none' : 'thumbs')}
      >
        ▤
      </ToolButton>
      <ToolButton
        label="Gliederung"
        pressed={sidebar === 'outline'}
        onClick={() => onSidebar(sidebar === 'outline' ? 'none' : 'outline')}
      >
        ☰
      </ToolButton>

      <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--lx-border)]" />

      <ToolButton label="Vorige Seite" onClick={() => onPage(page - 1)} disabled={page <= 1}>
        ‹
      </ToolButton>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const target = Number.parseInt(value, 10);
          if (Number.isFinite(target)) onPage(target);
        }}
        className="flex items-center gap-1"
      >
        <label htmlFor="lx-pdf-page" className="sr-only">
          Seitenzahl
        </label>
        <input
          id="lx-pdf-page"
          value={value}
          onChange={(event) => setDraft({ page, text: event.target.value })}
          onBlur={() => setDraft({ page, text: String(page) })}
          inputMode="numeric"
          className="h-8 w-12 rounded-[6px] border border-[var(--lx-border)] bg-[var(--lx-bg)] px-2 text-center font-mono text-[13px] tabular-nums text-[var(--lx-text)]"
        />
        <span className="font-mono text-[13px] tabular-nums text-[var(--lx-text-muted)]">
          / {formatNumber(pageCount)}
        </span>
      </form>
      <ToolButton
        label="Nächste Seite"
        onClick={() => onPage(page + 1)}
        disabled={page >= pageCount}
      >
        ›
      </ToolButton>

      <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--lx-border)]" />

      <ToolButton label="Verkleinern" onClick={onZoomOut}>
        −
      </ToolButton>
      <span className="min-w-[46px] text-center font-mono text-[12px] tabular-nums text-[var(--lx-text-muted)]">
        {Math.round(scale * 100)} %
      </span>
      <ToolButton label="Vergrößern" onClick={onZoomIn}>
        +
      </ToolButton>
      <ToolButton
        label="Seitenbreite"
        pressed={zoomMode === 'fit-width'}
        onClick={() => onZoomMode('fit-width')}
      >
        ↔
      </ToolButton>
      <ToolButton
        label="Ganze Seite"
        pressed={zoomMode === 'fit-page'}
        onClick={() => onZoomMode('fit-page')}
      >
        ⤢
      </ToolButton>
      <ToolButton label="Drehen" onClick={onRotate}>
        ⟳
      </ToolButton>
      <ToolButton label="Dunkel darstellen" pressed={invert} onClick={onInvert}>
        ◐
      </ToolButton>
      <ToolButton label="Im Original suchen" onClick={onSearch}>
        ⌕
      </ToolButton>

      {extra && <div className="ml-auto flex items-center gap-1.5">{extra}</div>}
    </div>
  );
}

export function ToolButton({
  label,
  children,
  onClick,
  pressed,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={
        'inline-flex h-8 min-w-8 items-center justify-center rounded-[6px] border px-2 text-[14px] transition-colors duration-140 disabled:opacity-40 ' +
        (pressed
          ? 'border-[var(--lx-accent)] bg-[var(--lx-accent)] text-[var(--lx-accent-on)]'
          : 'border-[var(--lx-border)] text-[var(--lx-text-muted)] hover:bg-[var(--lx-surface-hover)] hover:text-[var(--lx-text)]')
      }
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ search bar */

function SearchBar({
  query,
  hits,
  hitIndex,
  searching,
  onQuery,
  onGoto,
  onClose,
}: {
  query: string;
  hits: SearchHit[];
  hitIndex: number;
  searching: boolean;
  onQuery: (value: string) => void;
  onGoto: (index: number) => void;
  onClose: () => void;
}) {
  const input = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => input.current?.focus(), []);

  return (
    <div className="border-b border-[var(--lx-border)] bg-[var(--lx-surface)] px-3 py-2">
      <div className="flex items-center gap-2">
        <label htmlFor="lx-pdf-search" className="sr-only">
          Im Original suchen
        </label>
        <input
          id="lx-pdf-search"
          ref={input}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'Enter') {
              event.preventDefault();
              onGoto(event.shiftKey ? Math.max(0, hitIndex - 1) : Math.min(hits.length - 1, hitIndex + 1));
            }
          }}
          placeholder="Im Original suchen"
          className="h-9 flex-1 rounded-[8px] border border-[var(--lx-border)] bg-[var(--lx-bg)] px-3 text-[14px] text-[var(--lx-text)]"
        />
        <span className="min-w-[92px] text-right font-mono text-[12px] tabular-nums text-[var(--lx-text-muted)]">
          {searching
            ? 'sucht…'
            : hits.length === 0
              ? query.trim().length > 1
                ? 'kein Treffer'
                : ''
              : `${formatNumber(hitIndex + 1)} / ${formatNumber(hits.length)}`}
        </span>
        <ToolButton label="Vorheriger Treffer" onClick={() => onGoto(Math.max(0, hitIndex - 1))}>
          ‹
        </ToolButton>
        <ToolButton
          label="Nächster Treffer"
          onClick={() => onGoto(Math.min(hits.length - 1, hitIndex + 1))}
        >
          ›
        </ToolButton>
        <ToolButton label="Suche schließen" onClick={onClose}>
          ✕
        </ToolButton>
      </div>

      {hits.length > 0 && (
        <ul className="mt-2 max-h-[168px] overflow-y-auto">
          {hits.slice(0, 200).map((hit, index) => (
            <li key={`${hit.page}-${hit.offset}`}>
              <button
                type="button"
                onClick={() => onGoto(index)}
                className={
                  'flex w-full gap-3 rounded-[6px] px-2 py-1.5 text-left text-[13px] transition-colors duration-140 hover:bg-[var(--lx-surface-hover)] ' +
                  (index === hitIndex ? 'bg-[var(--lx-surface-hover)]' : '')
                }
              >
                <span className="shrink-0 font-mono text-[12px] tabular-nums text-[var(--lx-text-muted)]">
                  S. {hit.page}
                </span>
                <span className="min-w-0 flex-1 truncate text-[var(--lx-text-muted)]">
                  {hit.preview}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ sidebar */

function Outline({
  entries,
  current,
  onSelect,
}: {
  entries: OutlineEntry[] | null;
  current: number;
  onSelect: (page: number) => void;
}) {
  if (entries === null) {
    return <p className="px-3 text-[13px] text-[var(--lx-text-muted)]">Wird gelesen…</p>;
  }
  if (entries.length === 0) {
    return (
      <p className="px-3 text-[13px] leading-relaxed text-[var(--lx-text-muted)]">
        Diese Datei bringt kein Inhaltsverzeichnis mit.
      </p>
    );
  }
  return (
    <ul>
      {entries.map((entry, index) => (
        <li key={`${entry.title}-${index}`}>
          <button
            type="button"
            disabled={entry.page === null}
            onClick={() => entry.page && onSelect(entry.page)}
            style={{ paddingLeft: `${12 + entry.depth * 12}px` }}
            className={
              'flex w-full items-baseline justify-between gap-2 py-1.5 pr-3 text-left text-[13px] leading-snug transition-colors duration-140 hover:bg-[var(--lx-surface-hover)] disabled:opacity-50 ' +
              (entry.page === current ? 'text-[var(--lx-accent-text)]' : 'text-[var(--lx-text)]')
            }
          >
            <span className="min-w-0 flex-1">{entry.title}</span>
            {entry.page !== null && (
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--lx-text-muted)]">
                {entry.page}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The thumbnail column.
 *
 * Each thumbnail is a `PdfPage` at a tiny scale rather than a second renderer: one code
 * path for drawing means a document that renders in the main view can never fail to
 * render here, and pdf.js reuses the page it already parsed.
 */
function Thumbnails({
  doc,
  sizes,
  current,
  onSelect,
  onSize,
}: {
  doc: PDFDocumentProxy;
  sizes: PageSize[];
  current: number;
  onSelect: (page: number) => void;
  onSize: (pageNumber: number, size: PageSize) => void;
}) {
  const list = React.useRef<HTMLUListElement | null>(null);
  const [range, setRange] = React.useState({ first: 1, last: 12 });

  React.useEffect(() => {
    const element = list.current;
    if (!element) return;
    const update = () => {
      const rowHeight = 150;
      const first = Math.max(1, Math.floor(element.scrollTop / rowHeight) - 2);
      const last = Math.min(sizes.length, first + Math.ceil(element.clientHeight / rowHeight) + 4);
      setRange({ first, last });
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    return () => element.removeEventListener('scroll', update);
  }, [sizes.length]);

  React.useEffect(() => {
    const element = list.current?.querySelector(`[data-thumb="${current}"]`);
    element?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  return (
    <ul ref={list} className="flex flex-col items-center gap-2">
      {sizes.map((size, index) => {
        const number = index + 1;
        const width = 132;
        const scale = width / size.width;
        const visible = number >= range.first && number <= range.last;
        return (
          <li key={number} data-thumb={number}>
            <button
              type="button"
              onClick={() => onSelect(number)}
              aria-label={`Zu Seite ${number}`}
              aria-current={number === current}
              className={
                'block rounded-[4px] border-2 p-0.5 transition-colors duration-140 ' +
                (number === current ? 'border-[var(--lx-accent)]' : 'border-transparent')
              }
            >
              <PdfPage
                doc={doc}
                pageNumber={number}
                scale={scale}
                rotation={0}
                active={visible}
                size={size}
                onSize={onSize}
                onNavigate={onSelect}
                invert={false}
                minimal
              />
              <span className="mt-0.5 block text-center font-mono text-[11px] tabular-nums text-[var(--lx-text-muted)]">
                {number}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
