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
  Pressable,
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

import { T } from '../components/ui';
import { t } from '../i18n';
import { useSettings, useTheme } from '../state/settings';
import { HIGHLIGHT_TINTS } from './highlight-bar';
import { OVERLAY_TINTS, readerFontFamily, readerFontFamilyBold } from './typography';

/** Width of the page-turn strips beside the text, in points. */
const PAGE_EDGE = 36;
/** Height of the strip the page counter sits in, below the text rather than over it. */
const PAGE_FOOTER = 26;
/** A scroll offset within this much of a break still counts as being on that page. */
const PAGE_SNAP = 4;

/** Before anything is measured there is exactly one page, and it starts at the top. */
const FIRST_PAGE: readonly number[] = [0];

/** One rendered line, in content coordinates. */
interface LineBox {
  y: number;
  height: number;
}

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
  /** True once this view's own scrolling has decided the reading position at least once. */
  const reported = useRef(false);
  const [ruler, setRuler] = useState<{ y: number; height: number; token: number } | null>(null);
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const [breaks, setBreaks] = useState<readonly number[]>(FIRST_PAGE);
  const [page, setPage] = useState(0);

  const paged = settings.readerPaged;
  const paragraphs = useMemo(() => paragraphsOf(tokens), [tokens]);

  /**
   * What a page may fill: exactly the window the text is drawn in, since the counter has
   * its own strip below it. Not one point less — lines sit flush against each other, so
   * any slack left here is where the first line of the next page peeks through.
   */
  const usable = viewport > 0 ? Math.max(120, viewport) : 0;

  /**
   * Pagination is built from the lines the text engine actually produced, because nothing
   * else knows where they broke. Paragraphs report theirs as they lay out; the map is a ref
   * because a hundred paragraphs reporting into state would be a hundred renders.
   */
  const lineBoxes = useRef(new Map<number, LineBox[]>());
  const measured = useRef<readonly ReaderParagraph[] | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onParagraphLines = useCallback(
    (key: number, boxes: LineBox[]) => {
      // A different document invalidates every measurement taken for the old one.
      if (measured.current !== paragraphs) {
        measured.current = paragraphs;
        lineBoxes.current = new Map();
      }
      lineBoxes.current.set(key, boxes);
      // Layout lands paragraph by paragraph. Paginating on each report would rebuild the
      // whole book once per paragraph; one pass after the burst has settled is enough.
      if (pending.current !== null) clearTimeout(pending.current);
      pending.current = setTimeout(() => {
        pending.current = null;
        setBreaks(paginate(lineBoxes.current, usable));
      }, 80);
    },
    [paragraphs, usable],
  );

  /**
   * The topmost visible paragraph becomes the position. Reporting on every frame would
   * write to the database sixty times a second, so this only fires when the paragraph
   * actually changes.
   */
  const lastReported = useRef(activeIndex);
  const scrollY = useRef(0);
  /** The page the last programmatic scroll aimed at; null once a finger has taken over. */
  const turning = useRef<number | null>(null);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      scrollY.current = y;
      if (paged) {
        // Scrolling by hand stays possible in paged mode, and the counter follows the
        // finger. While a turn is in flight, though, the offsets passing by still belong
        // to the page being left, and only the one that matches the destination counts.
        const at = pageAt(breaks, y);
        if (turning.current === null || turning.current === at) setPage(at);
      }
      if (!onPositionChange) return;
      let best: { token: number; distance: number } | null = null;
      for (const [token, top] of offsets.current) {
        const distance = Math.abs(top - y);
        if (best === null || distance < best.distance) best = { token, distance };
      }
      if (best && best.token !== lastReported.current) {
        lastReported.current = best.token;
        reported.current = true;
        onPositionChange(best.token);
      }
    },
    [breaks, onPositionChange, paged],
  );

  const turnPage = useCallback(
    (delta: number) => {
      // Where the last turn was headed outranks what the scroll stream last reported: a
      // throttled stream can stop arriving mid-animation, and two taps in a row would
      // then both be counted from the same page.
      const from = turning.current ?? pageAt(breaks, scrollY.current);
      const next = Math.min(breaks.length - 1, Math.max(0, from + delta));
      const y = breaks[next] ?? 0;
      turning.current = next;
      setPage(next);
      scroller.current?.scrollTo({ y, animated: !settings.reduceMotion });
    },
    [breaks, settings.reduceMotion],
  );

  /**
   * Guided reading: keep the word the stream is on inside the window.
   *
   * Only once its line has actually left the window — following every word would make the
   * text crawl under the reader instead of moving when it has to.
   *
   * The same jump opens the view on the word the stream left off at. It has to happen
   * here and not on the scroll view's own layout: a token only has a position once the
   * paragraph holding it has reported its lines, which is later.
   */
  useEffect(() => {
    if (ruler === null || viewport <= 0) return;
    // Before the content is measured a scroll would be clamped to the top, and the line
    // positions of a text that has not finished laying out are not worth acting on.
    if (content <= 0) return;
    // A position this view derived from its own scrolling must not scroll it again: that
    // is the loop where the page chases the word it just read off the page.
    if (reported.current && ruler.token === lastReported.current) return;
    const top = scrollY.current;
    if (ruler.y >= top && ruler.y + ruler.height <= top + usable) return;
    // Paged mode moves in pages, never to a spot halfway down one. The counter is left to
    // the scroll stream here rather than set outright: state set from an effect body is a
    // cascading render, and the offset that lands is the one that decides anyway.
    const target = paged ? pageAt(breaks, ruler.y) : null;
    const y = Math.max(0, target === null ? ruler.y - usable / 3 : (breaks[target] ?? 0));
    turning.current = target;
    scrollY.current = y;
    // Opening the view is a jump, not a journey: animating it would run the reader past
    // every page between the top and where they stopped.
    scroller.current?.scrollTo({
      y,
      animated: reported.current && !settings.reduceMotion,
    });
  }, [breaks, content, paged, ruler, settings.reduceMotion, usable, viewport]);

  /**
   * Auto-scroll, in points per second.
   *
   * Driven by an interval rather than an animation frame: a reader scrolls at twenty to
   * sixty points a second, and asking for sixty repaints a second to move two points is
   * battery spent on nothing a reader can see.
   */
  useEffect(() => {
    const speed = settings.readerAutoScroll;
    // Page turning is the opposite of scrolling, which is what its own setting says:
    // "turn pages instead of scrolling". Letting both run would drift the page out from
    // under the reader while a page number counts along, so paged mode wins.
    if (speed <= 0 || paged) return;
    // Auto-scroll moves without a finger and without a destination page, so the counter
    // has to go back to reading the offsets it is given.
    turning.current = null;
    const step = 120;
    const timer = setInterval(() => {
      scrollY.current += (speed * step) / 1000;
      scroller.current?.scrollTo({ y: scrollY.current, animated: false });
    }, step);
    return () => clearInterval(timer);
  }, [paged, settings.readerAutoScroll]);

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
      <View
        style={{ flex: 1, flexDirection: 'row', marginBottom: paged ? PAGE_FOOTER : 0 }}
      >
        {paged ? <PageEdge label={t('player.page.prev')} onPress={() => turnPage(-1)} /> : null}
        <ScrollView
          ref={scroller}
          style={{ flex: 1 }}
          onLayout={(event) => setViewport(event.nativeEvent.layout.height)}
          onContentSizeChange={(_width, height) => setContent(height)}
          onScroll={onScroll}
          // A finger on the glass outranks a turn that is still animating; where the scroll
          // finally comes to rest is the offset the next turn has to count from.
          onScrollBeginDrag={() => {
            turning.current = null;
          }}
          onMomentumScrollEnd={(event) => {
            scrollY.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={120}
          contentContainerStyle={{
            // The turn strips take their width out of the margin before they take any of
            // the text, so the column keeps as much of its measure as it can.
            paddingHorizontal: paged
              ? Math.max(0, settings.readerMargin - PAGE_EDGE)
              : settings.readerMargin,
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
              onLines={paged ? onParagraphLines : undefined}
            />
          ))}
        </ScrollView>
        {paged ? <PageEdge label={t('player.page.next')} onPress={() => turnPage(1)} /> : null}
      </View>

      {paged && breaks.length > 1 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: PAGE_FOOTER,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T variant="small" tone="faint">
            {t('player.page', { page: page + 1, total: breaks.length })}
          </T>
        </View>
      ) : null}

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

