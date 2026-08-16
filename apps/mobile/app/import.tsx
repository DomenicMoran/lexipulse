import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, TextInput, View } from 'react-native';

import type { LexiDocument } from '@lexipulse/core';

import { Button, Card, Divider, Row, Screen, T } from '../src/components/ui';
import { formatNumber, t } from '../src/i18n';
import { importFromPicker, importFromText, importFromUrl, isProbablyUrl } from '../src/lib/import';
import { usePdfBridge } from '../src/pdf/bridge';
import { useLibrary } from '../src/state/library';
import { useReader } from '../src/state/reader';
import { useTheme } from '../src/state/settings';

type Busy = { kind: 'idle' } | { kind: 'working'; detail: string };

export default function ImportScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { add } = useLibrary();
  const { open } = useReader();
  const { createLoader } = usePdfBridge();

  const [busy, setBusy] = useState<Busy>({ kind: 'idle' });
  const [url, setUrl] = useState('');

  /**
   * One landing point for all three sources: store the document, open it, and go
   * straight to the player. Importing and then having to find the file in a list is a
   * step nobody wants.
   */
  const finish = useCallback(
    async (document: LexiDocument) => {
      await add(document);
      await open(document.id);
      router.dismissTo('/read');
      Alert.alert(
        t('import.done', {
          title: document.title,
          count: formatNumber(document.wordCount),
        }),
        document.importReport.notes.join('\n'),
      );
    },
    [add, open, router],
  );

  const fail = useCallback((error: unknown) => {
    Alert.alert(t('import.failed'), error instanceof Error ? error.message : String(error));
  }, []);

  const onPickFile = useCallback(() => {
    setBusy({ kind: 'working', detail: t('import.busy') });
    void (async () => {
      try {
        const document = await importFromPicker({
          pdfLoader: createLoader(),
          onProgress: ({ page, total }) =>
            setBusy({ kind: 'working', detail: t('import.busy.pdf', { page, total }) }),
        });
        if (document) await finish(document);
      } catch (error) {
        fail(error);
      } finally {
        setBusy({ kind: 'idle' });
      }
    })();
  }, [createLoader, fail, finish]);

  const onImportUrl = useCallback(() => {
    if (!isProbablyUrl(url)) {
      Alert.alert(t('import.failed'), t('import.invalidUrl'));
      return;
    }
    setBusy({ kind: 'working', detail: t('import.busy') });
    void (async () => {
      try {
        await finish(await importFromUrl(url));
      } catch (error) {
        fail(error);
      } finally {
        setBusy({ kind: 'idle' });
      }
    })();
  }, [fail, finish, url]);

  const onPaste = useCallback(() => {
    setBusy({ kind: 'working', detail: t('import.busy') });
    void (async () => {
      try {
        const text = await Clipboard.getStringAsync();
        if (!text.trim()) {
          Alert.alert(t('import.failed'), t('import.paste.empty'));
          return;
        }
        // Someone who copied a link almost certainly means "read that page", not "read
        // this URL as if it were prose".
        if (isProbablyUrl(text) && !text.trim().includes(' ')) {
          await finish(await importFromUrl(text.trim()));
          return;
        }
        await finish(importFromText(text));
      } catch (error) {
        fail(error);
      } finally {
        setBusy({ kind: 'idle' });
      }
    })();
  }, [fail, finish]);

  if (busy.kind === 'working') {
    return (
      <Screen scroll={false} contentStyle={{ alignItems: 'center', justifyContent: 'center', gap: theme.space[4] }}>
        <ActivityIndicator color={theme.accent.base} size="large" />
        <T tone="muted">{busy.detail}</T>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card style={{ marginBottom: theme.space[4] }}>
        <Row
          label={t('import.file')}
          hint={t('import.file.hint')}
          icon="document-outline"
          onPress={onPickFile}
        />
        <Divider />
        <Row
          label={t('import.paste')}
          hint={t('import.paste.hint')}
          icon="clipboard-outline"
          onPress={onPaste}
        />
      </Card>

      <Card style={{ padding: theme.space[4], gap: theme.space[3] }}>
        <View>
          <T style={{ fontWeight: '600' }}>{t('import.url')}</T>
          <T variant="small" tone="faint">
            {t('import.url.hint')}
          </T>
        </View>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder={t('import.url.placeholder')}
          placeholderTextColor={theme.colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          inputMode="url"
          returnKeyType="go"
          onSubmitEditing={onImportUrl}
          style={{
            color: theme.colors.text,
            backgroundColor: theme.colors.bg,
            borderWidth: theme.hairline,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.space[3],
            minHeight: 46,
            fontSize: theme.font.size.base,
          }}
        />
        <Button label={t('import.url.go')} icon="globe-outline" onPress={onImportUrl} />
      </Card>
    </Screen>
  );
}
