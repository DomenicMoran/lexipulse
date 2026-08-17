import type { PdfFieldValue, PdfMark } from '@lexipulse/core';

/**
 * Writing a PDF back out.
 *
 * Everything the reader added lives beside the document as editable records; this module
 * is the one place that turns them into a file. It runs entirely in the tab: pdf-lib
 * assembles the bytes, pdf.js draws the pages that have to become pictures, and nothing
 * is uploaded anywhere. That is the same promise the import path makes, and it is the
 * only reason a document editor belongs in this app at all.
 *
 * pdf-lib is loaded on demand. A reader who never edits anything must not pay for it.
 */

type PdfLibModule = typeof import('@cantoo/pdf-lib');

let pdfLibPromise: Promise<PdfLibModule> | null = null;

function getPdfLib(): Promise<PdfLibModule> {
  if (!pdfLibPromise) pdfLibPromise = import('@cantoo/pdf-lib');
  return pdfLibPromise;
}

/** `#rrggbb` → the 0–1 triple pdf-lib wants. Unreadable input falls back to black. */
export function parseColor(hex: string): { r: number; g: number; b: number } {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return { r: 0, g: 0, b: 0 };
  const value = Number.parseInt(match[1] as string, 16);
  return {
    r: ((value >> 16) & 0xff) / 255,
    g: ((value >> 8) & 0xff) / 255,
    b: (value & 0xff) / 255,
  };
}

/**
 * Drop what the standard fonts cannot encode.
 *
 * The fourteen standard fonts speak WinAnsi, which covers German, French, Spanish and the
 * rest of western Europe but not Greek, Cyrillic or CJK. Throwing on an unencodable
 * character would fail the whole export over one pasted symbol; replacing it keeps the
 * document and loses one glyph, which is the lesser damage and is visible to the reader.
 */
export function toWinAnsi(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 10 || code === 13 || (code >= 32 && code <= 126)) out += char;
    else if (code >= 160 && code <= 255) out += char;
    else if ('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.includes(char)) out += char;
    else out += '?';
  }
  return out;
}

/** Break a paragraph into lines that fit `width`, measured in the font it will be drawn in. */
export function wrapText(
  text: string,
  measure: (line: string) => number,
  width: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (paragraph.trim().length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line.length === 0 ? word : `${line} ${word}`;
      if (line.length > 0 && measure(candidate) > width) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line.length > 0) lines.push(line);
  }
  return lines;
}

/* ------------------------------------------------------------------ page operations */

export type PageOp =
  | { kind: 'rotate'; page: number; degrees: 90 | 180 | 270 }
  | { kind: 'delete'; page: number }
  | { kind: 'move'; page: number; to: number }
  | { kind: 'insertBlank'; after: number }
  | { kind: 'insertPdf'; after: number; bytes: Uint8Array }
  | { kind: 'insertImage'; after: number; bytes: Uint8Array; mime: string };

/**
 * Where a mark's page ends up after an operation, or null when its page is gone.
 *
 * Marks are anchored to a page number, so every structural change has to move them with
 * it. Getting this wrong is quiet and expensive: a highlight silently reappears three
 * pages away from the sentence it belonged to, and there is nothing on screen to suggest
 * anything went wrong.
 */
export function remapPage(op: PageOp, page: number): number | null {
  switch (op.kind) {
    case 'rotate':
      return page;
    case 'delete':
      if (page === op.page) return null;
      return page > op.page ? page - 1 : page;
    case 'move': {
      if (page === op.page) return op.to;
      // Everything between the old and the new position shifts one step the other way.
      if (op.to > op.page) return page > op.page && page <= op.to ? page - 1 : page;
      if (op.to < op.page) return page >= op.to && page < op.page ? page + 1 : page;
      return page;
    }
    case 'insertBlank':
    case 'insertImage':
      return page > op.after ? page + 1 : page;
    case 'insertPdf':
      // The inserted file brings its own pages; the caller knows how many.
      return page > op.after ? page + countPages(op.bytes) : page;
    default:
      return page;
  }
}

