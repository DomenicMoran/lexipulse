/**
 * What the library list shows, derived from the query, the tags and nothing else.
 *
 * Kept out of the component because this is the part with the branches: a search that also
 * has to look inside the shelves, and a filter that must not survive the tag it points at.
 */
import { fold, type LibraryEntry } from '@lexipulse/core';

/** Document id to its tags, the shape `LexiStore.tagIndex()` returns. */
export type TagIndex = Record<string, string[]>;

/**
 * Every tag in the library, once, in reading order.
 *
 * Tags are folded to compare them, so "Sachbuch" and "sachbuch" are one shelf. The first
 * spelling encountered is the one that names it, which is the same rule `normalizeTags`
 * follows inside a single document.
 */
export function allTagsOf(index: TagIndex): string[] {
  const bySpelling = new Map<string, string>();
  for (const list of Object.values(index)) {
    for (const tag of list) {
      const key = fold(tag);
      if (!bySpelling.has(key)) bySpelling.set(key, tag);
    }
  }
  return [...bySpelling.values()].sort((a, b) => fold(a).localeCompare(fold(b)));
}

/**
 * The tag the list is really filtered by, as its folded form.
 *
 * Derived rather than corrected after the fact: deleting the last document of a shelf makes
 * its chip disappear, and a selection still pointing at it would hide the whole library
 * behind a filter with nothing left to switch off.
 */
export function activeTagOf(tags: readonly string[], selected: string | null): string | null {
  if (selected === null) return null;
  return tags.some((tag) => fold(tag) === selected) ? selected : null;
}

/**
 * The entries a query and a tag leave visible.
 *
 * The search covers title, author and tags, because a reader who typed "Recht" onto three
 * documents expects to find them by typing it again.
 */
export function matchingEntries(
  entries: readonly LibraryEntry[],
  index: TagIndex,
  activeTag: string | null,
  query: string,
): LibraryEntry[] {
  const needle = fold(query.trim());
  return entries.filter((entry) => {
    const tags = index[entry.document.id] ?? [];
    if (activeTag !== null && !tags.some((tag) => fold(tag) === activeTag)) return false;
    if (needle.length === 0) return true;
    const { title, author } = entry.document;
    return (
      fold(title).includes(needle) ||
      (author !== null && fold(author).includes(needle)) ||
      tags.some((tag) => fold(tag).includes(needle))
    );
  });
}
