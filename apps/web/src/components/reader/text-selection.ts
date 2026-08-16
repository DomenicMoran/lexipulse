/**
 * Mapping the browser's text selection onto the token stream.
 *
 * Page mode renders one element per word and stamps each with its token index, so the
 * selection does not have to be measured in characters: whichever words the range touches
 * define the range of tokens, and a token range is what a highlight is anchored to.
 */

export interface TokenRange {
  start: number;
  end: number;
}

function elementOf(node: Node | null): HTMLElement | null {
  if (node === null) return null;
  return node instanceof HTMLElement ? node : node.parentElement;
}

function tokenIndexOf(node: Node | null): number | null {
  const holder = elementOf(node)?.closest<HTMLElement>('[data-token]');
  if (!holder) return null;
  const index = Number(holder.dataset.token);
  return Number.isNaN(index) ? null : index;
}

/**
 * The token range the current selection covers, or null when nothing inside `container`
 * is selected.
 *
 * The usual case is decided by the two endpoints alone. An endpoint can also land on the
 * space between two words — that space belongs to the paragraph, not to a word — and then
 * the range is read off the words it actually intersects. That scan is limited to the
 * common ancestor of the selection, so selecting inside one paragraph never walks the
 * book.
 */
export function selectedTokenRange(container: HTMLElement): TokenRange | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const first = tokenIndexOf(range.startContainer);
  const last = tokenIndexOf(range.endContainer);
  if (first !== null && last !== null) {
    return { start: Math.min(first, last), end: Math.max(first, last) };
  }

  const scope = elementOf(range.commonAncestorContainer) ?? container;
  let start = Number.POSITIVE_INFINITY;
  let end = -1;
  for (const word of scope.querySelectorAll<HTMLElement>('[data-token]')) {
    if (!range.intersectsNode(word)) continue;
    const index = Number(word.dataset.token);
    if (Number.isNaN(index)) continue;
    if (index < start) start = index;
    if (index > end) end = index;
  }
  return end < 0 ? null : { start, end };
}

/** Drop the browser selection, so the mark that was just made is the only thing on screen. */
export function clearSelection(): void {
  window.getSelection()?.removeAllRanges();
}

/** True while text is selected — used to tell a marking gesture from a click on a word. */
export function hasTextSelection(): boolean {
  const selection = window.getSelection();
  return selection !== null && !selection.isCollapsed;
}
