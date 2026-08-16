import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch as RNSwitch,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';

import { useTheme } from '../state/settings';

/**
 * The app's UI primitives.
 *
 * `@lexipulse/ui` ships React components too, but they render DOM nodes and style
 * themselves with Tailwind classes over CSS variables — none of which exists here. What
 * is shared with the web app is the layer underneath: the tokens in
 * `@lexipulse/ui/tokens`, which `useTheme()` resolves.
 */

// ---------------------------------------------------------------------------- text

type TextTone = 'default' | 'muted' | 'faint' | 'accent';
type TextVariant = 'body' | 'small' | 'label' | 'title' | 'display' | 'mono';

export function T({
  children,
  tone = 'default',
  variant = 'body',
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  tone?: TextTone;
  variant?: TextVariant;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const theme = useTheme();
  const color = {
    default: theme.colors.text,
    muted: theme.colors.textMuted,
    faint: theme.colors.textFaint,
    accent: theme.accent.base,
  }[tone];

  const variants: Record<TextVariant, TextStyle> = {
    body: { fontSize: theme.font.size.base, lineHeight: theme.font.size.base * 1.5 },
    small: { fontSize: theme.font.size.sm, lineHeight: theme.font.size.sm * 1.45 },
    label: {
      fontSize: theme.font.size.xs,
      lineHeight: theme.font.size.xs * 1.3,
      letterSpacing: 0.9,
      textTransform: 'uppercase',
      fontWeight: '600',
    },
    title: {
      fontSize: theme.font.size.lg,
      lineHeight: theme.font.size.lg * 1.25,
      fontWeight: '600',
      letterSpacing: -0.3,
    },
    display: {
      fontSize: theme.font.size['2xl'],
      lineHeight: theme.font.size['2xl'] * 1.15,
      fontWeight: '700',
      letterSpacing: -0.8,
    },
    mono: { fontSize: theme.font.size.base, fontFamily: theme.font.mono },
  };
  const variantStyle = variants[variant];

  return (
    <Text numberOfLines={numberOfLines} style={[{ color }, variantStyle, style]}>
      {children}
    </Text>
  );
}

// -------------------------------------------------------------------------- screen

export function Screen({
  children,
  scroll = true,
  contentStyle,
}: {
  children?: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const base: ViewStyle = { flex: 1, backgroundColor: theme.colors.bg };
  if (!scroll) return <View style={[base, contentStyle]}>{children}</View>;
  return (
    <ScrollView
      style={base}
      contentContainerStyle={[{ padding: theme.space[5], paddingBottom: theme.space[16] }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      indicatorStyle={theme.dark ? 'white' : 'black'}
    >
      {children}
    </ScrollView>
  );
}

export function ScreenTitle({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.space[6] }}>
      <T variant="display">{children}</T>
    </View>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.space[8] }}>
      <View style={{ marginBottom: theme.space[3] }}>
        <T variant="label" tone="faint">
          {title}
        </T>
      </View>
      <Card>{children}</Card>
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: theme.hairline,
          borderRadius: theme.radius.lg,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: theme.hairline, backgroundColor: theme.colors.border }} />;
}

// ----------------------------------------------------------------------------- row

export function Row({
  label,
  hint,
  right,
  onPress,
  danger,
  icon,
}: {
  label: string;
  hint?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const theme = useTheme();
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.space[4],
        paddingVertical: theme.space[3],
        minHeight: 52,
        gap: theme.space[3],
      }}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={18}
          color={danger ? theme.accent.base : theme.colors.textMuted}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <T style={danger ? { color: theme.accent.base } : undefined}>{label}</T>
        {hint ? (
          <T variant="small" tone="faint" style={{ marginTop: 2 }}>
            {hint}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: theme.colors.surfaceHover }}
      style={({ pressed }) => ({
        backgroundColor: pressed ? theme.colors.surfaceHover : 'transparent',
      })}
    >
      {body}
    </Pressable>
  );
}

