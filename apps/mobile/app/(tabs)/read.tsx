import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { contextAround, formatDuration, type Annotation } from '@lexipulse/core';
import { computeStageGeometry, fitFontSize } from '@lexipulse/ui/geometry';

import {
  Button,
  Divider,
  EmptyState,
  IconButton,
  Row,
  T,
} from '../../src/components/ui';
import { t } from '../../src/i18n';
import {
  useKeepAwakeWhilePlaying,
  useSentenceClick,
  useSpeech,
} from '../../src/player/feedback';
import { PlayerGestureArea, type PlayerGestureHandlers } from '../../src/player/gestures';
import { OnboardingOverlay, useOnboarding } from '../../src/player/onboarding';
import { HighlightBar } from '../../src/reader/highlight-bar';
import { PageView } from '../../src/reader/page-view';
import { SearchSheet } from '../../src/reader/search-sheet';
import { RsvpStage } from '../../src/player/stage';
import { Scrubber } from '../../src/player/scrubber';
import { useAnnotations } from '../../src/state/annotations';
import { useReader } from '../../src/state/reader';
import { useSettings, useTheme } from '../../src/state/settings';

const GEOMETRY = computeStageGeometry();
const WPM_STEP = 25;

export default function ReadScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { settings, update } = useSettings();
  const {
    document,
    tokens,
    snapshot,
    bookmarks,
    loading,
    toggle,
    seek,
    seekPercent,
    rewind,
    forward,
    seekSentence,
    seekChapter,
    nudgeWpm,
    addBookmark,
    removeBookmark,
  } = useReader();

  const [sheet, setSheet] = useState<'none' | 'chapters' | 'bookmarks' | 'search'>('none');
  const { annotations, add: addAnnotation, update: updateAnnotation, remove: removeAnnotation } =
    useAnnotations();
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [openAnnotation, setOpenAnnotation] = useState<Annotation | null>(null);
  const onboarding = useOnboarding();

  useSentenceClick(settings.soundEnabled && document !== null);
  useSpeech(settings);
  useKeepAwakeWhilePlaying(settings.keepAwake, snapshot.status === 'playing');

  /**
   * The player font size is the smaller of what the user asked for and what actually fits
   * the stage on this screen. Letting the requested size win would push the longest words
   * off the edge, and the stage is sized for the worst case precisely so it never reflows.
   */
  const fontSize = useMemo(() => {
    const available = width - theme.space[5] * 2;
    return Math.min(settings.fontSize, fitFontSize(available, GEOMETRY, { min: 18, max: 120 }));
  }, [settings.fontSize, theme.space, width]);

  const context = useMemo(() => {
    if (settings.contextWords <= 0 || tokens.length === 0) {
      return { before: [] as string[], after: [] as string[] };
    }
    const around = contextAround(tokens, snapshot.index, settings.contextWords);
    return { before: around.before, after: around.after };
  }, [settings.contextWords, snapshot.index, tokens]);

  const handlers = useMemo<PlayerGestureHandlers>(
    () => ({
      onTap: toggle,
      onSwipeLeft: rewind,
      onSwipeRight: forward,
      onSwipeUp: () => nudgeWpm(WPM_STEP),
      onSwipeDown: () => nudgeWpm(-WPM_STEP),
      onLongPress: () => void addBookmark(),
      onTwoFingerTap: () => seekSentence(-1),
    }),
    [addBookmark, forward, nudgeWpm, rewind, seekSentence, toggle],
  );

  const onScrub = useCallback((percent: number) => seekPercent(percent), [seekPercent]);

  const pageMode = settings.readerMode === 'page';

  /**
   * Switch between the stream and the page. Both sit on the same token, so the reader
   * lands on the word they were at either way — that is the whole point of having one
   * position rather than two.
   *
   * Leaving the stream running behind the page would move that position out from under
   * them, so it stops first.
   */
  const toggleMode = useCallback(() => {
    if (snapshot.status === 'playing') toggle();
    void update({ readerMode: pageMode ? 'rsvp' : 'page' });
  }, [pageMode, snapshot.status, toggle, update]);

  if (!document) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.bg,
          paddingTop: insets.top,
          paddingHorizontal: theme.space[5],
          justifyContent: 'center',
        }}
      >
        <EmptyState
          icon="eye-outline"
          title={loading ? t('player.loading') : t('player.empty.title')}
          body={t('player.empty.body')}
          action={
            loading ? null : (
              <Button
                label={t('player.toLibrary')}
                icon="library-outline"
                onPress={() => router.navigate('/')}
              />
            )
          }
        />
      </View>
    );
  }

  const chapter = document.chapters[snapshot.chapterIndex];
  const playing = snapshot.status === 'playing';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, paddingTop: insets.top }}>
      {/* Header: title and the two sheets. Muted on purpose — nothing up here may pull
          attention away from the word. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.space[3],
          gap: theme.space[2],
        }}
      >
        <View style={{ flex: 1, paddingHorizontal: theme.space[2] }}>
          <T variant="small" tone="muted" numberOfLines={1}>
            {document.title}
          </T>
          {chapter ? (
            <T variant="small" tone="faint" numberOfLines={1}>
              {t('player.chapter', {
                index: snapshot.chapterIndex + 1,
                total: document.chapters.length,
              })}
              {chapter.title ? ` · ${chapter.title}` : ''}
            </T>
          ) : null}
        </View>
        <IconButton
          icon={pageMode ? 'flash-outline' : 'reader-outline'}
          label={pageMode ? t('player.toRsvp') : t('player.toPage')}
          onPress={toggleMode}
        />
        <IconButton
          icon="search-outline"
          label={t('search.title')}
          onPress={() => setSheet('search')}
        />
        <IconButton
          icon="list-outline"
          label={t('player.chapters')}
          onPress={() => setSheet('chapters')}
        />
        <IconButton
          icon="bookmark-outline"
          label={t('player.bookmarks')}
          onPress={() => setSheet('bookmarks')}
        />
      </View>

      {pageMode ? (
        <>
          <PageView
            tokens={tokens}
            activeIndex={snapshot.index}
            annotations={annotations}
            onSelectToken={(index) => {
              seek(index);
              void update({ readerMode: 'rsvp' });
            }}
            onPositionChange={seek}
            selection={selection}
            onSelectionChange={setSelection}
            onOpenAnnotation={setOpenAnnotation}
          />
          {selection || openAnnotation ? (
            <HighlightBar
              key={openAnnotation?.id ?? 'new'}
              selection={selection}
              existing={openAnnotation}
              onColor={(color) => {
                if (openAnnotation) {
                  void updateAnnotation({ ...openAnnotation, color });
                  setOpenAnnotation({ ...openAnnotation, color });
                  return;
                }
                if (!selection) return;
                void addAnnotation({
                  documentId: document.id,
                  startToken: selection.start,
                  endToken: selection.end,
                  chapterIndex: snapshot.chapterIndex,
                  color,
                  tokens,
                });
                setSelection(null);
              }}
              onNote={(note) => {
                if (!openAnnotation) return;
                void updateAnnotation({ ...openAnnotation, note: note.length > 0 ? note : null });
                setOpenAnnotation({ ...openAnnotation, note: note.length > 0 ? note : null });
              }}
              onRemove={() => {
                if (!openAnnotation) return;
                void removeAnnotation(openAnnotation.documentId, openAnnotation.id);
                setOpenAnnotation(null);
              }}
              onCancel={() => {
                setSelection(null);
                setOpenAnnotation(null);
              }}
            />
          ) : null}
        </>
      ) : null}

      {/* The stage. Everything in this block is the gesture surface. */}
      {pageMode ? null : (
      <PlayerGestureArea
        handlers={handlers}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.stage,
        }}
      >
        <RsvpStage
          token={snapshot.token}
          fontSize={fontSize}
          showGuides={settings.showFocusGuides}
          contextBefore={context.before}
          contextAfter={context.after}
        />

        {!playing ? (
          <View style={{ position: 'absolute', bottom: theme.space[6], alignItems: 'center' }}>
            <T variant="small" tone="faint">
              {snapshot.status === 'finished' ? t('player.finished') : t('player.play')}
            </T>
          </View>
        ) : null}
      </PlayerGestureArea>
      )}

      {/* Transport. Page mode has no stream to drive, so it has no transport either. */}
      {pageMode ? null : (
      <View
        style={{
          paddingHorizontal: theme.space[5],
          paddingBottom: theme.space[4],
          gap: theme.space[3],
        }}
      >
        {settings.showProgress ? (
          <Scrubber percent={snapshot.percent} onScrub={onScrub} />
        ) : null}

        {settings.showStats ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="small" tone="faint">
              {t('player.wpm', { wpm: settings.wpm })}
            </T>
            <T variant="small" tone="faint">
              {t('player.remaining', { time: formatDuration(snapshot.remainingMs) })}
            </T>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.space[2],
          }}
        >
          <IconButton icon="play-back-outline" label={t('onboarding.twoFinger')} onPress={() => seekSentence(-1)} />
          <IconButton icon="chevron-back" label={t('onboarding.swipeH')} onPress={rewind} />
          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityLabel={playing ? t('player.pause') : t('player.play')}
            style={({ pressed }) => ({
              width: 60,
              height: 60,
              borderRadius: 30,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.accent.base,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <PlayGlyph playing={playing} color={theme.accent.on} />
          </Pressable>
          <IconButton icon="chevron-forward" label={t('onboarding.swipeH')} onPress={forward} />
          <IconButton
            icon="bookmark-outline"
            label={t('player.bookmarkSet')}
            onPress={() => void addBookmark()}
          />
        </View>

        {snapshot.status === 'finished' ? (
          <Button label={t('player.restart')} variant="secondary" onPress={() => seek(0)} />
        ) : null}
      </View>
      )}

      <SearchSheet
        visible={sheet === 'search'}
        tokens={tokens}
        onClose={() => setSheet('none')}
        onSelect={(index) => {
          seek(index);
          setSheet('none');
        }}
      />

      <ChapterSheet
        visible={sheet === 'chapters'}
        onClose={() => setSheet('none')}
        chapters={document.chapters.map((c, index) => ({
          title: c.title || `${index + 1}`,
          index,
        }))}
        activeIndex={snapshot.chapterIndex}
        onSelect={(index) => {
          seekChapter(index);
          setSheet('none');
        }}
      />

      <BookmarkSheet
        visible={sheet === 'bookmarks'}
        onClose={() => setSheet('none')}
        bookmarks={bookmarks}
        onSelect={(index) => {
          seek(index);
          setSheet('none');
        }}
        onRemove={(id) => void removeBookmark(id)}
      />

      <OnboardingOverlay visible={onboarding.visible} onDismiss={onboarding.dismiss} />
    </View>
  );
}

