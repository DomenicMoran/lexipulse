import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pageTokenStarts, tokenForPage, tokenizeChapters, type LexiDocument } from '@lexipulse/core';

import { PdfSurfaceView } from '../src/pdf/surface-bridge';
import { store } from '../src/lib/store';
import { useReader } from '../src/state/reader';
import { useSettings, useTheme } from '../src/state/settings';

/**
 * The original page, full screen.
 *
 * Its own route rather than a sheet inside the player: a PDF page needs the whole
 * display, a toolbar and a panel, and the word stream needs none of that. What the two
 * share is a position — this screen is entered with a page number and leaves with one.
 */
export default function OriginalScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { document: openDocument, tokens, seek } = useReader();
  const params = useLocalSearchParams<{ doc?: string; page?: string }>();

  const documentId = params.doc ?? openDocument?.id ?? null;
  const initialPage = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);

  const [record, setRecord] = useState<LexiDocument | null>(null);

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    void (async () => {
      // The open document is already in memory; only a deep link needs a read.
      const found =
        openDocument?.id === documentId ? openDocument : await store.getDocument(documentId);
      if (!cancelled) setRecord(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, openDocument]);

  /**
   * Going back to the word stream at the page the reader is looking at.
   *
   * The anchors are word offsets recorded at import; turning one into a token index needs
   * the token stream, which the player already holds. When this screen was opened by a
   * deep link there is no stream, and the offer is not made in the first place.
   */
  const toStream = useCallback(
    (page: number) => {
      if (!record || tokens.length === 0) {
        router.back();
        return;
      }
      const wpm = settings.wpm;
      const stream =
        openDocument?.id === record.id
          ? tokens
          : tokenizeChapters(record.chapters, { wpm });
      seek(tokenForPage(pageTokenStarts(record, stream), page));
      router.back();
    },
    [record, tokens, openDocument, settings.wpm, seek, router],
  );

  const surfaceDocument = useMemo(
    () =>
      record
        ? {
            documentId: record.id,
            title: record.title,
            wordCount: record.wordCount,
            fileName: record.original?.fileName ?? null,
          }
        : null,
    [record],
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg, paddingTop: insets.top }]}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {surfaceDocument && (
        <PdfSurfaceView
          document={surfaceDocument}
          initialPage={initialPage}
          theme={theme}
          onStream={openDocument?.id === record?.id && tokens.length > 0 ? toStream : undefined}
          onClose={() => router.back()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
