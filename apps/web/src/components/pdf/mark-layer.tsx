'use client';

import {
  createMark,
  isStrokeKind,
  moveMark,
  resizeMark,
  type PdfMark,
  type PdfMarkKind,
  type PdfRect,
} from '@lexipulse/core';
import * as React from 'react';
import { getFileStore } from '@/lib/store';
import { boxSize, boxToPdf, clampToPage, pdfToBox, rectToStyle } from './geometry';
import type { PageSize } from './pdf-doc';

/**
 * Everything the reader drew on one page, and the pointer handling that puts it there.
 *
 * Three ways in, and which one is active decides whether this layer takes the pointer at
 * all:
 *
 * - **Select** lets the marks themselves be grabbed, and leaves the page alone otherwise,
 *   so text can still be selected and links still work.
 * - **Text tools** — highlight, underline, strike — take no pointer events whatsoever.
 *   They read the browser's own text selection out of pdf.js's text layer when the mouse
 *   comes up, which is the only way a marker lands on the line rather than on a rectangle
 *   the reader had to draw by hand.
 * - **Drawing tools** take everything, because a drag is the input.
 */

export type Tool = 'select' | PdfMarkKind;

export interface ToolStyle {
  color: string;
  strokeWidth: number;
  fontSize: number;
  opacity: number;
}

export interface MarkLayerProps {
  pageNumber: number;
  size: PageSize;
  scale: number;
  rotation: number;
  marks: readonly PdfMark[];
  tool: Tool;
  style: ToolStyle;
  documentId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (mark: PdfMark) => void;
  onUpdate: (mark: PdfMark) => void;
  /** Asks the surface for the picture to stamp; null cancels the placement. */
  requestStamp?: () => Promise<{ imageId: string; ratio: number } | null>;
  /** Asks the surface for the words of a text box or a note. */
  requestText?: (initial: string) => Promise<string | null>;
}

/** Kinds that follow the reader's text selection instead of a drawn rectangle. */
const TEXT_TOOLS = new Set<Tool>(['highlight', 'underline', 'strike']);

/** Kinds placed with a single click rather than a drag. */
const CLICK_TOOLS = new Set<Tool>(['note']);

