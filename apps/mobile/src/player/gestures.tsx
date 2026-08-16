import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';

/**
 * The player's gesture surface.
 *
 * Every control is a gesture because the reading surface must stay empty — a row of
 * buttons under the word is exactly the kind of decoration that competes with the word.
 * The mapping is explained once, in the onboarding overlay.
 */

/** Below this the movement is a tap that wandered, not a swipe. */
const SWIPE_THRESHOLD = 36;

export interface PlayerGestureHandlers {
  onTap: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  onSwipeDown: () => void;
  onLongPress: () => void;
  onTwoFingerTap: () => void;
}

export function PlayerGestureArea({
  children,
  handlers,
  style,
}: {
  children: React.ReactNode;
  handlers: PlayerGestureHandlers;
  style?: StyleProp<ViewStyle>;
}) {
  const gesture = useMemo(() => {
    const twoFinger = Gesture.Tap()
      .minPointers(2)
      .onEnd((_event, success) => {
        if (success) runOnJS(handlers.onTwoFingerTap)();
      });

    const tap = Gesture.Tap()
      .maxDuration(300)
      .onEnd((_event, success) => {
        if (success) runOnJS(handlers.onTap)();
      });

    const longPress = Gesture.LongPress()
      .minDuration(450)
      .onStart(() => {
        runOnJS(fireBookmark)(handlers.onLongPress);
      });

    const pan = Gesture.Pan()
      .minDistance(SWIPE_THRESHOLD / 2)
      .onEnd((event) => {
        const { translationX: dx, translationY: dy } = event;
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx <= -SWIPE_THRESHOLD) runOnJS(handlers.onSwipeLeft)();
          else if (dx >= SWIPE_THRESHOLD) runOnJS(handlers.onSwipeRight)();
          return;
        }
        if (dy <= -SWIPE_THRESHOLD) runOnJS(handlers.onSwipeUp)();
        else if (dy >= SWIPE_THRESHOLD) runOnJS(handlers.onSwipeDown)();
      });

    // Two fingers beat one, and a long press beats a tap; the pan runs against whichever
    // of those wins so a drag never also registers as a tap.
    return Gesture.Race(pan, Gesture.Exclusive(twoFinger, longPress, tap));
  }, [handlers]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={style} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
}

/** The bookmark is the one gesture with no visual anchor, so it confirms itself by feel. */
function fireBookmark(handler: () => void) {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  handler();
}
