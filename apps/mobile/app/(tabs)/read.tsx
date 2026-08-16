import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { contextAround, formatDuration, type RsvpToken } from '@lexipulse/core';
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
import { RsvpStage } from '../../src/player/stage';
import { Scrubber } from '../../src/player/scrubber';
import { useReader } from '../../src/state/reader';
import { useSettings, useTheme } from '../../src/state/settings';

const GEOMETRY = computeStageGeometry();
const WPM_STEP = 25;

export default function ReadScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { settings } = useSettings();
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

  const [sheet, setSheet] = useState<'none' | 'chapters' | 'bookmarks' | 'text'>('none');
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

  /**
   * Reading the page and running the stream are two different things, and doing both at
   * once means the highlight runs away while you are still looking for your line. So
   * opening the full text pauses first.
   */
  const openText = useCallback(() => {
    if (snapshot.status === 'playing') toggle();
    setSheet('text');
  }, [snapshot.status, toggle]);

  /** Tokens of the chapter on screen, grouped into the paragraphs they came from. */
  const paragraphs = useMemo(() => {
    if (sheet !== 'text') return [];
    const groups: { key: number; tokens: RsvpToken[] }[] = [];
    for (const token of tokens) {
      if (token.chapterIndex !== snapshot.chapterIndex) continue;
      const last = groups[groups.length - 1];
      if (last && last.key === token.paragraphIndex) last.tokens.push(token);
      else groups.push({ key: token.paragraphIndex, tokens: [token] });
    }
    return groups;
  }, [sheet, snapshot.chapterIndex, tokens]);

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
          icon="reader-outline"
          label={t('player.text')}
          onPress={openText}
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

      {/* The stage. Everything in this block is the gesture surface. */}
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

      {/* Transport */}
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

      <TextSheet
        visible={sheet === 'text'}
        onClose={() => setSheet('none')}
        paragraphs={paragraphs}
        activeIndex={snapshot.index}
        fontSize={settings.fontSize}
        onSelect={(index) => {
          seek(index);
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

/**
 * The document as a page, with the current word marked.
 *
 * RSVP shows one word at a time, which is the point, but it also means the reader has no
 * page to look back at. Losing the thread costs the whole passage: you cannot re-read the
 * sentence, only rewind and watch it stream past again. This is that page — the chapter as
 * flowing text, the current word highlighted, and every word a way back into the stream.
 *
 * Only the current chapter is rendered. A whole book of tappable words would cost far more
 * than it buys, and the chapter list is right next door.
 */
function TextSheet({
  visible,
  onClose,
  paragraphs,
  activeIndex,
  fontSize,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  paragraphs: { key: number; tokens: RsvpToken[] }[];
  activeIndex: number;
  fontSize: number;
  onSelect: (index: number) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView | null>(null);
  const activeY = useRef<number | null>(null);

  // The offset is known only after the active paragraph has been laid out, and that
  // happens after this render. Scrolling from the layout callback would fight the sheet's
  // slide-in, so it waits for the animation to be over.
  const scrollToActive = useCallback(() => {
    const y = activeY.current;
    if (y === null) return;
    scroller.current?.scrollTo({ y: Math.max(0, y - 120), animated: false });
  }, []);

  const body = fontSize * 0.34;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ height: insets.top + theme.space[4], backgroundColor: theme.colors.overlay }}
        onPress={onClose}
      />
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          borderTopWidth: theme.hairline,
          borderColor: theme.colors.border,
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
          <View style={{ flex: 1 }}>
            <T variant="title">{t('player.text')}</T>
            <T variant="small" tone="faint">
              {t('player.text.hint')}
            </T>
          </View>
          <IconButton icon="close" label={t('common.close')} onPress={onClose} />
        </View>
        <Divider />
        <ScrollView
          ref={scroller}
          onLayout={scrollToActive}
          contentContainerStyle={{
            padding: theme.space[5],
            paddingBottom: insets.bottom + theme.space[6],
          }}
        >
          {paragraphs.map((paragraph) => {
            const holdsActive = paragraph.tokens.some((token) => token.index === activeIndex);
            return (
              <Text
                key={paragraph.key}
                onLayout={
                  holdsActive
                    ? (event) => {
                        activeY.current = event.nativeEvent.layout.y;
                        scrollToActive();
                      }
                    : undefined
                }
                style={{
                  fontSize: body,
                  lineHeight: body * 1.6,
                  marginBottom: theme.space[4],
                  color: theme.colors.text,
                }}
              >
                {paragraph.tokens.map((token, position) => {
                  const active = token.index === activeIndex;
                  return (
                    <Text
                      key={token.index}
                      accessibilityRole="button"
                      accessibilityLabel={active ? t('player.text.here') : token.text}
                      onPress={() => onSelect(token.index)}
                      style={{
                        color: active ? theme.accent.on : theme.colors.text,
                        backgroundColor: active ? theme.accent.base : 'transparent',
                      }}
                    >
                      {position === 0 ? token.text : ` ${token.text}`}
                    </Text>
                  );
                })}
              </Text>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
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