/**
 * Pages in a PDF, counted without parsing it properly.
 *
 * `/Type /Page` occurrences in the raw bytes. Used only to shift mark page numbers when a
 * file is inserted, where being one out is a misplaced highlight rather than a broken
 * document — and where loading the file a second time just to count would double the
 * work of the insertion itself.
 */
function countPages(bytes: Uint8Array): number {
  const text = new TextDecoder('latin1').decode(bytes);
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  return Math.max(1, matches?.length ?? 1);
}

export interface BuildOptions {
  marks: readonly PdfMark[];
  formValues?: Record<string, PdfFieldValue>;
  /** Write the form values in and make the fields uneditable. */
  flattenForm?: boolean;
  /** Resolve a stamp picture by its `FileStore` id. */
  loadImage?: (id: string) => Promise<{ bytes: Uint8Array; mime: string } | null>;
  /**
   * Turn every page carrying a redaction into a picture before drawing the black boxes.
   *
   * This is the difference between covering text and removing it. A black rectangle drawn
   * over a word leaves the word in the file, one copy-paste away from being read again;
   * replacing the page with a rendering of itself removes the text objects altogether.
   * The page stops being selectable, which is the price, and the reader is told so.
   */
  hardRedaction?: boolean;
  /** Renders a page to a PNG. Required when `hardRedaction` is on. */
  renderPage?: (page: number, scale: number) => Promise<Uint8Array>;
  /** Resolution for that rendering. 2 keeps 300 dpi-ish text legible. */
  redactionScale?: number;
  ops?: readonly PageOp[];
  password?: string;
}

/**
 * Apply the page operations, then draw everything the reader added, then save.
 *
 * The order matters: operations change which page is which, so they run first and the
 * marks are placed against the result. Marks whose page no longer exists are dropped
 * rather than moved — a highlight on a deleted page has no honest new home.
 */
