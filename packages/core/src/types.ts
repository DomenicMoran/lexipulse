/**
 * Shared domain types for the LexiPulse RSVP engine and document pipeline.
 * Platform-neutral: no DOM, no React Native, no Node built-ins.
 */

/** A single unit shown in the RSVP player. */
export interface RsvpToken {
  /** Zero-based position in the flattened token stream. */
  index: number;
  /** The rendered text, punctuation included. */
  text: string;
  /**
   * Byte-agnostic index of the Optimal Recognition Point inside `text`.
   * The character at this index is the one pinned to the player's fixed focus column.
   */
  orp: number;
  /** Milliseconds this token stays on screen at the current settings. Filled by the pacer. */
  durationMs: number;
  /** Index of the chapter this token belongs to. */
  chapterIndex: number;
  /** Index of the paragraph (within the whole document) this token belongs to. */
  paragraphIndex: number;
  /** Index of the sentence (within the whole document) this token belongs to. */
  sentenceIndex: number;
  /** Character offset of the token inside the chapter's plain text. */
  charOffset: number;
  /** True when the token terminates a sentence (., !, ?, …). */
  endsSentence: boolean;
  /** True when the token is the last of its paragraph. */
  endsParagraph: boolean;
  /** True when the token contains at least one digit. */
  isNumeric: boolean;
  /**
   * True when this token is a non-final segment of a word the tokenizer had to split.
   * Rejoining must not insert a space after it.
   */
  continuesWord?: boolean;
  /**
   * True when the trailing hyphen was inserted by the splitter rather than present in
   * the source. Only such a hyphen may be dropped when rejoining — removing a real one
   * would turn "Bundes-Immissionsschutz" into "BundesImmissionsschutz".
   */
  syntheticHyphen?: boolean;
}

/** A logical section of a document. */
export interface DocumentChapter {
  id: string;
  title: string;
  /** Cleaned, paragraph-separated plain text ("\n\n" between paragraphs). */
  text: string;
  /** Index of the first token of this chapter in the document token stream. */
  startToken: number;
  /** Number of tokens in this chapter. */
  tokenCount: number;
}

export type DocumentSource = 'epub' | 'fb2' | 'pdf' | 'html' | 'text' | 'markdown' | 'clipboard';

/** A fully imported, reader-ready document. */
export interface LexiDocument {
  id: string;
  title: string;
  author: string | null;
  source: DocumentSource;
  /** Original file name or URL, when known. */
  origin: string | null;
  language: string | null;
  chapters: DocumentChapter[];
  /**
   * Estimated token count. Equal to `wordCount` at import time; the real count is
   * settings-dependent, because words above the tokenizer's length cap are split into
   * several tokens. Use it for library badges, not for progress arithmetic.
   */
  totalTokens: number;
  /** Whitespace-delimited word count. Stable across settings. */
  wordCount: number;
  /** Cover image as a data URL, when the source provided one. */
  coverDataUrl: string | null;
  createdAt: number;
  updatedAt: number;
  /** Diagnostics produced by the import pipeline. */
  importReport: ImportReport;
  /**
   * The original file, when it was kept.
   *
   * Absent on every document imported before the original surface existed, and on
   * sources that have no file at all (clipboard, URL). Code that renders the original
   * must treat it as optional, never assume it.
   */
  original?: DocumentOriginal | null;
  /**
   * Word offset in the document text at which each source page begins.
   * Only present for paged sources. Index 0 is page 1.
   */
  pageWordStarts?: number[] | null;
}

/**
 * Where the untouched source file lives, and what it is.
 *
 * The bytes themselves are not in the document record: a 40 MB PDF inside a JSON blob
 * would be read and rewritten on every progress update. They sit in the `FileStore`
 * under `fileId`, which is deleted with the document.
 */
