/**
 * The notice that has to travel with the bundled typefaces.
 *
 * The four reading faces are under the SIL Open Font License 1.1 and the icon set under
 * MIT. Both permit bundling inside an application, including a paid one, on the condition
 * that the licence and copyright travel with the files. Shipping a font inside the binary
 * is redistribution, so the notice has to reach the reader rather than sit in the
 * repository where only we can see it.
 *
 * The full licence texts are not reproduced here: the OFL is identical for every family,
 * it is four kilobytes of legal English on a phone screen, and the canonical copy lives at
 * a stable address. The copyright lines are what identify each font, and those are quoted
 * in full.
 */
import { Modal, Pressable, ScrollView, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { Divider, T } from './ui';
import { t } from '../i18n';
import { useTheme } from '../state/settings';

interface Face {
  name: string;
  copyright: string;
  licence: string;
  home: string;
}

/**
 * Copyright lines taken from each font's own OFL header, not paraphrased. The names are
 * Reserved Font Names under the licence, which is why every file ships unmodified and
 * under its original name.
 */
const FACES: readonly Face[] = [
  {
    name: 'JetBrains Mono',
    copyright: 'Copyright 2020 The JetBrains Mono Project Authors',
    licence: 'SIL Open Font License 1.1',
    home: 'https://github.com/JetBrains/JetBrainsMono',
  },
  {
    name: 'Literata',
    copyright: 'Copyright 2018 The Literata Project Authors',
    licence: 'SIL Open Font License 1.1',
    home: 'https://github.com/googlefonts/literata',
  },
  {
    name: 'Inter',
    copyright: 'Copyright 2016 The Inter Project Authors',
    licence: 'SIL Open Font License 1.1',
    home: 'https://github.com/rsms/inter',
  },
  {
    name: 'OpenDyslexic',
    copyright: 'Copyright 2019 Abbie Gonzalez',
    licence: 'SIL Open Font License 1.1',
    home: 'https://opendyslexic.org',
  },
  {
    // Shipped as part of @expo/vector-icons, whose MIT notice names these two holders.
    name: 'Ionicons (@expo/vector-icons)',
    copyright: 'Copyright (c) 2015 Joel Arvidsson, Copyright (c) 2020 650 Industries',
    licence: 'MIT',
    home: 'https://github.com/expo/vector-icons',
  },
];

export function FontLicences({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: theme.space[4],
            paddingTop: theme.space[12],
            paddingBottom: theme.space[3],
          }}
        >
          <T variant="title">{t('licences.title')}</T>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={12}
            style={{ padding: theme.space[2] }}
          >
            <T style={{ color: theme.accent.base, fontWeight: '600' }}>{t('common.close')}</T>
          </Pressable>
        </View>
        <Divider />

        <ScrollView
          contentContainerStyle={{
            padding: theme.space[4],
            paddingBottom: theme.space[16],
            gap: theme.space[4],
          }}
        >
          <T tone="muted">{t('licences.intro')}</T>

          {FACES.map((face) => (
            <View key={face.name} style={{ gap: theme.space[1] }}>
              <T style={{ fontWeight: '600' }}>{face.name}</T>
              <T variant="small" tone="muted">
                {face.copyright}
              </T>
              <T variant="small" tone="faint">
                {face.licence}
              </T>
              <Pressable
                onPress={() => void WebBrowser.openBrowserAsync(face.home)}
                accessibilityRole="link"
                hitSlop={8}
              >
                <T variant="small" style={{ color: theme.accent.base }}>
                  {face.home}
                </T>
              </Pressable>
            </View>
          ))}

          <Divider />
          <T variant="small" tone="faint">
            {t('licences.ofl')}
          </T>
          <Pressable
            onPress={() => void WebBrowser.openBrowserAsync('https://scripts.sil.org/OFL')}
            accessibilityRole="link"
            hitSlop={8}
          >
            <T variant="small" style={{ color: theme.accent.base }}>
              https://scripts.sil.org/OFL
            </T>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
