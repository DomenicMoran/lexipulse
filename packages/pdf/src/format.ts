/**
 * The one number format this package needs.
 *
 * Duplicated from the web app's `format.ts` rather than imported from it, because this
 * package also has to build inside the mobile WebView bundle, where nothing from
 * `apps/web` exists. One `Intl.NumberFormat` is a cheaper duplication than a dependency
 * that pulls a whole app's helpers across a boundary.
 */
const NUMBER = new Intl.NumberFormat('de-DE');

export function formatNumber(value: number): string {
  return NUMBER.format(Math.round(value));
}