export interface DocumentOriginal {
  /** Key in the platform's `FileStore`. */
  fileId: string;
  /** MIME type as reported by the picker, or derived from the extension. */
  mime: string;
  /** Size in bytes, for the library and for the storage warning. */
  bytes: number;
  /** File name the user knows it by. */
  fileName: string | null;
  /** Pages, for formats that have them. */
  pageCount?: number | null;
  /** True when the file needed a password to open. */
  encrypted?: boolean;
}

/** Diagnostics about what the import pipeline did to the raw source. */
export interface ImportReport {
  source: DocumentSource;
  /** Number of raw pages/sections the parser saw. */
  rawSections: number;
  /** Lines dropped by the smart filter, keyed by reason. */
  removed: {
    headers: number;
    footers: number;
    pageNumbers: number;
    tableRows: number;
    artifacts: number;
  };
  /** Number of hyphenated line-breaks that were rejoined. */
  dehyphenated: number;
  /** Human-readable notes for the UI. */
  notes: string[];
  /** Milliseconds the import took. */
  durationMs: number;
}

export type AccentName = 'coral' | 'amber' | 'cyber';
export type ThemeName = 'oled' | 'graphite' | 'sepia' | 'minimal';

/** Multipliers applied on top of the base word duration. */
export interface PacingMatrix {
  /** Words longer than `longWordThreshold` characters. Default 1.25 (+25%). */
  longWord: number;
  /** Character count above which a word counts as long. Default 8. */
  longWordThreshold: number;
  /** Sentence-terminating punctuation: . ! ? … Default 1.75 (+75%). */
  sentenceEnd: number;
  /** Intra-sentence punctuation: , ; : — Default 1.75 (+75%). */
  clauseEnd: number;
  /** Extra pause on the last token of a paragraph. Default 2.0. */
  paragraphEnd: number;
  /** Tokens containing digits. Default 1.4. */
  numeric: number;
  /** Very short function words (<= 3 chars, no punctuation). Default 0.9. */
  shortWord: number;
  /** Hard floor so extreme WPM values stay legible. Default 40 ms. */
  minDurationMs: number;
  /** Hard ceiling so a single token can never stall the player. Default 3000 ms. */
  maxDurationMs: number;
}

export interface RsvpSettings {
  /** Words per minute, 100–1200. */
  wpm: number;
  pacing: PacingMatrix;
  theme: ThemeName;
  accent: AccentName;
  /** Font family key resolved by the UI layer. */
  fontFamily: FontKey;
  /** Player font size in px (mobile: dp). */
  fontSize: number;
  /** Show the vertical ORP guide rails. */
  showFocusGuides: boolean;
  /** Show the progress bar under the player. */
  showProgress: boolean;
  /** Show a live WPM / time-remaining readout. */
  showStats: boolean;
  /** Number of context words rendered left/right of the active token (0 = pure RSVP). */
  contextWords: number;
  /** Ramp up from 40 % to full WPM over the first N tokens after each resume. */
  warmupTokens: number;
  /** Pause automatically at the end of every paragraph. */
  pauseOnParagraph: boolean;
  /** Tokens to jump back on rewind. Default 10. */
  rewindTokens: number;
  /** Play a click on each sentence end. */
  soundEnabled: boolean;
  /** Speak the text via TTS in sync with the RSVP stream. */
  ttsEnabled: boolean;
  /** TTS voice identifier, platform-specific. */
  ttsVoice: string | null;
  /** Keep the screen awake while playing. */
  keepAwake: boolean;
  /** Respect prefers-reduced-motion / disable non-essential animation. */
  reduceMotion: boolean;

  /* ------------------------------------------------------------------ page mode */

