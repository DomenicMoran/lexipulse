/**
 * Which incoming links are navigation and which are not.
 *
 * Expo Router hands every link the system delivers to the navigator. A backup file opened
 * in a file manager arrives as a `content://` URI, which matches no route, so the router
 * lands on "Unmatched Route" — behind the import preview, and still there after it closes.
 *
 * Returning `null` tells the router this link is not a destination. The link itself is not
 * lost: `BackupImportProvider` listens on `expo-linking` directly and opens the preview.
 * This file only decides what is a route, it never reads a file.
 */
import { isFileLink } from '../src/components/backup';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  return isFileLink(path) ? null : path;
}
