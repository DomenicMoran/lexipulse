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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import {
  bionicPrefix,
  paragraphsOf,
  type Annotation,
  type HighlightColor,
  type ReaderParagraph,
  type RsvpToken,
} from '@lexipulse/core';

import { useSettings, useTheme } from '../state/settings';
import { HIGHLIGHT_TINTS } from './highlight-bar';
import { OVERLAY_TINTS, readerFontFamily, readerFontFamilyBold } from './typography';

export interface PageViewProps {
  /** Readonly: the reader state owns this array and page mode only reads it. */
  tokens: readonly RsvpToken[];
  /** Shared with the RSVP engine. */
  activeIndex: number;
  annotations: readonly Annotation[];
  onSelectToken: (index: number) => void;
  /** Reports the first visible word so the shared position follows the scroll. */
  onPositionChange?: (tokenIndex: number) => void;
  /** Long press starts a selection; tapping again extends it. */
  selection: { start: number; end: number } | null;
  onSelectionChange: (selection: { start: number; end: number } | null) => void;
  onOpenAnnotation: (annotation: Annotation) => void;
}

export function PageView({
  tokens,
  activeIndex,
  annotations,
  onSelectToken,
  onPositionChange,
  selection,
  onSelectionChange,
  onOpenAnnotation,
}: PageViewProps) {
  const theme = useTheme();
  const { settings } = useSettings();
  const scroller = useRef<ScrollView | null>(null);
  const offsets = useRef(new Map<number, number>());
  const didInitialScroll = useRef(false);
  const [ruler, setRuler] = useState<{ y: number; height: number } | null>(null);

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
   * write to the database sixty times a second, so this only fires when the paragraph
   * actually changes.
   */
  const lastReported = useRef(activeIndex);
  const scrollY = useRef(0);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      scrollY.current = y;
      if (!onPositionChange) return;
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

  /**
   * Auto-scroll, in points per second.
   *
   * Driven by an interval rather than an animation frame: a reader scrolls at twenty to
   * sixty points a second, and asking for sixty repaints a second to move two points is
   * battery spent on nothing a reader can see.
   */
  useEffect(() => {
    const speed = settings.readerAutoScroll;
    if (speed <= 0) return;
    const step = 120;
    const timer = setInterval(() => {
      scrollY.current += (speed * step) / 1000;
      scroller.current?.scrollTo({ y: scrollY.current, animated: false });
    }, step);
    return () => clearInterval(timer);
  }, [settings.readerAutoScroll]);

  const tint = OVERLAY_TINTS[settings.readerOverlay];

  const onWordPress = useCallback(
    (token: RsvpToken) => {
      // Extending a live selection wins over everything: it is the only thing the reader
      // can be doing at that moment.
      if (selection) {
        onSelectionChange({ start: selection.start, end: token.index });
        return;
      }
      const hit = annotations.find(
        (a) => token.index >= a.startToken && token.index <= a.endToken,
      );
      if (hit) {
        onOpenAnnotation(hit);
        return;
      }
      onSelectToken(token.index);
    },
    [annotations, onOpenAnnotation, onSelectToken, onSelectionChange, selection],
  );

  const onWordLongPress = useCallback(
    (token: RsvpToken) => onSelectionChange({ start: token.index, end: token.index }),
    [onSelectionChange],
  );

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
        {/* The ruler lives inside the scrolled content, not over the viewport: pinned to
            the viewport it would need the live scroll offset, which is a ref read during
            render — and a band that only moves when React re-renders lags the page.
            Drawn before the paragraphs so the text paints on top of it. */}
        {settings.readerRuler > 0 && ruler !== null ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              // Grown symmetrically around the line, so stronger settings give a wider
              // band without shifting it off the words it is meant to mark.
              top: ruler.y - (settings.readerRuler - 1) * 2,
              height: ruler.height + (settings.readerRuler - 1) * 4,
              backgroundColor: theme.accent.soft,
            }}
          />
        ) : null}

        {paragraphs.map((paragraph) => (
          <Paragraph
            key={paragraph.key}
            paragraph={paragraph}
            activeIndex={
              activeIndex >= paragraph.firstToken && activeIndex <= paragraph.lastToken
                ? activeIndex
                : -1
            }
            annotations={annotations}
            selection={selection}
            onPress={onWordPress}
            onLongPress={onWordLongPress}
            onMeasure={(token, y) => offsets.current.set(token, y)}
            onRuler={setRuler}
          />
        ))}
      </ScrollView>

      {tint ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: tint,
          }}
        />
      ) : null}
    </View>
  );
}

interface ParagraphProps {
  paragraph: ReaderParagraph;
  activeIndex: number;
  annotations: readonly Annotation[];
  selection: { start: number; end: number } | null;
  onPress: (token: RsvpToken) => void;
  onLongPress: (token: RsvpToken) => void;
  onMeasure: (firstToken: number, y: number) => void;
  /** Reports where the reading position's line sits, in content coordinates. */
  onRuler: (band: { y: number; height: number }) => void;
}

