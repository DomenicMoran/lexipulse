import type { PdfFieldValue, PdfMark } from '@lexipulse/core';

/**
 * Everything the surface needs from the platform underneath it, and nothing more.
 *
 * The viewer and the editor are one implementation used by two very different hosts: a
 * browser tab, where storage is IndexedDB and "save" means a download, and a WebView
 * inside the mobile app, where storage is SQLite and "save" means the share sheet. Neither
 * of those belongs in a component that draws a page.
 *
 * Every method is asynchronous, including the ones a browser could answer immediately.
 * The mobile host answers over a message channel, and a signature that only fits the
 * faster of the two hosts is a signature that has to be rewritten the moment the other
 * one arrives.
 */
export interface PdfHost {
  documentId: string;
  title: string;
  /**
   * Words in the extracted text.
   *
   * Zero for a scan. The surface uses it to decide whether handing over to the word
   * stream is an offer worth making at all.
   */
  wordCount: number;
  /** The name the reader knows the file by, for the exported copy. */
  fileName: string | null;

  loadOriginal(): Promise<Uint8Array | null>;
  /** Overwrite the stored original with an edited version. */
  replaceOriginal(bytes: Uint8Array): Promise<void>;

  listMarks(): Promise<PdfMark[]>;
  saveMark(mark: PdfMark): Promise<void>;
  deleteMark(id: string): Promise<void>;

  getFormValues(): Promise<Record<string, PdfFieldValue>>;
  setFormValues(values: Record<string, PdfFieldValue>): Promise<void>;

  /** Store a stamped picture and return the id a mark refers to it by. */
  putStamp(bytes: Uint8Array, mime: string): Promise<string>;
  getStamp(id: string): Promise<{ bytes: Uint8Array; mime: string } | null>;

  /** Hand a finished file to the platform: a download here, a share sheet there. */
  deliver(bytes: Uint8Array, fileName: string, mime: string): Promise<void>;
  /**
   * What `deliver` does, in the reader's words.
   *
   * The save dialog has to say it, and "als neue Datei herunterladen" is simply wrong on
   * a phone — there is no download, there is a share sheet. Only the host knows which.
   */
  deliverKind: 'download' | 'share';

  /**
   * Ask the platform for a picture the reader chooses.
   *
   * A file input on the web, the photo library on a device. Returning null means they
   * changed their mind, which is not an error.
   */
  pickImage(): Promise<{ bytes: Uint8Array; mime: string; ratio: number } | null>;

  /** Leave for the word stream at this page. Absent when there is no stream to go to. */
  toStream?: (page: number) => void;
}

/** A mark and its page, as the surface hands it back to the host. */
export type { PdfFieldValue, PdfMark };
