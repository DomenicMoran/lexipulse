import { useCallback, useMemo, useRef, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';

import { useTheme } from '../state/settings';

/**
 * The progress bar, draggable.
 *
 * While a drag is in progress the bar shows the finger position rather than the engine's,
 * so it never fights the stream for control of its own handle. On release the engine takes
 * over again.
 */
export function Scrubber({
  percent,
  onScrub,
}: {
  percent: number;
  onScrub: (percent: number) => void;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState(0);
  const widthRef = useRef(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    widthRef.current = event.nativeEvent.layout.width;
    setWidth(widthRef.current);
  }, []);

  const move = useCallback(
    (x: number, done: boolean) => {
      const ratio = Math.min(Math.max(x / Math.max(widthRef.current, 1), 0), 1);
      setDragPercent(ratio);
      setDragging(!done);
      onScrub(ratio);
    },
    [onScrub],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((event) => {
          runOnJS(move)(event.x, false);
        })
        .onUpdate((event) => {
          runOnJS(move)(event.x, false);
        })
        .onEnd((event) => {
          runOnJS(move)(event.x, true);
        }),
    [move],
  );

  const shown = dragging ? dragPercent : percent;
  const clamped = Math.min(Math.max(shown, 0), 1);

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={onLayout}
        // The bar itself is 4 px; the touch target around it is 28. A hairline you cannot
        // hit is decoration, not a control.
        style={{ height: 28, justifyContent: 'center' }}
        accessibilityRole="adjustable"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      >
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: theme.colors.borderStrong,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: clamped * width,
              height: '100%',
              backgroundColor: theme.accent.base,
            }}
          />
        </View>
        {dragging ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: Math.max(0, clamped * width - 6),
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: theme.accent.base,
            }}
          />
        ) : null}
      </View>
    </GestureDetector>
  );
}