export async function buildPdf(original: Uint8Array, options: BuildOptions): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, degrees, rgb, BlendMode, LineCapStyle, PDFString, PDFName } =
    await getPdfLib();

  const doc = await PDFDocument.load(original.slice() as unknown as ArrayBuffer, {
    ignoreEncryption: true,
    password: options.password,
  });

  if (options.ops && options.ops.length > 0) await applyOps(doc, options.ops, PDFDocument);

  /* ----------------------------------------------------------------- form fields */

  if (options.formValues && Object.keys(options.formValues).length > 0) {
    const form = doc.getForm();
    for (const [name, value] of Object.entries(options.formValues)) {
      try {
        if (typeof value === 'boolean') {
          const box = form.getCheckBox(name);
          if (value) box.check();
          else box.uncheck();
        } else if (Array.isArray(value)) {
          form.getOptionList(name).select(value);
        } else {
          const field = form.getFieldMaybe(name);
          const type = field?.constructor?.name ?? '';
          if (type.includes('Dropdown')) form.getDropdown(name).select(value);
          else if (type.includes('RadioGroup')) form.getRadioGroup(name).select(value);
          else form.getTextField(name).setText(value);
        }
      } catch {
        // A field the document does not have, or one whose type changed since the value
        // was recorded. One bad field must not cost the reader the whole export.
      }
    }
    if (options.flattenForm) {
      try {
        form.flatten();
      } catch {
        // Flattening fails on a few malformed forms. The values are already written, so
        // the export is still correct — the fields simply stay editable.
      }
    }
  }

  /* ------------------------------------------------------------------ redaction */

  const pages = doc.getPages();
  const redactedPages = new Set(
    options.marks.filter((mark) => mark.kind === 'redact').map((mark) => mark.page),
  );

  if (options.hardRedaction && options.renderPage && redactedPages.size > 0) {
    const scale = options.redactionScale ?? 2;
    for (const pageNumber of redactedPages) {
      const page = pages[pageNumber - 1];
      if (!page) continue;
      const png = await options.renderPage(pageNumber, scale);
      const image = await doc.embedPng(png.slice() as unknown as ArrayBuffer);
      const { width, height } = page.getSize();
      // The old content is replaced, not covered: everything the page drew is gone and
      // what remains is a picture of it.
      page.node.set(PDFName.of('Contents'), doc.context.obj([]));
      page.drawImage(image, { x: 0, y: 0, width, height });
    }
  }

  /* ---------------------------------------------------------------------- marks */

  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const mark of [...options.marks].sort((a, b) => a.createdAt - b.createdAt)) {
    const page = pages[mark.page - 1];
    if (!page) continue;

    const [x1, y1, x2, y2] = mark.rect;
    const width = x2 - x1;
    const height = y2 - y1;
    const { r, g, b } = parseColor(mark.color);
    const color = rgb(r, g, b);

    switch (mark.kind) {
      case 'highlight':
        page.drawRectangle({
          x: x1,
          y: y1,
          width,
          height,
          color,
          opacity: mark.opacity,
          // Multiply rather than plain alpha: a yellow bar at 40 % over black text greys
          // the text out, a multiplied one leaves it black on yellow, the way a marker pen
          // behaves on paper.
          blendMode: BlendMode.Multiply,
        });
        break;

      case 'underline':
        page.drawLine({
          start: { x: x1, y: y1 },
          end: { x: x2, y: y1 },
          thickness: mark.strokeWidth,
          color,
          opacity: mark.opacity,
        });
        break;

      case 'strike':
        page.drawLine({
          start: { x: x1, y: (y1 + y2) / 2 },
          end: { x: x2, y: (y1 + y2) / 2 },
          thickness: mark.strokeWidth,
          color,
          opacity: mark.opacity,
        });
        break;

      case 'ink':
        for (const path of mark.paths ?? []) {
          for (let i = 0; i + 3 < path.length; i += 2) {
            page.drawLine({
              start: { x: path[i] as number, y: path[i + 1] as number },
              end: { x: path[i + 2] as number, y: path[i + 3] as number },
              thickness: mark.strokeWidth,
              color,
              opacity: mark.opacity,
              lineCap: LineCapStyle.Round,
            });
          }
          // A single tap is a dot, and a dot has no segment to draw.
          if (path.length === 2) {
            page.drawCircle({
              x: path[0] as number,
              y: path[1] as number,
              size: mark.strokeWidth / 2,
              color,
              opacity: mark.opacity,
            });
          }
        }
        break;

      case 'rect':
        page.drawRectangle({
          x: x1,
          y: y1,
          width,
          height,
          borderColor: color,
          borderWidth: mark.strokeWidth,
          borderOpacity: mark.opacity,
        });
        break;

      case 'ellipse':
        page.drawEllipse({
          x: (x1 + x2) / 2,
          y: (y1 + y2) / 2,
          xScale: width / 2,
          yScale: height / 2,
          borderColor: color,
          borderWidth: mark.strokeWidth,
          borderOpacity: mark.opacity,
        });
        break;

      case 'line':
      case 'arrow': {
        // The drag defines the line: it starts where the pointer went down, which the
        // normalised box no longer records, so the stored path carries the direction.
        const path = mark.paths?.[0];
        const sx = path?.[0] ?? x1;
        const sy = path?.[1] ?? y2;
        const ex = path?.[2] ?? x2;
        const ey = path?.[3] ?? y1;
        page.drawLine({
          start: { x: sx, y: sy },
          end: { x: ex, y: ey },
          thickness: mark.strokeWidth,
          color,
          opacity: mark.opacity,
          lineCap: LineCapStyle.Round,
        });
        if (mark.kind === 'arrow') {
          drawArrowHead(page, { sx, sy, ex, ey }, mark.strokeWidth, color, mark.opacity);
        }
        break;
      }

      case 'redact':
        page.drawRectangle({ x: x1, y: y1, width, height, color: rgb(0, 0, 0), opacity: 1 });
        break;

      case 'text': {
        const size = mark.fontSize ?? 12;
        const text = toWinAnsi(mark.text ?? '');
        if (text.length === 0) break;
        const lines = wrapText(text, (line) => helvetica.widthOfTextAtSize(line, size), width);
        const lineHeight = size * 1.25;
        lines.forEach((line, index) => {
          page.drawText(line, {
            x: x1,
            // Text grows downwards from the top edge of the box the reader drew.
            y: y2 - size - index * lineHeight,
            size,
            font: helvetica,
            color,
            opacity: mark.opacity,
          });
        });
        break;
      }

      case 'note': {
        const size = 14;
        page.drawRectangle({
          x: x1,
          y: y1,
          width: size,
          height: size,
          color,
          opacity: 1,
          borderColor: rgb(0.2, 0.2, 0.2),
          borderWidth: 0.5,
        });
        page.drawText('i', {
          x: x1 + size / 2 - 1.5,
          y: y1 + 3,
          size: 9,
          font: helveticaBold,
          color: rgb(0.1, 0.1, 0.1),
        });
        /*
         * Also a real PDF sticky note, so the text is readable in any other viewer.
         *
         * Drawn *and* annotated on purpose: the drawing survives printing and flattening,
         * the annotation carries the words. Written through the low-level object model
         * because pdf-lib has no API for annotations — this is the whole dictionary the
         * specification asks for.
         */
        const annotation = doc.context.obj({
          Type: PDFName.of('Annot'),
          Subtype: PDFName.of('Text'),
          Rect: [x1, y1, x1 + size, y1 + size],
          Contents: PDFString.of(mark.text ?? ''),
          T: PDFString.of('LexiPulse'),
          Name: PDFName.of('Comment'),
          F: 4,
        });
        page.node.addAnnot(doc.context.register(annotation));
        break;
      }

      case 'image':
      case 'signature': {
        if (!mark.imageId || !options.loadImage) break;
        const picture = await options.loadImage(mark.imageId);
        if (!picture) break;
        const buffer = picture.bytes.slice() as unknown as ArrayBuffer;
        const embedded = picture.mime.includes('jpeg')
          ? await doc.embedJpg(buffer)
          : await doc.embedPng(buffer);
        page.drawImage(embedded, {
          x: x1,
          y: y1,
          width,
          height,
          opacity: mark.opacity,
          ...(mark.rotation ? { rotate: degrees(mark.rotation) } : {}),
        });
        break;
      }
    }
  }

  doc.setModificationDate(new Date());
  return doc.save({ useObjectStreams: true });
}

