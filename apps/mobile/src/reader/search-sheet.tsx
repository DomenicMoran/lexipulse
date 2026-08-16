/**
 * Full-text search over the open document.
 *
 * A reader without search is a reader you cannot look anything up in. The matching itself
 * lives in core (`searchTokens`), so the web app gets the same behaviour — including the
 * diacritic folding that lets someone type "fur" and find "für", which is what German
 * readers actually type on a phone.
 */
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { searchTokens, type RsvpToken, type SearchHit } from '@lexipulse/core';

import { Divider, IconButton, T } from '../components/ui';
import { t } from '../i18n';
import { useTheme } from '../state/settings';

export function SearchSheet({
  visible,
  tokens,
  onClose,
  onSelect,
}: {
  visible: boolean;
  tokens: readonly RsvpToken[];
  onClose: () => void;
  onSelect: (tokenIndex: number) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  // Typing stays responsive while a long book is scanned: the input updates immediately,
  // the search runs against the value React hands over when it has time.
  const deferred = useDeferredValue(query);
  const hits = useMemo(() => {
    if (!visible || deferred.trim().length < 2) return [];
    return searchTokens(tokens, deferred);
  }, [visible, deferred, tokens]);

  const tooShort = query.trim().length > 0 && query.trim().length < 2;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ height: insets.top + theme.space[4], backgroundColor: theme.colors.overlay }}
        onPress={onClose}
      />
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          borderTopWidth: theme.hairline,
          borderColor: theme.colors.border,
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
            <T variant="title">{t('search.title')}</T>
          </View>
          <IconButton icon="close" label={t('common.close')} onPress={onClose} />
        </View>

        <View style={{ paddingHorizontal: theme.space[4], paddingBottom: theme.space[3] }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor={theme.colors.textFaint}
            autoFocus
            returnKeyType="search"
            style={{
              borderWidth: theme.hairline,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.bg,
              color: theme.colors.text,
              paddingHorizontal: theme.space[4],
              paddingVertical: theme.space[3],
              fontSize: theme.font.size.base,
            }}
          />
          <View style={{ marginTop: theme.space[2] }}>
            <T variant="small" tone="faint">
              {tooShort
                ? t('search.hint')
                : hits.length === 1
                  ? t('search.resultsOne')
                  : hits.length > 0
                    ? t('search.results', { count: hits.length })
                    : ' '}
            </T>
          </View>
        </View>
        <Divider />

        {hits.length === 0 && deferred.trim().length >= 2 ? (
          <View style={{ padding: theme.space[5] }}>
            <T tone="muted">{t('search.empty')}</T>
          </View>
        ) : (
          <FlatList
            data={hits}
            keyExtractor={(hit) => String(hit.tokenIndex)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <Hit hit={item} onPress={() => onSelect(item.tokenIndex)} />}
            ItemSeparatorComponent={Divider}
            contentContainerStyle={{ paddingBottom: insets.bottom + theme.space[6] }}
          />
        )}
      </View>
    </Modal>
  );
}

/** One result: the surrounding sentence with the match itself picked out. */
function Hit({ hit, onPress }: { hit: SearchHit; onPress: () => void }) {
  const theme = useTheme();
  const before = hit.preview.slice(0, hit.previewOffset);
  const match = hit.preview.slice(hit.previewOffset, hit.previewOffset + hit.matchLength);
  const after = hit.preview.slice(hit.previewOffset + hit.matchLength);

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: theme.colors.surfaceHover }}
      style={({ pressed }) => ({
        paddingHorizontal: theme.space[4],
        paddingVertical: theme.space[3],
        backgroundColor: pressed ? theme.colors.surfaceHover : 'transparent',
        gap: 2,
      })}
    >
      <T variant="small" tone="faint">
        {t('search.chapter', { index: hit.chapterIndex + 1 })}
      </T>
      <T numberOfLines={3}>
        {before}
        <T style={{ color: theme.accent.base, fontWeight: '700' }}>{match}</T>
        {after}
      </T>
    </Pressable>
  );
}
