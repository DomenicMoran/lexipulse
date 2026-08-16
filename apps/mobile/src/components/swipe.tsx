import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useSettings, useTheme } from '../state/settings';

/**
 * Swipe a row to the left to reveal a delete action.
 *
 * The row follows the finger on the UI thread, so the gesture stays smooth even while an
 * import is parsing on the JS thread. Past the threshold it does not delete outright — it
 * calls back, and the caller asks for confirmation. A list where a stray swipe destroys a
 * book is a list nobody trusts.
 */
const REVEAL = 88;
const TRIGGER = 120;

export function SwipeToDelete({
  children,
  onDelete,
  label,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  label: string;
}) {
  const theme = useTheme();
  const { settings } = useSettings();
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const duration = settings.reduceMotion ? 0 : 160;

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Horizontal only, and only past a real threshold: the list scrolls vertically
        // and must win any gesture that is mostly up or down.
        .activeOffsetX([-14, 14])
        .failOffsetY([-10, 10])
        .onStart(() => {
          startX.value = translateX.value;
        })
        .onUpdate((event) => {
          const next = startX.value + event.translationX;
          translateX.value = Math.min(0, Math.max(next, -TRIGGER - 40));
        })
        .onEnd(() => {
          if (translateX.value <= -TRIGGER) {
            translateX.value = withTiming(0, { duration });
            runOnJS(onDelete)();
            return;
          }
          translateX.value = withTiming(translateX.value <= -REVEAL / 2 ? -REVEAL : 0, {
            duration,
          });
        }),
    [duration, onDelete, startX, translateX],
  );

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <View>
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: REVEAL,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.lg,
          backgroundColor: theme.accent.soft,
        }}
      >
        <Ionicons name="trash-outline" size={20} color={theme.accent.base} />
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle} accessibilityHint={label} collapsable={false}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
