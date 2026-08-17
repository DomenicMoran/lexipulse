'use client';

import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import * as React from 'react';
import { boxSize, rectToStyle } from './geometry.js';
import { readLinks, type PageLink, type PageSize } from './document.js';
import { getPdfjs } from './pdfjs.js';

/**
 * One page of the original document.
 *
 * Three layers, stacked and kept in exact registration by one scale factor:
 *
 *   canvas   what the author drew
 *   text     invisible, selectable, searchable — pdf.js positions it from the same viewport
 *   overlay  links, search hits and the reader's own marks, in PDF points
 *
 * The page only draws while it is near the viewport. A 900-page document otherwise asks
 * for 900 canvases, and the tab is gone long before the reader reaches page 40.
 */

export interface PdfPageProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  rotation: number;
  /** Draw the canvas. False keeps the box and its size but nothing inside it. */
  active: boolean;
  size: PageSize;
  onSize: (pageNumber: number, size: PageSize) => void;
  onNavigate: (page: number) => void;
  /** Search rectangles in PDF points, in this page's own coordinate space. */
  highlights?: number[][];
  /** The one hit the reader is standing on, drawn stronger. */
  currentHighlight?: number[] | null;
  /** Invert the drawing for reading in the dark. */
  invert: boolean;
  /**
   * Canvas only: no text layer, no links.
   *
   * What a thumbnail is. It also has to be: a thumbnail sits inside a button, and an
   * anchor nested in a button is invalid markup that browsers resolve by dropping one of
   * the two — usually the one the reader was aiming for.
   */
  minimal?: boolean;
  children?: React.ReactNode;
}

/** The four numbers `rectToStyle` returns, as CSS lengths. */
function toPx(box: { left: number; top: number; width: number; height: number }) {
  return {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  };
}

export function PdfPage({
  doc,
  pageNumber,
  scale,
  rotation,
  active,
  size,
  onSize,
  onNavigate,
  highlights,
  currentHighlight,
  invert,
  minimal = false,
  children,
}: PdfPageProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const textRef = React.useRef<HTMLDivElement | null>(null);
  const [links, setLinks] = React.useState<PageLink[]>([]);

  /*
   * What is on the canvas right now, named by the settings that produced it.
   *
   * Stored as a key rather than a boolean so "is this canvas current" is answered during
   * render instead of by clearing a flag from an effect. Zooming would otherwise show the
   * old bitmap stretched for one frame before the placeholder appeared.
   */
  const [drawnKey, setDrawnKey] = React.useState<string | null>(null);
  const renderKey = `${pageNumber}|${scale}|${rotation}`;
  const drawn = active && drawnKey === renderKey;

  const turn = ((rotation % 360) + 360) % 360;
  const { width: boxWidth, height: boxHeight } = boxSize(size, scale, turn);

  React.useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let task: RenderTask | null = null;
    let page: PDFPageProxy | null = null;

    void (async () => {
      try {
        page = await doc.getPage(pageNumber);
        if (cancelled) return;

        const base = page.getViewport({ scale: 1 });
        onSize(pageNumber, { width: base.width, height: base.height });

        const viewport = page.getViewport({ scale, rotation });
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Drawn at device resolution and scaled down by CSS: on a 2× screen a canvas at
        // CSS resolution turns every hairline in the document into a grey smudge.
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, viewport.width, viewport.height);

        task = page.render({ canvas, canvasContext: context, viewport });
        await task.promise;
        if (cancelled) return;
        setDrawnKey(renderKey);

        if (minimal) return;

        const container = textRef.current;
        if (container) {
          container.replaceChildren();
          container.style.setProperty('--scale-factor', String(scale));
          const pdfjs = await getPdfjs();
          const layer = new pdfjs.TextLayer({
            textContentSource: page.streamTextContent(),
            container,
            viewport,
          });
          await layer.render();
        }

        if (cancelled) return;
        setLinks(await readLinks(doc, page));
      } catch {
        // A cancelled render is the normal way a page leaves the screen, not a fault, and
        // a failed one leaves `drawnKey` where it was: the placeholder stays up.
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
      page?.cleanup();
    };
  }, [doc, pageNumber, scale, rotation, active, minimal, renderKey, onSize]);

  return (
    <div
      data-pdf-page={pageNumber}
      className="relative shrink-0 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.28)]"
      style={{ width: `${boxWidth}px`, height: `${boxHeight}px` }}
    >
      <canvas
        ref={canvasRef}
        aria-label={`Seite ${pageNumber}`}
        className="block"
        style={{
          // The invert is a display filter, never a change to the file: `hue-rotate` puts
          // colours back the right way round after `invert` has flipped them, so a red
          // stamp stays red instead of turning cyan.
          filter: invert ? 'invert(1) hue-rotate(180deg)' : undefined,
          opacity: drawn ? 1 : 0,
          transition: 'opacity 120ms linear',
        }}
      />

      {!drawn && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#f4f4f5] text-[12px] text-[#71717a]">
          {pageNumber}
        </div>
      )}

      {!minimal && (
        <div
          ref={textRef}
          className="lx-pdf-text-layer"
          style={{ width: `${boxWidth}px`, height: `${boxHeight}px` }}
        />
      )}

      <div className="pointer-events-none absolute inset-0">
        {highlights?.map((rect, i) => (
          <div
            key={`hl-${i}`}
            style={{
              position: 'absolute',
              ...toPx(rectToStyle(rect, size, scale, turn)),
              backgroundColor:
                currentHighlight === rect ? 'rgba(255,145,0,0.55)' : 'rgba(255,213,0,0.38)',
              mixBlendMode: 'multiply',
              borderRadius: '2px',
            }}
          />
        ))}
      </div>

      {(minimal ? [] : links).map((link, i) =>
        link.url ? (
          <a
            key={`link-${i}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            title={link.url}
            aria-label={`Verweis auf ${link.url}`}
            style={{ position: 'absolute', ...toPx(rectToStyle(link.rect, size, scale, turn)) }}
            className="rounded-[2px] outline-offset-2 hover:bg-[rgba(59,130,246,0.16)]"
          />
        ) : (
          <button
            key={`link-${i}`}
            type="button"
            aria-label={`Springe zu Seite ${link.page}`}
            onClick={() => link.page && onNavigate(link.page)}
            style={{ position: 'absolute', ...toPx(rectToStyle(link.rect, size, scale, turn)) }}
            className="rounded-[2px] outline-offset-2 hover:bg-[rgba(59,130,246,0.16)]"
          />
        ),
      )}

      {children}
    </div>
  );
}