interface ArrowGeometry {
  sx: number;
  sy: number;
  ex: number;
  ey: number;
}

function drawArrowHead(
  page: import('@cantoo/pdf-lib').PDFPage,
  { sx, sy, ex, ey }: ArrowGeometry,
  thickness: number,
  color: import('@cantoo/pdf-lib').Color,
  opacity: number,
): void {
  const angle = Math.atan2(ey - sy, ex - sx);
  const length = Math.max(thickness * 4, 8);
  const spread = Math.PI / 7;
  for (const side of [-1, 1]) {
    page.drawLine({
      start: { x: ex, y: ey },
      end: {
        x: ex - length * Math.cos(angle + side * spread),
        y: ey - length * Math.sin(angle + side * spread),
      },
      thickness,
      color,
      opacity,
    });
  }
}

/**
 * Rearrange the document.
 *
 * Everything is expressed against the page order as it stands when the operation runs, so
 * the caller can queue "delete 3, then move 5 to the front" and get what they asked for.
 */
async function applyOps(
  doc: import('@cantoo/pdf-lib').PDFDocument,
  ops: readonly PageOp[],
  PDFDocument: PdfLibModule['PDFDocument'],
): Promise<void> {
  const { degrees } = await getPdfLib();

  for (const op of ops) {
    const count = doc.getPageCount();
    switch (op.kind) {
      case 'rotate': {
        const page = doc.getPage(op.page - 1);
        if (!page) break;
        // Added to whatever the page already carries: a page that arrives sideways and is
        // turned once more has to end up upright, not merely at 90°.
        page.setRotation(degrees((page.getRotation().angle + op.degrees) % 360));
        break;
      }
      case 'delete':
        // Refusing to empty the document: a PDF with no pages will not open anywhere.
        if (count > 1 && op.page >= 1 && op.page <= count) doc.removePage(op.page - 1);
        break;
      case 'move': {
        if (op.page < 1 || op.page > count) break;
        /*
         * Copied to the new position, then removed from the old one.
         *
         * `removePage` deletes the page object from the file, not just from the page
         * tree, so re-inserting the same page afterwards leaves a reference pointing at
         * nothing and the page silently vanishes on save. Copying the document into
         * itself produces an independent page — annotations and links included — that
         * survives the removal of the original.
         */
        const [copy] = await doc.copyPages(doc, [op.page - 1]);
        if (!copy) break;
        const target = Math.min(Math.max(op.to - 1, 0), count);
        doc.insertPage(target, copy);
        doc.removePage(op.page - 1 + (target <= op.page - 1 ? 1 : 0));
        break;
      }
      case 'insertBlank': {
        const reference = doc.getPage(Math.min(Math.max(op.after - 1, 0), count - 1));
        const size = reference ? reference.getSize() : { width: 595.28, height: 841.89 };
        doc.insertPage(Math.min(op.after, count), [size.width, size.height]);
        break;
      }
      case 'insertPdf': {
        const source = await PDFDocument.load(op.bytes.slice() as unknown as ArrayBuffer, {
          ignoreEncryption: true,
        });
        const copied = await doc.copyPages(source, source.getPageIndices());
        copied.forEach((page, index) => {
          doc.insertPage(Math.min(op.after + index, doc.getPageCount()), page);
        });
        break;
      }
      case 'insertImage': {
        const buffer = op.bytes.slice() as unknown as ArrayBuffer;
        const image = op.mime.includes('jpeg')
          ? await doc.embedJpg(buffer)
          : await doc.embedPng(buffer);
        // A4 with the picture fitted inside it, so a stack of photos comes out as a
        // document rather than as pages of wildly different sizes.
        const page = doc.insertPage(Math.min(op.after, doc.getPageCount()), [595.28, 841.89]);
        const scale = Math.min(
          (595.28 - 40) / image.width,
          (841.89 - 40) / image.height,
        );
        page.drawImage(image, {
          x: (595.28 - image.width * scale) / 2,
          y: (841.89 - image.height * scale) / 2,
          width: image.width * scale,
          height: image.height * scale,
        });
        break;
      }
    }
  }
}

