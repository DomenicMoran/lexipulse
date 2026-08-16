/**
 * Page mode: the document as continuous text.
 *
 * RSVP is what LexiPulse is for, but a reader you cannot simply read in is half a
 * product. This is the other half — the whole document, your own typography, and the
 * same position the stream uses, so switching between the two never costs you your place.
 *
 * Rendering is per paragraph and memoised. A book is tens of thousands of words; drawing
 * them all on every scroll frame is the difference between a reader and a slideshow.
 */
import { memo, useCallback, useMemo, useRef } from 'react';
import { ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { bionicPrefix, paragraphsOf, type ReaderParagraph, type RsvpToken } from '@lexipulse/core';

import { useSettings, useTheme } from '../state/settings';
import { OVERLAY_TINTS, readerFontFamily } from './typography';

export interface PageViewProps {
  /** Readonly: the reader state owns this array and page mode only reads it. */
  tokens: readonly RsvpToken[];
  /** Shared with the RSVP engine. */
  activeIndex: number;
  onSelectToken: (index: number) => void;
  /** Reports the first visible word so the shared position follows the scroll. */
  onPositionChange?: (tokenIndex: number) => void;
}

export function PageView({ tokens, activeIndex, onSelectToken, onPositionChange }: PageViewProps) {
  const theme = useTheme();
  const { settings } = useSettings();
  const scroller = useRef<ScrollView | null>(null);
  const offsets = useRef(new Map<number, number>());
  const didInitialScroll = useRef(false);

  const paragraphs = useMemo(() => paragraphsOf(tokens), [tokens]);

  const scrollToActive = useCallback(() => {
    if (didInitialScroll.current) return;
    const y = offsets.current.get(activeIndex);
    if (y === undefined) return;
    didInitialScroll.current = true;
    scroller.current?.scrollTo({ y: Math.max(0, y - 80), animated: false });
  }, [activeIndex]);

  /**
   * The topmost visible paragraph becomes the position. Reporting on every frame would
   * write to the database sixty times a second, so the caller throttles; here we only
   * report when the paragraph actually changes.
   */
  const lastReported = useRef(activeIndex);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!onPositionChange) return;
      const y = event.nativeEvent.contentOffset.y;
      let best: { token: number; distance: number } | null = null;
      for (const [token, top] of offsets.current) {
        const distance = Math.abs(top - y);
        if (best === null || distance < best.distance) best = { token, distance };
      }
      if (best && best.token !== lastReported.current) {
        lastReported.current = best.token;
        onPositionChange(best.token);
      }
    },
    [onPositionChange],
  );

  const tint = OVERLAY_TINTS[settings.readerOverlay];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ScrollView
        ref={scroller}
        onLayout={scrollToActive}
        onScroll={onScroll}
        scrollEventThrottle={120}
        contentContainerStyle={{
          paddingHorizontal: settings.readerMargin,
          paddingTop: theme.space[4],
          paddingBottom: theme.space[16],
        }}
      >
        {paragraphs.map((paragraph) => (
          <Paragraph
            key={paragraph.key}
            paragraph={paragraph}
            activeIndex={
              activeIndex >= paragraph.firstToken && activeIndex <= paragraph.lastToken
                ? activeIndex
                : -1
            }
            onSelectToken={onSelectToken}
            onMeasure={(token, y) => offsets.current.set(token, y)}
          />
        ))}
      </ScrollView>
      {tint ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: tint }}
        />
      ) : null}
    </View>
  );
}

interface ParagraphProps {
  paragraph: ReaderParagraph;
  activeIndex: number;
  onSelectToken: (index: number) => void;
  onMeasure: (firstToken: number, y: number) => void;
}

const Paragraph = memo(function Paragraph({
  paragraph,
  activeIndex,
  onSelectToken,
  onMeasure,
}: ParagraphProps) {
  const theme = useTheme();
  const { settings } = useSettings();

  const size = settings.readerFontSize;
  const style = {
    fontFamily: readerFontFamily(settings.readerFont),
    fontSize: size,
    lineHeight: size * settings.readerLineHeight,
    color: theme.colors.text,
    textAlign: settings.readerJustify ? ('justify' as const) : ('left' as const),
    marginBottom: size * 0.9,
  };

  return (
    <Text
      style={style}
      onLayout={(event) => onMeasure(paragraph.firstToken, event.nativeEvent.layout.y)}
    >
      {paragraph.tokens.map((token, position) => (
        <Word
          key={token.index}
          token={token}
          leading={position === 0 ? '' : ' '}
          active={token.index === activeIndex}
          bionic={settings.readerBionic}
          onPress={onSelectToken}
        />
      ))}
    </Text>
  );
});

const Word = memo(function Word({
  token,
  leading,
  active,
  bionic,
  onPress,
}: {
  token: RsvpToken;
  leading: string;
  active: boolean;
  bionic: number;
  onPress: (index: number) => void;
}) {
  const theme = useTheme();
  const cut = bionic > 0 ? bionicPrefix(token.text, bionic) : 0;

  const body =
    cut > 0 ? (
      <>
        <Text style={{ fontWeight: '700' }}>{token.text.slice(0, cut)}</Text>
        {token.text.slice(cut)}
      </>
    ) : (
      token.text
    );

  return (
    <Text
      onPress={() => onPress(token.index)}
      style={
        active
          ? { backgroundColor: theme.accent.base, color: theme.accent.on }
          : undefined
      }
    >
      {leading}
      {body}
    </Text>
  );
});
