'use client';

import * as React from 'react';
import type { Tool, ToolStyle } from './mark-layer.js';

/**
 * The tool palette and the strip of settings that belongs to whichever tool is active.
 *
 * Grouped the way the work is: reading, marking text, drawing, putting something on the
 * page. A palette that lists thirteen equal buttons makes the reader read all thirteen
 * every time they want a highlighter.
 */

export interface ToolDefinition {
  tool: Tool;
  label: string;
  hint: string;
  glyph: string;
}

export const TOOL_GROUPS: { title: string; tools: ToolDefinition[] }[] = [
  {
    title: 'Lesen',
    tools: [
      { tool: 'select', label: 'Auswählen', hint: 'Markierungen verschieben und ändern', glyph: '⬚' },
    ],
  },
  {
    title: 'Text markieren',
    tools: [
      { tool: 'highlight', label: 'Markieren', hint: 'Text mit der Maus auswählen', glyph: '▬' },
      { tool: 'underline', label: 'Unterstreichen', hint: 'Text mit der Maus auswählen', glyph: '⎯' },
      { tool: 'strike', label: 'Durchstreichen', hint: 'Text mit der Maus auswählen', glyph: '≡' },
    ],
  },
  {
    title: 'Zeichnen',
    tools: [
      { tool: 'ink', label: 'Freihand', hint: 'Mit gedrückter Maustaste zeichnen', glyph: '✎' },
      { tool: 'rect', label: 'Rechteck', hint: 'Aufziehen', glyph: '▭' },
      { tool: 'ellipse', label: 'Ellipse', hint: 'Aufziehen', glyph: '◯' },
      { tool: 'line', label: 'Linie', hint: 'Aufziehen', glyph: '╱' },
      { tool: 'arrow', label: 'Pfeil', hint: 'Aufziehen', glyph: '↗' },
    ],
  },
  {
    title: 'Einsetzen',
    tools: [
      { tool: 'text', label: 'Textfeld', hint: 'Aufziehen, dann schreiben', glyph: 'T' },
      { tool: 'note', label: 'Notiz', hint: 'Klicken und schreiben', glyph: '🗨' },
      { tool: 'signature', label: 'Unterschrift', hint: 'Zeichnen, tippen oder Bild', glyph: '✒' },
      { tool: 'image', label: 'Bild', hint: 'Bild auf die Seite setzen', glyph: '🖼' },
      { tool: 'redact', label: 'Schwärzen', hint: 'Bereich aufziehen', glyph: '█' },
    ],
  },
];

/** Colours that stay legible on white paper and are told apart by colour-blind readers. */
export const PALETTE = [
  '#ffd400',
  '#ff8a00',
  '#e5484d',
  '#d6409f',
  '#8e4ec6',
  '#0091ff',
  '#12a594',
  '#30a46c',
  '#111111',
  '#ffffff',
];

export function ToolPalette({
  tool,
  onTool,
  disabled,
}: {
  tool: Tool;
  onTool: (tool: Tool) => void;
  disabled?: boolean;
}) {
  return (
    /* Same reason as the toolbar above, and the same fix: one row, always, that scrolls
       where it has to. A breakpoint does not help — the WebView reports a width that says
       "desktop" on a device that is anything but. */
    <div className="flex flex-nowrap items-center gap-x-3 gap-y-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TOOL_GROUPS.map((group, index) => (
        <React.Fragment key={group.title}>
          {index > 0 && <span aria-hidden="true" className="h-5 w-px shrink-0 bg-[var(--lx-border)]" />}
          <div role="group" aria-label={group.title} className="flex shrink-0 items-center gap-1">
            {group.tools.map((definition) => (
              <button
                key={definition.tool}
                type="button"
                disabled={disabled}
                onClick={() => onTool(definition.tool)}
                aria-pressed={tool === definition.tool}
                aria-label={definition.label}
                title={`${definition.label} — ${definition.hint}`}
                className={
                  'inline-flex h-8 min-w-8 items-center justify-center rounded-[6px] border px-2 text-[13px] transition-colors duration-140 disabled:opacity-40 ' +
                  (tool === definition.tool
                    ? 'border-[var(--lx-accent)] bg-[var(--lx-accent)] text-[var(--lx-accent-on)]'
                    : 'border-[var(--lx-border)] text-[var(--lx-text-muted)] hover:bg-[var(--lx-surface-hover)] hover:text-[var(--lx-text)]')
                }
              >
                {definition.glyph}
              </button>
            ))}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

/** Which settings a tool actually uses. Showing the rest greyed out is noise. */
function usesColor(tool: Tool): boolean {
  return tool !== 'select' && tool !== 'redact' && tool !== 'image' && tool !== 'signature';
}

function usesStroke(tool: Tool): boolean {
  return ['ink', 'rect', 'ellipse', 'line', 'arrow', 'underline', 'strike'].includes(tool);
}

export function StyleBar({
  tool,
  style,
  onChange,
  onDelete,
  canDelete,
}: {
  tool: Tool;
  style: ToolStyle;
  onChange: (next: Partial<ToolStyle>) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  return (
    <div className="flex flex-nowrap items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {usesColor(tool) && (
        <div role="group" aria-label="Farbe" className="flex shrink-0 items-center gap-1">
          {PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ color })}
              aria-label={`Farbe ${color}`}
              aria-pressed={style.color === color}
              className="h-6 w-6 rounded-full border transition-transform duration-140 hover:scale-110"
              style={{
                background: color,
                borderColor: style.color === color ? 'var(--lx-text)' : 'var(--lx-border)',
                borderWidth: style.color === color ? 2 : 1,
              }}
            />
          ))}
        </div>
      )}

      {usesStroke(tool) && (
        <label className="flex items-center gap-2 text-[12px] text-[var(--lx-text-muted)]">
          Stärke
          <input
            type="range"
            min={0.5}
            max={12}
            step={0.5}
            value={style.strokeWidth}
            onChange={(event) => onChange({ strokeWidth: Number(event.target.value) })}
            className="lx-slider h-4 w-24 cursor-pointer appearance-none bg-transparent"
          />
          <span className="w-8 text-right font-mono tabular-nums">{style.strokeWidth}</span>
        </label>
      )}

      {tool === 'text' && (
        <label className="flex items-center gap-2 text-[12px] text-[var(--lx-text-muted)]">
          Größe
          <input
            type="range"
            min={6}
            max={48}
            step={1}
            value={style.fontSize}
            onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
            className="lx-slider h-4 w-24 cursor-pointer appearance-none bg-transparent"
          />
          <span className="w-8 text-right font-mono tabular-nums">{style.fontSize}</span>
        </label>
      )}

      {tool === 'highlight' && (
        <label className="flex items-center gap-2 text-[12px] text-[var(--lx-text-muted)]">
          Deckung
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={style.opacity}
            onChange={(event) => onChange({ opacity: Number(event.target.value) })}
            className="lx-slider h-4 w-24 cursor-pointer appearance-none bg-transparent"
          />
          <span className="w-10 text-right font-mono tabular-nums">
            {Math.round(style.opacity * 100)} %
          </span>
        </label>
      )}

      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto inline-flex h-8 shrink-0 items-center rounded-[6px] border border-[var(--lx-border)] px-3 text-[13px] text-[var(--lx-text-muted)] transition-colors duration-140 hover:border-[var(--lx-border-strong)] hover:text-[var(--lx-text)]"
        >
          Auswahl löschen
        </button>
      )}
    </div>
  );
}