/* ------------------------------------------------------------------ whole files */

/** Join several PDFs into one, in the order given. */
export async function mergePdfs(files: readonly Uint8Array[]): Promise<Uint8Array> {
  const { PDFDocument } = await getPdfLib();
  const out = await PDFDocument.create();
  for (const bytes of files) {
    const source = await PDFDocument.load(bytes.slice() as unknown as ArrayBuffer, {
      ignoreEncryption: true,
    });
    const copied = await out.copyPages(source, source.getPageIndices());
    for (const page of copied) out.addPage(page);
  }
  return out.save({ useObjectStreams: true });
}

/** A new document holding only the pages listed, in that order. 1-based. */
export async function extractPages(
  original: Uint8Array,
  pages: readonly number[],
): Promise<Uint8Array> {
  const { PDFDocument } = await getPdfLib();
  const source = await PDFDocument.load(original.slice() as unknown as ArrayBuffer, {
    ignoreEncryption: true,
  });
  const out = await PDFDocument.create();
  const indices = pages
    .map((page) => page - 1)
    .filter((index) => index >= 0 && index < source.getPageCount());
  const copied = await out.copyPages(source, indices);
  for (const page of copied) out.addPage(page);
  return out.save({ useObjectStreams: true });
}

/** Build a PDF out of pictures, one page each. */
export async function imagesToPdf(
  images: readonly { bytes: Uint8Array; mime: string }[],
): Promise<Uint8Array> {
  const { PDFDocument } = await getPdfLib();
  const doc = await PDFDocument.create();
  for (const picture of images) {
    const buffer = picture.bytes.slice() as unknown as ArrayBuffer;
    const image = picture.mime.includes('jpeg')
      ? await doc.embedJpg(buffer)
      : await doc.embedPng(buffer);
    const page = doc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  return doc.save({ useObjectStreams: true });
}

export interface PdfProperties {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
}

/** Rewrite the document information dictionary. */
export async function setProperties(
  original: Uint8Array,
  properties: PdfProperties,
): Promise<Uint8Array> {
  const { PDFDocument } = await getPdfLib();
  const doc = await PDFDocument.load(original.slice() as unknown as ArrayBuffer, {
    ignoreEncryption: true,
  });
  if (properties.title !== undefined) doc.setTitle(properties.title);
  if (properties.author !== undefined) doc.setAuthor(properties.author);
  if (properties.subject !== undefined) doc.setSubject(properties.subject);
  if (properties.keywords !== undefined) doc.setKeywords(properties.keywords);
  doc.setModificationDate(new Date());
  return doc.save({ useObjectStreams: true });
}

/* ------------------------------------------------------------------ form reading */

export interface PdfFormField {
  name: string;
  type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'options' | 'button';
  /** For the choice types. */
  options?: string[];
  value?: PdfFieldValue;
  readOnly: boolean;
  multiline?: boolean;
}

/**
 * The interactive fields a document declares, with whatever is already in them.
 *
 * Read through pdf-lib rather than pdf.js: pdf.js reports widget annotations, one per
 * visible box, and a radio group is several of those under one name. pdf-lib reports the
 * field, which is what the reader answers.
 */
export async function readFormFields(original: Uint8Array): Promise<PdfFormField[]> {
  const { PDFDocument } = await getPdfLib();
  const doc = await PDFDocument.load(original.slice() as unknown as ArrayBuffer, {
    ignoreEncryption: true,
  });

  const out: PdfFormField[] = [];
  let form;
  try {
    form = doc.getForm();
  } catch {
    return out;
  }

  for (const field of form.getFields()) {
    const name = field.getName();
    const type = field.constructor?.name ?? '';
    const readOnly = field.isReadOnly();

    try {
      if (type.includes('TextField')) {
        const text = form.getTextField(name);
        out.push({
          name,
          type: 'text',
          value: text.getText() ?? '',
          readOnly,
          multiline: text.isMultiline(),
        });
      } else if (type.includes('CheckBox')) {
        out.push({ name, type: 'checkbox', value: form.getCheckBox(name).isChecked(), readOnly });
      } else if (type.includes('RadioGroup')) {
        const group = form.getRadioGroup(name);
        out.push({
          name,
          type: 'radio',
          options: group.getOptions(),
          value: group.getSelected() ?? '',
          readOnly,
        });
      } else if (type.includes('Dropdown')) {
        const dropdown = form.getDropdown(name);
        out.push({
          name,
          type: 'dropdown',
          options: dropdown.getOptions(),
          value: dropdown.getSelected()[0] ?? '',
          readOnly,
        });
      } else if (type.includes('OptionList')) {
        const list = form.getOptionList(name);
        out.push({
          name,
          type: 'options',
          options: list.getOptions(),
          value: list.getSelected(),
          readOnly,
        });
      }
    } catch {
      // A field whose type pdf-lib cannot read is left out rather than shown broken.
    }
  }

  return out;
}