function PlayGlyph({ playing, color }: { playing: boolean; color: string }) {
  if (playing) {
    return (
      <View style={{ flexDirection: 'row', gap: 5 }}>
        <View style={{ width: 5, height: 20, borderRadius: 1, backgroundColor: color }} />
        <View style={{ width: 5, height: 20, borderRadius: 1, backgroundColor: color }} />
      </View>
    );
  }
  // A CSS-style triangle: three borders, no image asset and no icon font to load.
  return (
    <View
      style={{
        marginLeft: 4,
        width: 0,
        height: 0,
        borderTopWidth: 11,
        borderBottomWidth: 11,
        borderLeftWidth: 18,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: color,
        borderStyle: 'solid',
      }}
    />
  );
}

function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose} />
      <View
        style={{
          maxHeight: '65%',
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          borderTopWidth: theme.hairline,
          borderColor: theme.colors.border,
          paddingBottom: insets.bottom + theme.space[4],
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: theme.space[4],
          }}
        >
          <T variant="title">{title}</T>
          <IconButton icon="close" label={t('common.close')} onPress={onClose} />
        </View>
        <Divider />
        <ScrollView>{children}</ScrollView>
      </View>
    </Modal>
  );
}

function ChapterSheet({
  visible,
  onClose,
  chapters,
  activeIndex,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  chapters: { title: string; index: number }[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={t('player.chapters')}>
      {chapters.map((chapter) => (
        <Row
          key={chapter.index}
          label={chapter.title}
          icon={chapter.index === activeIndex ? 'radio-button-on' : 'radio-button-off'}
          onPress={() => onSelect(chapter.index)}
        />
      ))}
    </Sheet>
  );
}

function BookmarkSheet({
  visible,
  onClose,
  bookmarks,
  onSelect,
  onRemove,
}: {
  visible: boolean;
  onClose: () => void;
  bookmarks: { id: string; tokenIndex: number; preview: string }[];
  onSelect: (index: number) => void;
  onRemove: (id: string) => void;
}) {
  const theme = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('player.bookmarks')}>
      {bookmarks.length === 0 ? (
        <View style={{ padding: theme.space[5] }}>
          <T tone="muted">{t('player.bookmarks.empty')}</T>
        </View>
      ) : (
        bookmarks.map((bookmark) => (
          <Row
            key={bookmark.id}
            label={bookmark.preview}
            icon="bookmark"
            onPress={() => onSelect(bookmark.tokenIndex)}
            right={
              <IconButton
                icon="trash-outline"
                label={t('common.delete')}
                size={18}
                onPress={() => onRemove(bookmark.id)}
              />
            }
          />
        ))
      )}
    </Sheet>
  );
}
