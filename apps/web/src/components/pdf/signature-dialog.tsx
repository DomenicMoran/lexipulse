'use client';

import * as React from 'react';

/**
 * Making a signature.
 *
 * Three ways, because the device decides which one is bearable: drawing with a finger or
 * a stylus, typing the name in a handwriting-like face, or photographing a signature on
 * paper. All three end as the same thing — a transparent PNG — so everything downstream
 * only ever deals with a picture.
 *
 * What this is *not* is a qualified electronic signature. It is a picture of a signature,
 * exactly like signing a printout and scanning it, and the dialog says so. Calling it
 * more than that would be a claim about legal effect that no drawing on a canvas can
 * support.
 */

export interface SignatureResult {
  bytes: Uint8Array;
  mime: string;
  /** height ÷ width, so the caller can place it without distorting it. */
  ratio: number;
}

type Mode = 'draw' | 'type' | 'image';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 220;

export function SignatureDialog({
  onDone,
  onCancel,
}: {
  onDone: (result: SignatureResult) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = React.useState<Mode>('draw');
  const [typed, setTyped] = React.useState('');
  const [color, setColor] = React.useState('#111111');
  const [hasInk, setHasInk] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canvas = React.useRef<HTMLCanvasElement | null>(null);
  const drawing = React.useRef(false);
  const last = React.useRef<{ x: number; y: number } | null>(null);

  const clear = React.useCallback(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    context.clearRect(0, 0, element.width, element.height);
    setHasInk(false);
  }, []);

  const positionOf = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const element = event.currentTarget;
    const box = element.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * element.width,
      y: ((event.clientY - box.top) / box.height) * element.height,
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    last.current = positionOf(event);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext('2d');
    const from = last.current;
    if (!context || !from) return;
    const to = positionOf(event);

    context.strokeStyle = color;
    // A pen that thins as it moves faster reads as handwriting; a constant width reads as
    // a drawing program. `pressure` is 0.5 for a mouse, which lands in the middle.
    const pressure = event.pressure > 0 ? event.pressure : 0.5;
    context.lineWidth = 1.5 + pressure * 3.5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();

    last.current = to;
    setHasInk(true);
  };

  const onPointerUp = () => {
    drawing.current = false;
    last.current = null;
  };

  /** Everything ends here: a trimmed, transparent PNG. */
  const exportCanvas = async (source: HTMLCanvasElement): Promise<SignatureResult | null> => {
    const trimmed = trimTransparent(source);
    if (!trimmed) return null;
    const blob = await new Promise<Blob | null>((resolve) => trimmed.toBlob(resolve, 'image/png'));
    if (!blob) return null;
    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mime: 'image/png',
      ratio: trimmed.height / trimmed.width,
    };
  };

  const applyDrawing = async () => {
    const element = canvas.current;
    if (!element || !hasInk) {
      setError('Es ist noch nichts gezeichnet.');
      return;
    }
    const result = await exportCanvas(element);
    if (result) onDone(result);
  };

  const applyTyped = async () => {
    const text = typed.trim();
    if (text.length === 0) {
      setError('Bitte einen Namen eingeben.');
      return;
    }
    const element = window.document.createElement('canvas');
    element.width = CANVAS_WIDTH;
    element.height = CANVAS_HEIGHT;
    const context = element.getContext('2d');
    if (!context) return;
    context.fillStyle = color;
    context.font = `italic 84px "Segoe Script", "Brush Script MT", "Apple Chancery", cursive`;
    context.textBaseline = 'middle';
    context.textAlign = 'center';
    context.fillText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH - 40);
    const result = await exportCanvas(element);
    if (result) onDone(result);
  };

  const applyPicture = async (file: File) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError('Nur PNG, JPEG oder WebP.');
      return;
    }
    const bitmap = await createImageBitmap(file);
    const element = window.document.createElement('canvas');
    element.width = bitmap.width;
    element.height = bitmap.height;
    const context = element.getContext('2d');
    if (!context) return;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();

    /*
     * A photograph of a signature on paper has a white background, and pasting a white
     * block over the document is not signing it. Every pixel brighter than the threshold
     * becomes transparent, which leaves the ink and drops the paper.
     */
    const pixels = context.getImageData(0, 0, element.width, element.height);
    const data = pixels.data;
    for (let i = 0; i < data.length; i += 4) {
      const luminance =
        0.2126 * (data[i] as number) +
        0.7152 * (data[i + 1] as number) +
        0.0722 * (data[i + 2] as number);
      if (luminance > 200) data[i + 3] = 0;
      else if (luminance > 140) data[i + 3] = Math.round(255 * ((200 - luminance) / 60));
    }
    context.putImageData(pixels, 0, 0);

    const result = await exportCanvas(element);
    if (result) onDone(result);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Unterschrift"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel();
      }}
    >
      <div className="w-full max-w-[680px] rounded-[14px] border border-[var(--lx-border)] bg-[var(--lx-bg)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-semibold">Unterschrift</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--lx-text-muted)]">
              Das Ergebnis ist ein Bild Ihrer Unterschrift — wie ein unterschriebener und
              eingescannter Ausdruck. Es ist keine qualifizierte elektronische Signatur.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Schließen"
            className="rounded-[6px] p-1 text-[var(--lx-text-muted)] hover:text-[var(--lx-text)]"
          >
            ✕
          </button>
        </div>

        <div role="tablist" aria-label="Art der Unterschrift" className="mt-4 flex gap-1">
          {(
            [
              ['draw', 'Zeichnen'],
              ['type', 'Tippen'],
              ['image', 'Bild'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => {
                setMode(value);
                setError(null);
              }}
              className={
                'h-9 rounded-[8px] px-4 text-[14px] transition-colors duration-140 ' +
                (mode === value
                  ? 'bg-[var(--lx-surface-hover)] text-[var(--lx-text)]'
                  : 'text-[var(--lx-text-muted)] hover:text-[var(--lx-text)]')
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {mode === 'draw' && (
            <>
              <canvas
                ref={canvas}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                aria-label="Zeichenfläche für die Unterschrift"
                className="w-full cursor-crosshair rounded-[10px] border border-dashed border-[var(--lx-border-strong)] bg-white"
                style={{ touchAction: 'none', aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
              />
              <button
                type="button"
                onClick={clear}
                className="mt-2 text-[13px] text-[var(--lx-text-muted)] underline underline-offset-2 hover:text-[var(--lx-text)]"
              >
                Noch einmal
              </button>
            </>
          )}

          {mode === 'type' && (
            <>
              <label htmlFor="lx-sign-name" className="sr-only">
                Name
              </label>
              <input
                id="lx-sign-name"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder="Vor- und Nachname"
                className="h-11 w-full rounded-[8px] border border-[var(--lx-border)] bg-[var(--lx-surface)] px-3 text-[15px] text-[var(--lx-text)]"
              />
              <div
                aria-hidden="true"
                className="mt-3 flex h-[110px] items-center justify-center rounded-[10px] border border-dashed border-[var(--lx-border-strong)] bg-white"
                style={{
                  color,
                  fontSize: '44px',
                  fontStyle: 'italic',
                  fontFamily: '"Segoe Script", "Brush Script MT", "Apple Chancery", cursive',
                }}
              >
                {typed || 'Vorschau'}
              </div>
            </>
          )}

          {mode === 'image' && (
            <label className="flex h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-[var(--lx-border-strong)] px-4 text-center">
              <span className="text-[14px] text-[var(--lx-text)]">Bild auswählen</span>
              <span className="text-[13px] text-[var(--lx-text-muted)]">
                PNG, JPEG oder WebP. Weißes Papier wird entfernt, die Tinte bleibt.
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void applyPicture(file);
                }}
              />
            </label>
          )}
        </div>

        {mode !== 'image' && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[13px] text-[var(--lx-text-muted)]">Farbe</span>
            {['#111111', '#0b3d91', '#7a1020'].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setColor(value)}
                aria-label={`Farbe ${value}`}
                aria-pressed={color === value}
                className="h-6 w-6 rounded-full"
                style={{
                  background: value,
                  outline: color === value ? '2px solid var(--lx-text)' : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-[13px] text-[var(--lx-text-muted)]">
            {error}
          </p>
        )}

        {mode !== 'image' && (
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-10 rounded-[8px] border border-[var(--lx-border)] px-4 text-[14px] text-[var(--lx-text-muted)] hover:text-[var(--lx-text)]"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => void (mode === 'draw' ? applyDrawing() : applyTyped())}
              className="h-10 rounded-[8px] bg-[var(--lx-accent)] px-5 text-[14px] font-medium text-[var(--lx-accent-on)] hover:bg-[var(--lx-accent-strong)]"
            >
              Übernehmen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Crop away the empty border so the signature fills the picture.
 *
 * Without it a signature drawn in the corner of the canvas arrives on the page as a
 * mostly-empty rectangle, and placing it means guessing where inside the box the ink
 * actually is. Returns null when there is no ink at all.
 */
export function trimTransparent(source: HTMLCanvasElement): HTMLCanvasElement | null {
  const context = source.getContext('2d');
  if (!context) return null;
  const { width, height } = source;
  const { data } = context.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((data[(y * width + x) * 4 + 3] as number) < 8) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;

  const pad = 6;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const right = Math.min(width, maxX + pad + 1);
  const bottom = Math.min(height, maxY + pad + 1);

  const out = window.document.createElement('canvas');
  out.width = right - left;
  out.height = bottom - top;
  out
    .getContext('2d')
    ?.drawImage(source, left, top, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