  /**
   * Which surface a document opens in. RSVP is what the app is for; page mode is what
   * makes it a reader you can actually live in. Both share one position, so switching
   * never costs the reader their place.
   */
  readerMode: ReaderMode;
  /** Body size in page mode, in points. Separate from the RSVP stage size. */
  readerFontSize: number;
  /** Multiplier on the body size. 1.6 is comfortable for continuous prose. */
  readerLineHeight: number;
  /** Horizontal padding in page mode, in points. */
  readerMargin: number;
  /** Justified rather than ragged right. */
  readerJustify: boolean;
  /** Typeface for page mode. `open-dyslexic` is the accessibility option. */
  readerFont: ReaderFontKey;
  /** Turn pages instead of scrolling continuously. */
  readerPaged: boolean;
  /** Auto-scroll speed in points per second. 0 is off. */
  readerAutoScroll: number;
  /** Bold the leading letters of every word — "bionic" reading. 0 is off, 1–5 is strength. */
  readerBionic: number;
  /** A band that follows the current line. 0 is off. */
  readerRuler: number;
  /** Tint laid over the page for readers who need one. */
  readerOverlay: OverlayKey;
  /**
   * Words to read per day, 0 when no goal is set.
   *
   * Words rather than minutes on purpose: minutes reward leaving the stream running,
   * words reward reading. The statistics already count words per day, so the goal reads
   * the same number the reader sees.
   */
  dailyGoalWords: number;
}

export type ReaderMode = 'rsvp' | 'page';

/**
 * Page-mode typefaces. Serif for long prose, sans for screens, and OpenDyslexic —
 * bottom-weighted letters that stop b/d and p/q from flipping.
 */
export type ReaderFontKey = 'literata' | 'inter' | 'system' | 'open-dyslexic';

/** Irlen-style tints. Named by hue because that is how readers pick them. */
export type OverlayKey = 'none' | 'cream' | 'peach' | 'rose' | 'mint' | 'sky' | 'lilac';

export type FontKey = 'jetbrains-mono' | 'ibm-plex-mono' | 'system-mono' | 'inter' | 'literata';

/** Persisted reading position for a document. */
export interface ReadingProgress {
  documentId: string;
  tokenIndex: number;
  chapterIndex: number;
  /** 0–1. */
  percent: number;
  updatedAt: number;
  /** Total milliseconds actually spent reading this document. */
  msRead: number;
}

/**
 * A highlighted passage, optionally with a note.
 *
 * Anchored to a token range rather than a character offset: tokens survive a re-parse of
 * the same document, character offsets do not once the cleaner changes by a byte.
 */
export interface Annotation {
  id: string;
  documentId: string;
  /** Inclusive. */
  startToken: number;
  /** Inclusive. */
  endToken: number;
  chapterIndex: number;
  color: HighlightColor;
  /** The highlighted text itself, for the list and the export. */
  text: string;
  note: string | null;
  createdAt: number;
  updatedAt: number;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

/** A user highlight/bookmark anchored to a token range. */
export interface Bookmark {
  id: string;
  documentId: string;
  tokenIndex: number;
  chapterIndex: number;
  /** Snippet of surrounding text for the list UI. */
  preview: string;
  note: string | null;
  createdAt: number;
}

export interface LibraryEntry {
  document: LexiDocument;
  progress: ReadingProgress | null;
}

/**
 * The tags a document is filed under.
 *
 * Stored next to the document rather than inside it: the import pipeline rewrites the
 * whole `LexiDocument` record whenever a file is imported again, and re-importing a book
 * must not silently empty the shelves the reader sorted it onto.
 */
export interface DocumentTags {
  documentId: string;
  /** Normalised: trimmed, deduplicated case-insensitively, alphabetical. */
  tags: string[];
  updatedAt: number;
}

/** Aggregate reading statistics used by the dashboard. */
export interface ReadingStats {
  totalMsRead: number;
  totalTokensRead: number;
  documentsStarted: number;
  documentsFinished: number;
  /** Rolling average of effective WPM across sessions. */
  averageWpm: number;
  /** ISO date (YYYY-MM-DD) → tokens read, for the activity heatmap. */
  daily: Record<string, number>;
  /** Consecutive days with at least one session, ending today. */
  streakDays: number;
}
