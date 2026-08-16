/** German number and duration formatting. Kept in one place so the UI never drifts. */

const NUMBER = new Intl.NumberFormat('de-DE');

export function formatNumber(value: number): string {
  return NUMBER.format(Math.round(value));
}

/** "4 Min.", "1 Std. 12 Min." — for estimates, not for the running clock. */
export function formatMinutes(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  if (totalMinutes < 1) return 'unter 1 Min.';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${totalMinutes} Min.`;
  if (minutes === 0) return `${hours} Std.`;
  return `${hours} Std. ${minutes} Min.`;
}

export function formatPercent(value: number): string {
  return `${Math.round(Math.min(Math.max(value, 0), 1) * 100)} %`;
}

const DATE = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function formatDate(timestamp: number): string {
  return DATE.format(new Date(timestamp));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Labels for the document sources, in the language of the interface. */
export const SOURCE_LABELS: Record<string, string> = {
  epub: 'EPUB',
  pdf: 'PDF',
  html: 'Web-Artikel',
  text: 'Text',
  markdown: 'Markdown',
  clipboard: 'Eingefügt',
};
