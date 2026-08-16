import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDuration, type LibraryEntry } from '@lexipulse/core';

import { SwipeToDelete } from '../../src/components/swipe';
import { Button, EmptyState, ProgressBar, Screen, ScreenTitle, T } from '../../src/components/ui';
import { useAlert } from '../../src/components/alert';
import { formatNumber, t, type MessageKey } from '../../src/i18n';
import { useLibrary } from '../../src/state/library';
import { useReader } from '../../src/state/reader';
import { useSettings, useTheme } from '../../src/state/settings';

export default function LibraryScreen() {
  const alert = useAlert();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { entries, loading, refresh, remove } = useLibrary();
  const { open, discard, document: openDocument } = useReader();

  /**
   * Reading progress is written while the player runs, and the list holds the copy it
   * loaded when the app started. Without this, finishing a document and walking back to
   * the library showed it as "Not started" until the next cold start — the list quietly
   * contradicting the player.
   */
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onOpen = useCallback(
    async (documentId: string) => {
      await open(documentId);
      router.navigate('/read');
    },
    [open, router],
  );

  const onDelete = useCallback(
    (entry: LibraryEntry) => {
      alert(
        t('library.deleteConfirm.title', { title: entry.document.title }),
        t('library.deleteConfirm.body'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: () => {
              // The player would otherwise keep streaming a document that no longer
              // exists, and its next progress save would resurrect the row.
              if (openDocument?.id === entry.document.id) discard();
              void remove(entry.document.id);
            },
          },
        ],
      );
    },
    [alert, discard, openDocument, remove],
  );

  if (!loading && entries.length === 0) {
    return (
      <Screen contentStyle={{ paddingTop: insets.top + theme.space[4] }}>
        <ScreenTitle>{t('library.title')}</ScreenTitle>
        <EmptyState
          icon="book-outline"
          title={t('library.empty.title')}
          body={t('library.empty.body')}
          action={
            <Button
              label={t('library.import')}
              icon="add"
              onPress={() => router.navigate('/import')}
            />
          }
        />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <FlatList
        data={entries}
        keyExtractor={(entry) => entry.document.id}
        contentContainerStyle={{
          padding: theme.space[5],
          paddingTop: insets.top + theme.space[4],
          paddingBottom: theme.space[16],
          gap: theme.space[3],
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.space[2] }}>
            <ScreenTitle>{t('library.title')}</ScreenTitle>
            <Button
              label={t('library.import')}
              icon="add"
              variant="secondary"
              onPress={() => router.navigate('/import')}
            />
            <T variant="small" tone="faint" style={{ marginTop: theme.space[3] }}>
              {t('library.swipeHint')}
            </T>
          </View>
        }
        renderItem={({ item }) => (
          <SwipeToDelete onDelete={() => onDelete(item)} label={t('library.delete')}>
            <LibraryCard entry={item} onPress={() => void onOpen(item.document.id)} />
          </SwipeToDelete>
        )}
      />
    </View>
  );
}

function LibraryCard({ entry, onPress }: { entry: LibraryEntry; onPress: () => void }) {
  const theme = useTheme();
  const { settings } = useSettings();
  const { document, progress } = entry;

  const percent = progress?.percent ?? 0;
  // Remaining time is estimated from the words actually left, at the user's current
  // speed — a fixed 200 WPM figure would be wrong for everyone who changed the setting.
  const remainingWords = Math.max(0, document.totalTokens - (progress?.tokenIndex ?? 0));
  const remainingMs = (remainingWords / Math.max(settings.wpm, 1)) * 60_000;

  const sourceKey = `library.sourceLabel.${document.source}` as MessageKey;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: theme.colors.surfaceHover }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: theme.space[4],
        padding: theme.space[4],
        borderRadius: theme.radius.lg,
        borderWidth: theme.hairline,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.surfaceHover : theme.colors.surface,
      })}
    >
      <Cover uri={document.coverDataUrl} title={document.title} />

      <View style={{ flex: 1, gap: theme.space[2] }}>
        <T variant="title" numberOfLines={2}>
          {document.title}
        </T>
        {document.author ? (
          <T variant="small" tone="muted" numberOfLines={1}>
            {document.author}
          </T>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          <View
            style={{
              paddingHorizontal: theme.space[2],
              paddingVertical: 2,
              borderRadius: theme.radius.sm,
              backgroundColor: theme.accent.soft,
            }}
          >
            <T variant="small" tone="accent">
              {t(sourceKey)}
            </T>
          </View>
          <T variant="small" tone="faint">
            {t('library.words', { count: formatNumber(document.wordCount) })}
          </T>
        </View>

        <View style={{ gap: theme.space[1], marginTop: theme.space[1] }}>
          <ProgressBar percent={percent} />
          <T variant="small" tone="faint">
            {percent >= 0.999
              ? t('library.finished')
              : percent <= 0
                ? t('library.notStarted')
                : t('library.remaining', { time: formatDuration(remainingMs) })}
          </T>
        </View>
      </View>
    </Pressable>
  );
}

function Cover({ uri, title }: { uri: string | null; title: string }) {
  const theme = useTheme();
  const size = { width: 56, height: 78 };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ ...size, borderRadius: theme.radius.sm, backgroundColor: theme.colors.bg }}
        resizeMode="cover"
      />
    );
  }

  // No cover: the first letter on a tinted plate reads better in a list than a generic
  // placeholder icon repeated down the page.
  return (
    <View
      style={{
        ...size,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.bg,
        borderWidth: theme.hairline,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <T variant="mono" tone="accent" style={{ fontSize: 26 }}>
        {title.trim().charAt(0).toUpperCase() || '·'}
      </T>
    </View>
  );
}
