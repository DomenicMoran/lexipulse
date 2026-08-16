/**
 * Dialogs that obey the app's theme.
 *
 * React Native's `Alert.alert` renders a platform dialog styled by the *system* colour
 * scheme. This app ships four themes of its own, so a reader on OLED Black with a phone
 * in light mode gets a white box with teal buttons dropped onto a black screen — the one
 * surface in the product that ignores the setting they chose.
 *
 * The API is deliberately shaped like `Alert.alert(title, body?, buttons?)` so call sites
 * read the same; the only difference is that it comes from a hook.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { t } from '../i18n';
import { useTheme } from '../state/settings';
import { T } from './ui';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

type ShowAlert = (title: string, body?: string | null, buttons?: AlertButton[]) => void;

const AlertContext = createContext<ShowAlert | null>(null);

interface AlertState {
  title: string;
  body: string | null;
  buttons: AlertButton[];
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const [state, setState] = useState<AlertState | null>(null);

  const show = useCallback<ShowAlert>((title, body, buttons) => {
    setState({
      title,
      body: body ?? null,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: t('common.ok') }],
    });
  }, []);

  const value = useMemo(() => show, [show]);

  const dismiss = useCallback(
    (button?: AlertButton) => {
      setState(null);
      button?.onPress?.();
    },
    [],
  );

  return (
    <AlertContext.Provider value={value}>
      {children}
      <Modal
        visible={state !== null}
        transparent
        animationType="fade"
        // Android's back button must behave like the cancel button, not like a silent
        // dismissal that leaves the caller waiting for a press that never comes.
        onRequestClose={() => dismiss(state?.buttons.find((b) => b.style === 'cancel'))}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.overlay,
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.space[5],
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 420,
              maxHeight: '80%',
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
              borderWidth: theme.hairline,
              borderColor: theme.colors.border,
              overflow: 'hidden',
            }}
          >
            <ScrollView contentContainerStyle={{ padding: theme.space[5], gap: theme.space[3] }}>
              <T variant="title">{state?.title ?? ''}</T>
              {state?.body ? <T tone="muted">{state.body}</T> : null}
            </ScrollView>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: theme.space[2],
                paddingHorizontal: theme.space[4],
                paddingBottom: theme.space[4],
              }}
            >
              {(state?.buttons ?? []).map((button) => (
                <Pressable
                  key={button.text}
                  accessibilityRole="button"
                  onPress={() => dismiss(button)}
                  style={{
                    paddingVertical: theme.space[3],
                    paddingHorizontal: theme.space[4],
                    borderRadius: theme.radius.sm,
                  }}
                >
                  <T
                    style={{
                      color:
                        button.style === 'destructive'
                          ? theme.colors.danger
                          : button.style === 'cancel'
                            ? theme.colors.textMuted
                            : theme.accent.base,
                      fontWeight: '600',
                    }}
                  >
                    {button.text}
                  </T>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
}

/** `alert(title, body?, buttons?)` — same shape as `Alert.alert`, themed. */
export function useAlert(): ShowAlert {
  const show = useContext(AlertContext);
  if (!show) throw new Error('useAlert must be used inside <AlertProvider>.');
  return show;
}