const Paragraph = memo(function Paragraph({
  paragraph,
  activeIndex,
  annotations,
  selection,
  onPress,
  onLongPress,
  onMeasure,
  onRuler,
}: ParagraphProps) {
  const theme = useTheme();
  const { settings } = useSettings();

  /**
   * Which rendered line the reading position falls on.
   *
   * `onTextLayout` hands back one entry per line after wrapping, so the line the reader is
   * on is only knowable here — the parent sees paragraphs, not lines. Lines are matched by
   * counting words rather than characters: Android drops the trailing space at a wrap, so
   * character offsets drift by a space per line while word counts stay exact.
   *
   * Layout and text layout arrive in no fixed order, so both are kept and the band is
   * computed from whichever pair is complete.
   */
  const selfY = useRef<number | null>(null);
  const lines = useRef<{ y: number; height: number; words: number }[] | null>(null);

  const ordinal = paragraph.tokens.findIndex((token) => token.index === activeIndex);

  const publish = useCallback(() => {
    const top = selfY.current;
    const rendered = lines.current;
    if (top === null || rendered === null || ordinal < 0) return;
    let seen = 0;
    for (const line of rendered) {
      if (ordinal < seen + line.words) {
        onRuler({ y: top + line.y, height: line.height });
        return;
      }
      seen += line.words;
    }
    // The position sits past the last counted word — mark the closing line rather than
    // leaving the band wherever it was.
    const last = rendered[rendered.length - 1];
    if (last) onRuler({ y: top + last.y, height: last.height });
  }, [onRuler, ordinal]);

  useEffect(publish, [publish]);

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
      onLayout={(event) => {
        selfY.current = event.nativeEvent.layout.y;
        onMeasure(paragraph.firstToken, event.nativeEvent.layout.y);
        publish();
      }}
      onTextLayout={(event) => {
        lines.current = event.nativeEvent.lines.map((line) => {
          const text = line.text.trim();
          return {
            y: line.y,
            height: line.height,
            words: text === '' ? 0 : text.split(/\s+/).length,
          };
        });
        publish();
      }}
    >
      {paragraph.tokens.map((token, position) => (
        <Word
          key={token.index}
          token={token}
          leading={position === 0 ? '' : ' '}
          active={token.index === activeIndex}
          highlight={colorAt(annotations, token.index)}
          selected={
            selection !== null &&
            token.index >= Math.min(selection.start, selection.end) &&
            token.index <= Math.max(selection.start, selection.end)
          }
          bionic={settings.readerBionic}
          boldFamily={readerFontFamilyBold(settings.readerFont)}
          onPress={onPress}
          onLongPress={onLongPress}
        />
      ))}
    </Text>
  );
});

/** Innermost highlight wins, so a note inside a longer passage stays visible. */
function colorAt(annotations: readonly Annotation[], tokenIndex: number): HighlightColor | null {
  let found: Annotation | null = null;
  for (const a of annotations) {
    if (tokenIndex < a.startToken || tokenIndex > a.endToken) continue;
    if (found === null || a.endToken - a.startToken < found.endToken - found.startToken) {
      found = a;
    }
  }
  return found?.color ?? null;
}

const Word = memo(function Word({
  token,
  leading,
  active,
  highlight,
  selected,
  bionic,
  boldFamily,
  onPress,
  onLongPress,
}: {
  token: RsvpToken;
  leading: string;
  active: boolean;
  highlight: HighlightColor | null;
  selected: boolean;
  bionic: number;
  /** Undefined for the system face, which does have real weights. */
  boldFamily: string | undefined;
  onPress: (token: RsvpToken) => void;
  onLongPress: (token: RsvpToken) => void;
}) {
  const theme = useTheme();
  const cut = bionic > 0 ? bionicPrefix(token.text, bionic) : 0;

  const body =
    cut > 0 ? (
      <>
        {/* Naming the bold family rather than setting fontWeight: an embedded family
            holds one weight, and Android ignores fontWeight beside a custom family
            outright — the emphasis would simply not appear. */}
        <Text style={boldFamily ? { fontFamily: boldFamily } : { fontWeight: '700' }}>
          {token.text.slice(0, cut)}
        </Text>
        {token.text.slice(cut)}
      </>
    ) : (
      token.text
    );

  // Order matters: the live selection has to be visible on top of an existing highlight,
  // and the stream position on top of both.
  const style = active
    ? { backgroundColor: theme.accent.base, color: theme.accent.on }
    : selected
      ? { backgroundColor: theme.accent.soft }
      : highlight
        ? { backgroundColor: HIGHLIGHT_TINTS[highlight], color: '#101014' }
        : undefined;

  return (
    <Text onPress={() => onPress(token)} onLongPress={() => onLongPress(token)} style={style}>
      {leading}
      {body}
    </Text>
  );
});