export function MarkLayer({
  pageNumber,
  size,
  scale,
  rotation,
  marks,
  tool,
  style,
  documentId,
  selectedId,
  onSelect,
  onCreate,
  onUpdate,
  requestStamp,
  requestText,
}: MarkLayerProps) {
  const host = React.useRef<HTMLDivElement | null>(null);
  const box = boxSize(size, scale, rotation);

  /** The mark being drawn right now, in PDF points. Never persisted until the pointer lifts. */
  const [draft, setDraft] = React.useState<{ rect: PdfRect; paths: number[][] } | null>(null);
  const drag = React.useRef<{
    start: { x: number; y: number };
    paths: number[][];
    moved: boolean;
  } | null>(null);

  const toPdf = React.useCallback(
    (event: { clientX: number; clientY: number }) => {
      const element = host.current;
      if (!element) return { x: 0, y: 0 };
      const rect = element.getBoundingClientRect();
      return clampToPage(
        boxToPdf(event.clientX - rect.left, event.clientY - rect.top, size, scale, rotation),
        size,
      );
    },
    [size, scale, rotation],
  );

  /* ------------------------------------------------------------ text selection */

  React.useEffect(() => {
    if (!TEXT_TOOLS.has(tool)) return;
    const element = host.current?.parentElement;
    if (!element) return;

    const onPointerUp = () => {
      // Deferred by a tick: the selection is not final until the browser has finished
      // handling the mouse-up that produced it.
      window.setTimeout(() => {
        const rects = selectionRectsIn(element);
        if (rects.length === 0) return;
        const hostRect = element.getBoundingClientRect();
        for (const rect of rects) {
          const a = boxToPdf(rect.left - hostRect.left, rect.top - hostRect.top, size, scale, rotation);
          const b = boxToPdf(
            rect.right - hostRect.left,
            rect.bottom - hostRect.top,
            size,
            scale,
            rotation,
          );
          onCreate(
            createMark({
              documentId,
              page: pageNumber,
              kind: tool as PdfMarkKind,
              rect: [a.x, a.y, b.x, b.y],
              color: style.color,
              opacity: tool === 'highlight' ? style.opacity : 1,
              strokeWidth: style.strokeWidth,
            }),
          );
        }
        window.getSelection()?.removeAllRanges();
      }, 0);
    };

    element.addEventListener('pointerup', onPointerUp);
    return () => element.removeEventListener('pointerup', onPointerUp);
  }, [tool, documentId, pageNumber, size, scale, rotation, style, onCreate]);

  /* ---------------------------------------------------------------- drawing */

  const onPointerDown = (event: React.PointerEvent) => {
    if (tool === 'select' || TEXT_TOOLS.has(tool)) return;
    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);

    const point = toPdf(event);

    if (CLICK_TOOLS.has(tool)) {
      void placeNote(point);
      return;
    }
    if (tool === 'image' || tool === 'signature') {
      void placeStamp(point);
      return;
    }

    drag.current = { start: point, paths: [[point.x, point.y]], moved: false };
    setDraft({ rect: [point.x, point.y, point.x, point.y], paths: [[point.x, point.y]] });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current) return;
    const point = toPdf(event);
    current.moved = true;

    if (isStrokeKind(tool as PdfMarkKind)) {
      (current.paths[0] as number[]).push(point.x, point.y);
      setDraft({
        rect: [current.start.x, current.start.y, point.x, point.y],
        paths: [[...(current.paths[0] as number[])]],
      });
      return;
    }

    setDraft({
      rect: [current.start.x, current.start.y, point.x, point.y],
      paths: [[current.start.x, current.start.y, point.x, point.y]],
    });
  };

  const onPointerUp = () => {
    const current = drag.current;
    drag.current = null;
    setDraft(null);
    if (!current || !current.moved) return;

    const points = current.paths[0] as number[];
    const last = { x: points[points.length - 2] ?? 0, y: points[points.length - 1] ?? 0 };
    const kind = tool as PdfMarkKind;

    // A drag of a few points is a slip of the hand, not a mark.
    const span = Math.hypot(last.x - current.start.x, last.y - current.start.y);
    if (span < 3 && !isStrokeKind(kind)) return;

    onCreate(
      createMark({
        documentId,
        page: pageNumber,
        kind,
        rect: [current.start.x, current.start.y, last.x, last.y],
        // Direction matters for a line and an arrow, and a normalised box has lost it.
        paths: isStrokeKind(kind)
          ? [points]
          : kind === 'line' || kind === 'arrow'
            ? [[current.start.x, current.start.y, last.x, last.y]]
            : undefined,
        color: style.color,
        opacity: style.opacity,
        strokeWidth: style.strokeWidth,
        ...(kind === 'text' ? { fontSize: style.fontSize, text: '' } : {}),
      }),
    );
  };

  const placeNote = async (point: { x: number; y: number }) => {
    const text = await requestText?.('');
    if (!text) return;
    onCreate(
      createMark({
        documentId,
        page: pageNumber,
        kind: 'note',
        rect: [point.x, point.y - 14, point.x + 14, point.y],
        color: style.color,
        text,
      }),
    );
  };

  const placeStamp = async (point: { x: number; y: number }) => {
    const stamp = await requestStamp?.();
    if (!stamp) return;
    const width = 180;
    const height = width * stamp.ratio;
    onCreate(
      createMark({
        documentId,
        page: pageNumber,
        kind: tool === 'signature' ? 'signature' : 'image',
        rect: [point.x, point.y - height, point.x + width, point.y],
        imageId: stamp.imageId,
      }),
    );
  };

  /* ------------------------------------------------------------------ moving */

  const moveDrag = React.useRef<{
    id: string;
    from: { x: number; y: number };
    mode: 'move' | 'resize';
    original: PdfMark;
  } | null>(null);

  const onMarkPointerDown = (event: React.PointerEvent, mark: PdfMark, mode: 'move' | 'resize') => {
    if (tool !== 'select') return;
    event.preventDefault();
    event.stopPropagation();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    onSelect(mark.id);
    moveDrag.current = { id: mark.id, from: toPdf(event), mode, original: mark };
  };

  const onHostPointerMove = (event: React.PointerEvent) => {
    const current = moveDrag.current;
    if (!current) {
      onPointerMove(event);
      return;
    }
    const point = toPdf(event);
    const dx = point.x - current.from.x;
    const dy = point.y - current.from.y;

    if (current.mode === 'move') {
      onUpdate(moveMark(current.original, dx, dy));
      return;
    }
    const [x1, y1, x2] = current.original.rect;
    // The bottom-right handle in PDF space is the corner with the larger x and smaller y.
    onUpdate(resizeMark(current.original, [x1, y1 + dy, x2 + dx, current.original.rect[3]]));
  };

  const onHostPointerUp = () => {
    if (moveDrag.current) {
      moveDrag.current = null;
      return;
    }
    onPointerUp();
  };

  /* ------------------------------------------------------------------ render */

  const interactive = tool !== 'select' && !TEXT_TOOLS.has(tool);
  const cursor = interactive ? 'crosshair' : 'default';

  const drafted: PdfMark | null = draft
    ? createMark({
        documentId,
        page: pageNumber,
        kind: tool as PdfMarkKind,
        rect: draft.rect,
        paths: isStrokeKind(tool as PdfMarkKind) ? draft.paths : undefined,
        color: style.color,
        opacity: style.opacity,
        strokeWidth: style.strokeWidth,
        id: '__draft',
      })
    : null;

  return (
    <div
      ref={host}
      data-mark-layer={pageNumber}
      onPointerDown={onPointerDown}
      onPointerMove={onHostPointerMove}
      onPointerUp={onHostPointerUp}
      onPointerCancel={onHostPointerUp}
      style={{
        position: 'absolute',
        inset: 0,
        width: `${box.width}px`,
        height: `${box.height}px`,
        // z-3 puts marks above the text layer, so a highlight is visible; the layer only
        // swallows pointer events while a drawing tool is active.
        zIndex: 3,
        cursor,
        pointerEvents: interactive ? 'auto' : 'none',
        touchAction: interactive ? 'none' : 'auto',
      }}
    >
      <svg
        width={box.width}
        height={box.height}
        viewBox={`0 0 ${box.width} ${box.height}`}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        {marks.map((mark) => (
          <MarkShape
            key={mark.id}
            mark={mark}
            size={size}
            scale={scale}
            rotation={rotation}
            selected={mark.id === selectedId}
          />
        ))}
        {drafted && (
          <MarkShape mark={drafted} size={size} scale={scale} rotation={rotation} selected={false} />
        )}
      </svg>

      {marks.map((mark) =>
        mark.kind === 'image' || mark.kind === 'signature' ? (
          <MarkImage
            key={`i-${mark.id}`}
            mark={mark}
            size={size}
            scale={scale}
            rotation={rotation}
            selected={mark.id === selectedId}
          />
        ) : null,
      )}

      {marks.map((mark) =>
        mark.kind === 'text' || mark.kind === 'note' ? (
          <MarkText
            key={`t-${mark.id}`}
            mark={mark}
            size={size}
            scale={scale}
            rotation={rotation}
            onEdit={async () => {
              const text = await requestText?.(mark.text ?? '');
              if (text !== null && text !== undefined) {
                onUpdate({ ...mark, text, updatedAt: Date.now() });
              }
            }}
          />
        ) : null,
      )}

      {tool === 'select' &&
        marks.map((mark) => (
          <MarkHandles
            key={`h-${mark.id}`}
            mark={mark}
            size={size}
            scale={scale}
            rotation={rotation}
            selected={mark.id === selectedId}
            onGrab={onMarkPointerDown}
          />
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ shapes */

function MarkShape({
  mark,
  size,
  scale,
  rotation,
  selected,
}: {
  mark: PdfMark;
  size: PageSize;
  scale: number;
  rotation: number;
  selected: boolean;
}) {
  const box = rectToStyle(mark.rect, size, scale, rotation);
  const stroke = mark.strokeWidth * scale;

  const project = (x: number, y: number) => pdfToBox(x, y, size, scale, rotation);

  switch (mark.kind) {
    case 'highlight':
      return (
        <rect
          x={box.left}
          y={box.top}
          width={box.width}
          height={box.height}
          fill={mark.color}
          opacity={mark.opacity}
          style={{ mixBlendMode: 'multiply' }}
          rx={1}
        />
      );

    case 'redact':
      return <rect x={box.left} y={box.top} width={box.width} height={box.height} fill="#000" />;

    case 'underline':
    case 'strike': {
      const [x1, y1, x2, y2] = mark.rect;
      const y = mark.kind === 'underline' ? Math.min(y1, y2) : (y1 + y2) / 2;
      const a = project(Math.min(x1, x2), y);
      const b = project(Math.max(x1, x2), y);
      return (
        <line
          x1={a.left}
          y1={a.top}
          x2={b.left}
          y2={b.top}
          stroke={mark.color}
          strokeWidth={Math.max(stroke, 1)}
          strokeLinecap="round"
          opacity={mark.opacity}
        />
      );
    }

    case 'ink':
      return (
        <g opacity={mark.opacity}>
          {(mark.paths ?? []).map((path, index) => {
            const points: string[] = [];
            for (let i = 0; i + 1 < path.length; i += 2) {
              const p = project(path[i] as number, path[i + 1] as number);
              points.push(`${p.left},${p.top}`);
            }
            if (points.length === 1) {
              const [only] = points as [string];
              const [cx, cy] = only.split(',');
              return (
                <circle
                  key={index}
                  cx={Number(cx)}
                  cy={Number(cy)}
                  r={Math.max(stroke / 2, 0.5)}
                  fill={mark.color}
                />
              );
            }
            return (
              <polyline
                key={index}
                points={points.join(' ')}
                fill="none"
                stroke={mark.color}
                strokeWidth={Math.max(stroke, 1)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
        </g>
      );

    case 'rect':
      return (
        <rect
          x={box.left}
          y={box.top}
          width={box.width}
          height={box.height}
          fill="none"
          stroke={mark.color}
          strokeWidth={Math.max(stroke, 1)}
          opacity={mark.opacity}
        />
      );

    case 'ellipse':
      return (
        <ellipse
          cx={box.left + box.width / 2}
          cy={box.top + box.height / 2}
          rx={box.width / 2}
          ry={box.height / 2}
          fill="none"
          stroke={mark.color}
          strokeWidth={Math.max(stroke, 1)}
          opacity={mark.opacity}
        />
      );

    case 'line':
    case 'arrow': {
      const path = mark.paths?.[0] ?? mark.rect;
      const a = project(path[0] as number, path[1] as number);
      const b = project(path[2] as number, path[3] as number);
      const angle = Math.atan2(b.top - a.top, b.left - a.left);
      const head = Math.max(stroke * 4, 8);
      const spread = Math.PI / 7;
      return (
        <g opacity={mark.opacity} stroke={mark.color} strokeWidth={Math.max(stroke, 1)}>
          <line x1={a.left} y1={a.top} x2={b.left} y2={b.top} strokeLinecap="round" />
          {mark.kind === 'arrow' && (
            <>
              <line
                x1={b.left}
                y1={b.top}
                x2={b.left - head * Math.cos(angle - spread)}
                y2={b.top - head * Math.sin(angle - spread)}
                strokeLinecap="round"
              />
              <line
                x1={b.left}
                y1={b.top}
                x2={b.left - head * Math.cos(angle + spread)}
                y2={b.top - head * Math.sin(angle + spread)}
                strokeLinecap="round"
              />
            </>
          )}
        </g>
      );
    }

    case 'image':
    case 'signature':
      return (
        <rect
          x={box.left}
          y={box.top}
          width={box.width}
          height={box.height}
          fill="none"
          stroke={selected ? '#3b82f6' : 'transparent'}
          strokeDasharray="4 3"
        />
      );

    default:
      return null;
  }
}

/**
 * Stamped pictures and signatures.
 *
 * The bytes live in the file store, so the picture has to be resolved to a URL before it
 * can be shown. Resolved once per stamp and kept for the life of the page: a signature is
 * a few kilobytes, and re-reading it on every scroll would make the page flicker.
 */
const stampUrls = new Map<string, string>();

function MarkImage({
  mark,
  size,
  scale,
  rotation,
  selected,
}: {
  mark: PdfMark;
  size: PageSize;
  scale: number;
  rotation: number;
  selected: boolean;
}) {
  const [url, setUrl] = React.useState<string | null>(
    mark.imageId ? (stampUrls.get(mark.imageId) ?? null) : null,
  );

  React.useEffect(() => {
    const id = mark.imageId;
    if (!id || stampUrls.has(id)) return;
    let cancelled = false;

    void (async () => {
      const files = await getFileStore();
      const bytes = await files.get(id);
      const meta = await files.stat(id);
      if (cancelled || !bytes) return;
      const blob = new Blob([bytes.slice().buffer as ArrayBuffer], {
        type: meta?.mime ?? 'image/png',
      });
      const objectUrl = URL.createObjectURL(blob);
      stampUrls.set(id, objectUrl);
      setUrl(objectUrl);
    })();

    return () => {
      cancelled = true;
    };
  }, [mark.imageId]);

  const box = rectToStyle(mark.rect, size, scale, rotation);
  if (!url) return null;

  return (
    /*
     * A plain `<img>`, not `next/image`. The source is a blob URL for a file that never
     * left this device; there is no server that could resize it, and routing it through
     * the image optimiser would mean uploading a signature to do so.
     */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={mark.kind === 'signature' ? 'Unterschrift' : 'Eingesetztes Bild'}
      style={{
        position: 'absolute',
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
        opacity: mark.opacity,
        outline: selected ? '1.5px solid #3b82f6' : 'none',
        pointerEvents: 'none',
        objectFit: 'fill',
      }}
    />
  );
}

/** Text boxes and notes, as HTML so the glyphs stay crisp at every zoom. */
function MarkText({
  mark,
  size,
  scale,
  rotation,
  onEdit,
}: {
  mark: PdfMark;
  size: PageSize;
  scale: number;
  rotation: number;
  onEdit: () => void;
}) {
  const box = rectToStyle(mark.rect, size, scale, rotation);

  if (mark.kind === 'note') {
    return (
      <button
        type="button"
        onClick={onEdit}
        title={mark.text ?? ''}
        aria-label={`Notiz: ${mark.text ?? ''}`}
        style={{
          position: 'absolute',
          left: `${box.left}px`,
          top: `${box.top}px`,
          width: `${Math.max(box.width, 18)}px`,
          height: `${Math.max(box.height, 18)}px`,
          background: mark.color,
          border: '1px solid rgba(0,0,0,0.35)',
          borderRadius: '3px',
          pointerEvents: 'auto',
          cursor: 'pointer',
          fontSize: '11px',
          lineHeight: 1,
          color: '#1a1a1a',
        }}
      >
        i
      </button>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onEdit();
      }}
      style={{
        position: 'absolute',
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        minHeight: `${box.height}px`,
        color: mark.color,
        opacity: mark.opacity,
        fontSize: `${(mark.fontSize ?? 12) * scale}px`,
        lineHeight: 1.25,
        fontFamily: 'Helvetica, Arial, sans-serif',
        whiteSpace: 'pre-wrap',
        pointerEvents: 'auto',
        cursor: 'text',
        outline: (mark.text ?? '').length === 0 ? '1px dashed rgba(120,120,120,0.8)' : 'none',
      }}
    >
      {mark.text}
    </div>
  );
}

/** The grab area and the resize corner, only while the select tool is active. */
function MarkHandles({
  mark,
  size,
  scale,
  rotation,
  selected,
  onGrab,
}: {
  mark: PdfMark;
  size: PageSize;
  scale: number;
  rotation: number;
  selected: boolean;
  onGrab: (event: React.PointerEvent, mark: PdfMark, mode: 'move' | 'resize') => void;
}) {
  const box = rectToStyle(mark.rect, size, scale, rotation);

  return (
    <>
      <div
        role="button"
        tabIndex={-1}
        aria-label={`Markierung auf Seite ${mark.page}`}
        onPointerDown={(event) => onGrab(event, mark, 'move')}
        style={{
          position: 'absolute',
          left: `${box.left}px`,
          top: `${box.top}px`,
          width: `${Math.max(box.width, 8)}px`,
          height: `${Math.max(box.height, 8)}px`,
          pointerEvents: 'auto',
          cursor: 'move',
          outline: selected ? '1.5px solid #3b82f6' : 'none',
          outlineOffset: '1px',
        }}
      />
      {selected && (
        <div
          onPointerDown={(event) => onGrab(event, mark, 'resize')}
          style={{
            position: 'absolute',
            left: `${box.left + box.width - 5}px`,
            top: `${box.top + box.height - 5}px`,
            width: '10px',
            height: '10px',
            background: '#3b82f6',
            borderRadius: '2px',
            pointerEvents: 'auto',
            cursor: 'nwse-resize',
          }}
        />
      )}
    </>
  );
}

/**
 * The rectangles of the current text selection that lie inside `element`.
 *
 * Client rects rather than the range's bounding box: a selection that spans three lines
 * has to become three marks, or the highlight covers the margins between them and reads
 * as a block rather than as marked text.
 */
function selectionRectsIn(element: HTMLElement): DOMRect[] {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return [];

  const out: DOMRect[] = [];
  for (let i = 0; i < selection.rangeCount; i += 1) {
    const range = selection.getRangeAt(i);
    if (!element.contains(range.commonAncestorContainer)) continue;
    for (const rect of Array.from(range.getClientRects())) {
      // Zero-height rects come from the boundaries between spans and mark nothing.
      if (rect.width > 0.5 && rect.height > 0.5) out.push(rect);
    }
  }
  return out;
}