/**
 * A page-turn strip beside the text.
 *
 * Beside it, deliberately, and not over it: a transparent Pressable across the left and
 * right thirds would win every touch that lands on it, and tapping a word or long-pressing
 * to select would stop working exactly where most of the words are.
 */
function PageEdge({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: PAGE_EDGE }}
    />
  );
}

/**
 * Greedy pagination over the measured lines.
 *
 * A page starts at the top edge of a line and takes every following line that still fits
 * whole; the first one that would be cut off starts the next page. No line is ever split,
 * which is the only thing about pagination a reader actually notices.
 */
function paginate(boxes: ReadonlyMap<number, LineBox[]>, usable: number): readonly number[] {
  if (usable <= 0 || boxes.size === 0) return FIRST_PAGE;
  const lines: LineBox[] = [];
  for (const group of boxes.values()) {
    for (const line of group) lines.push(line);
  }
  lines.sort((a, b) => a.y - b.y);

  const breaks: number[] = [0];
  let start = 0;
  for (const line of lines) {
    if (line.y + line.height <= start + usable) continue;
    // A line taller than a whole page has nowhere to be pushed to.
    if (line.y <= start) continue;
    start = line.y;
    breaks.push(start);
  }
  return breaks;
}

/** The page a scroll offset sits on: the last break at or above it. */
function pageAt(breaks: readonly number[], y: number): number {
  let index = 0;
  for (let i = 0; i < breaks.length; i += 1) {
    if ((breaks[i] ?? 0) - PAGE_SNAP > y) break;
    index = i;
  }
  return index;
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
  onRuler: (band: { y: number; height: number; token: number }) => void;
  /** Reports every rendered line, in content coordinates. Only set in paged mode. */
  onLines?: (key: number, boxes: LineBox[]) => void;
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
  onLines,
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
        onRuler({ y: top + line.y, height: line.height, token: activeIndex });
        return;
      }
      seen += line.words;
    }
    // The position sits past the last counted word — mark the closing line rather than
    // leaving the band wherever it was.
    const last = rendered[rendered.length - 1];
    if (last) onRuler({ y: top + last.y, height: last.height, token: activeIndex });
  }, [activeIndex, onRuler, ordinal]);

  useEffect(publish, [publish]);

  /**
   * The same two measurements, handed up whole for pagination. Kept separate from the
   * ruler because it has to report for every paragraph, not just the one being read — and
   * because it must also fire when paged mode is switched on, which changes no layout and
   * would therefore never trigger `onTextLayout` again.
   */
  const publishLines = useCallback(() => {
    const top = selfY.current;
    const rendered = lines.current;
    if (top === null || rendered === null || onLines === undefined) return;
    onLines(
      paragraph.key,
      rendered.map((line) => ({ y: top + line.y, height: line.height })),
    );
  }, [onLines, paragraph.key]);

  useEffect(publishLines, [publishLines]);

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
        publishLines();
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
        publishLines();
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
