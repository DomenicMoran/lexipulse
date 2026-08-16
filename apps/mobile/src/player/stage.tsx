import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { splitAtOrp, type RsvpToken } from '@lexipulse/core';
import { charWidthPx, computeStageGeometry, pivotOffsetPx } from '@lexipulse/ui/geometry';

import { useTheme } from '../state/settings';

/**
 * The RSVP stage.
 *
 * One invariant carries the whole idea: the ORP character sits on the same physical
 * column for every word, forever. `@lexipulse/ui/geometry` owns that arithmetic and is
 * shared with the web player — the only difference here is that the shift is in pixels
 * (a measured character advance) instead of CSS `ch` units.
 *
 * That is also why the face has to be JetBrains Mono. With a proportional font every word
 * would move the pivot by a fraction of a character and the stream would read as flicker
 * rather than as words.
 */

export const STAGE_GEOMETRY = computeStageGeometry();

export function RsvpStage({
  token,
  fontSize,
  showGuides,
  contextBefore,
  contextAfter,
}: {
  token: RsvpToken | null;
  fontSize: number;
  showGuides: boolean;
  contextBefore: string[];
  contextAfter: string[];
}) {
  const theme = useTheme();
  const advance = charWidthPx(fontSize);
  const stageWidth = STAGE_GEOMETRY.columns * advance;
  const focusX = STAGE_GEOMETRY.focusColumn * advance + advance / 2;

  const split = useMemo(
    () => (token ? splitAtOrp(token.text, token.orp) : null),
    [token],
  );

  const offset = token ? pivotOffsetPx(token.orp, STAGE_GEOMETRY.focusColumn, advance) : 0;

  const wordStyle = {
    fontFamily: theme.font.mono,
    fontSize,
    // Locking the line box stops a word with a descender from nudging the baseline.
    lineHeight: Math.round(fontSize * 1.32),
    includeFontPadding: false,
  } as const;

  return (
    <View style={styles.wrapper} accessibilityRole="text" accessibilityLabel={token?.text ?? ''}>
      {contextBefore.length > 0 ? (
        <Text
          numberOfLines={1}
          style={[styles.context, { color: theme.colors.textFaint, fontSize: fontSize * 0.34 }]}
        >
          {contextBefore.join(' ')}
        </Text>
      ) : null}

      <View style={[styles.stage, { width: stageWidth, height: Math.round(fontSize * 2.1) }]}>
        {showGuides ? (
          <>
            <View
              style={[
                styles.guide,
                { left: focusX - theme.hairline / 2, top: 0, height: fontSize * 0.28 },
                { backgroundColor: theme.colors.rail, width: Math.max(1, theme.hairline * 2) },
              ]}
            />
            <View
              style={[
                styles.guide,
                { left: focusX - theme.hairline / 2, bottom: 0, height: fontSize * 0.28 },
                { backgroundColor: theme.colors.rail, width: Math.max(1, theme.hairline * 2) },
              ]}
            />
          </>
        ) : null}

        <View style={[styles.line, { transform: [{ translateX: offset }] }]}>
          {split ? (
            <Text style={wordStyle} numberOfLines={1}>
              <Text style={{ color: theme.colors.text }}>{split.before}</Text>
              <Text style={{ color: theme.accent.base }}>{split.pivot}</Text>
              <Text style={{ color: theme.colors.text }}>{split.after}</Text>
            </Text>
          ) : null}
        </View>
      </View>

      {contextAfter.length > 0 ? (
        <Text
          numberOfLines={1}
          style={[styles.context, { color: theme.colors.textFaint, fontSize: fontSize * 0.34 }]}
        >
          {contextAfter.join(' ')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  stage: { justifyContent: 'center' },
  // The word is laid out from the left edge of the stage and then shifted, so the pivot
  // lands on the focus column. Centring it would defeat the entire mechanism.
  line: { position: 'absolute', left: 0, right: 0, alignItems: 'flex-start' },
  guide: { position: 'absolute' },
  context: { textAlign: 'center', opacity: 0.8 },
});
