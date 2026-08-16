import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { Modal, View } from 'react-native';

import { Button, Card, T } from '../components/ui';
import { t, type MessageKey } from '../i18n';
import { driver, initStore } from '../lib/store';
import { useTheme } from '../state/settings';

/**
 * The gesture legend, shown exactly once.
 *
 * A gesture-only player is undiscoverable otherwise — and an overlay that reappears is
 * worse than one that never showed. The flag lives under the `lexi:` prefix so "delete
 * all data" clears it too, which is the honest behaviour: a wiped app is a new app.
 */
const SEEN_KEY = 'lexi:mobile:onboarding-v1';

const ITEMS: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: MessageKey;
  body: MessageKey;
}[] = [
  { icon: 'play-circle-outline', title: 'onboarding.tap', body: 'onboarding.tap.body' },
  { icon: 'swap-horizontal-outline', title: 'onboarding.swipeH', body: 'onboarding.swipeH.body' },
  { icon: 'swap-vertical-outline', title: 'onboarding.swipeV', body: 'onboarding.swipeV.body' },
  { icon: 'bookmark-outline', title: 'onboarding.longPress', body: 'onboarding.longPress.body' },
  { icon: 'return-up-back-outline', title: 'onboarding.twoFinger', body: 'onboarding.twoFinger.body' },
];

export function useOnboarding() {
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await initStore();
      const seen = await driver.get(SEEN_KEY);
      if (cancelled) return;
      setVisible(seen === null);
      setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    void driver.set(SEEN_KEY, String(Date.now()));
  }, []);

  return { visible: checked && visible, dismiss };
}

export function OnboardingOverlay({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay,
          justifyContent: 'center',
          padding: theme.space[5],
        }}
      >
        <Card style={{ padding: theme.space[5] }}>
          <T variant="title" style={{ marginBottom: theme.space[5] }}>
            {t('onboarding.title')}
          </T>

          <View style={{ gap: theme.space[4] }}>
            {ITEMS.map((item) => (
              <View
                key={item.title}
                style={{ flexDirection: 'row', gap: theme.space[3], alignItems: 'flex-start' }}
              >
                <Ionicons name={item.icon} size={22} color={theme.accent.base} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '600' }}>{t(item.title)}</T>
                  <T variant="small" tone="muted">
                    {t(item.body)}
                  </T>
                </View>
              </View>
            ))}
          </View>

          <Button
            label={t('onboarding.start')}
            onPress={onDismiss}
            style={{ marginTop: theme.space[6] }}
          />
        </Card>
      </View>
    </Modal>
  );
}