// -------------------------------------------------------------------------- button

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  busy,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const palette = {
    primary: { bg: theme.accent.base, fg: theme.accent.on, border: 'transparent' },
    secondary: { bg: theme.colors.surface, fg: theme.colors.text, border: theme.colors.border },
    ghost: { bg: 'transparent', fg: theme.colors.textMuted, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      android_ripple={{ color: theme.colors.surfaceHover }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.space[2],
          minHeight: 48,
          paddingHorizontal: theme.space[5],
          borderRadius: theme.radius.md,
          backgroundColor: palette.bg,
          borderWidth: variant === 'secondary' ? theme.hairline : 0,
          borderColor: palette.border,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={palette.fg} />
      ) : null}
      <Text style={{ color: palette.fg, fontSize: theme.font.size.base, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  size = 22,
  label,
  active,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  size?: number;
  label: string;
  active?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: pressed ? theme.colors.surfaceHover : 'transparent',
      })}
    >
      <Ionicons
        name={icon}
        size={size}
        color={active ? theme.accent.base : theme.colors.textMuted}
      />
    </Pressable>
  );
}

// -------------------------------------------------------------------------- switch

export function Switch({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  const theme = useTheme();
  return (
    <RNSwitch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: theme.colors.borderStrong, true: theme.accent.base }}
      thumbColor={theme.colors.surface}
      ios_backgroundColor={theme.colors.borderStrong}
    />
  );
}

// ---------------------------------------------------------------- segmented control

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.bg,
        borderRadius: theme.radius.md,
        borderWidth: theme.hairline,
        borderColor: theme.colors.border,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: theme.space[2],
              borderRadius: theme.radius.sm,
              backgroundColor: selected ? theme.accent.soft : 'transparent',
            }}
          >
            <Text
              numberOfLines={1}
              // Four themes share one row, and the longest name does not fit at the
              // normal size: "Minimal White" was rendering as "Minimal Wh…". Shrinking
              // the label keeps the option readable, which is the whole point of showing
              // its name; the floor stops it from turning into fine print.
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{
                color: selected ? theme.accent.base : theme.colors.textMuted,
                fontSize: theme.font.size.sm,
                fontWeight: selected ? '600' : '500',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// -------------------------------------------------------------------------- slider

/**
 * A slider built on the gesture handler rather than a community package.
 *
 * The one control the whole product hinges on is the WPM slider, and it has to stay
 * responsive while the player is running. Pan gestures are handled on the UI thread and
 * only the resulting value crosses to JS, so a drag never competes with the token stream
 * for the JS thread.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  onSettled,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  onSettled?: (next: number) => void;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const KNOB = 26;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    widthRef.current = next;
    setWidth(next);
  }, []);

  const emit = useCallback(
    (x: number, settled: boolean) => {
      const track = Math.max(widthRef.current - KNOB, 1);
      const ratio = Math.min(Math.max((x - KNOB / 2) / track, 0), 1);
      const raw = min + ratio * (max - min);
      const snapped = Math.min(Math.max(Math.round(raw / step) * step, min), max);
      onChange(snapped);
      if (settled) onSettled?.(snapped);
    },
    [max, min, onChange, onSettled, step],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((event) => {
          runOnJS(emit)(event.x, false);
        })
        .onUpdate((event) => {
          runOnJS(emit)(event.x, false);
        })
        .onEnd((event) => {
          runOnJS(emit)(event.x, true);
        }),
    [emit],
  );

  const ratio = max > min ? (value - min) / (max - min) : 0;
  const knobLeft = Math.max(0, ratio * Math.max(width - KNOB, 0));

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={onLayout}
        style={{ height: 44, justifyContent: 'center' }}
        accessibilityRole="adjustable"
        accessibilityValue={{ min, max, now: value }}
      >
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: theme.colors.borderStrong,
            marginHorizontal: KNOB / 2,
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${ratio * 100}%`,
              borderRadius: 2,
              backgroundColor: theme.accent.base,
            }}
          />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: knobLeft,
            width: KNOB,
            height: KNOB,
            borderRadius: KNOB / 2,
            backgroundColor: theme.colors.text,
            borderWidth: theme.hairline,
            borderColor: theme.colors.borderStrong,
          }}
        />
      </View>
    </GestureDetector>
  );
}

// --------------------------------------------------------------------- progress bar

export function ProgressBar({ percent, height = 3 }: { percent: number; height?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: theme.colors.borderStrong,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${Math.min(Math.max(percent, 0), 1) * 100}%`,
          height: '100%',
          backgroundColor: theme.accent.base,
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------- empty state

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: theme.space[16], gap: theme.space[3] }}>
      <Ionicons name={icon} size={40} color={theme.colors.textFaint} />
      <T variant="title">{title}</T>
      <T tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>
        {body}
      </T>
      {action ? <View style={{ marginTop: theme.space[3] }}>{action}</View> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
