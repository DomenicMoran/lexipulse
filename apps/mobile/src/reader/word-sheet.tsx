/**
 * The word overview: what this word is doing in the rest of the document.
 *
 * Two things sit here, in this order on purpose. First the offline answer, which is every
 * other place the word stands, with its chapter and its sentence, one tap away. Second the
 * hand-off to an app of the reader's choosing, which is the only part that leaves the
 * device and therefore never happens by itself.
 *
 * It opens from the selection bar rather than from a tap on a word. A tap already means
 * "read on from here" in page mode, and taking that gesture away to show a panel would
 * cost a working shortcut to gain a slower one. Long press already means "I mean this
 * word", the bar is already on screen at that moment, and an entry there is a decision the
 * reader makes rather than one they trigger by accident while scrolling.
 */
import { useCallback, useMemo } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RsvpToken } from '@lexipulse/core';

import { useAlert } from '../components/alert';
import { Divider, IconButton, Row, T } from '../components/ui';
import { t } from '../i18n';
import { useTheme } from '../state/settings';
import { SearchHitRow } from './search-sheet';
import { handOffWord } from './word-handoff';
import { occurrencesOf } from './word-lookup';

export function WordSheet({
  /** The selected text, or null when the sheet is closed. */
  word,
  tokens,
  onClose,
  onSelect,
}: {
  word: string | null;
  tokens: readonly RsvpToken[];
  onClose: () => void;
  onSelect: (tokenIndex: number) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const alert = useAlert();

  const found = useMemo(
    () => (word === null ? null : occurrencesOf(tokens, word)),
    [tokens, word],
  );

  const lookUp = useCallback(() => {
    const text = found?.word ?? '';
    if (text.length === 0) return;
    void handOffWord(text).then((result) => {
      if (result === 'handed') return;
      // A device without a dictionary, translator or browser is a normal device. It gets
      // the app's own dialog, not a crash and not a system toast in the wrong theme.
      alert(t('lookup.handoff.none'), t('lookup.handoff.none.body'));
    });
  }, [alert, found]);

  const count = found?.hits.length ?? 0;
  const summary = found?.capped
    ? t('lookup.count.many', { count })
    : count === 0
      ? t('lookup.count.none')
      : count === 1
        ? t('lookup.count.one')
        : t('lookup.count', { count });

  return (
    <Modal
      visible={word !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose} />
      <View
        style={{
          maxHeight: '72%',
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          borderTopWidth: theme.hairline,
          borderColor: theme.colors.border,
          paddingBottom: insets.bottom + theme.space[4],
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space[2],
            padding: theme.space[4],
          }}
        >
          <View style={{ flex: 1 }}>
            <T variant="title" numberOfLines={2}>
              {found?.word ?? ''}
            </T>
            <T variant="small" tone="faint">
              {summary}
            </T>
          </View>
          <IconButton icon="close" label={t('common.close')} onPress={onClose} />
        </View>

        <Divider />
        <Row
          icon="open-outline"
          label={t('lookup.handoff')}
          hint={t('lookup.handoff.hint')}
          onPress={lookUp}
        />
        <Divider />

        {count === 0 ? (
          <View style={{ padding: theme.space[5] }}>
            <T tone="muted">{t('lookup.empty')}</T>
          </View>
        ) : (
          <FlatList
            data={found?.hits ?? []}
            keyExtractor={(hit) => String(hit.tokenIndex)}
            renderItem={({ item }) => (
              <SearchHitRow hit={item} onPress={() => onSelect(item.tokenIndex)} />
            )}
            ItemSeparatorComponent={Divider}
            contentContainerStyle={{ paddingBottom: theme.space[4] }}
          />
        )}
      </View>
    </Modal>
  );
}
