/**
 * Every highlight of the open document in one list.
 *
 * Marking a passage is only half the feature — the other half is finding it again weeks
 * later. The sheet mirrors the search sheet on purpose: same modal, same header, same
 * row rhythm, so the two ways of jumping around a book feel like one mechanism.
 */
import { FlatList, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Annotation } from '@lexipulse/core';

import { Divider, IconButton, T } from '../components/ui';
import { t } from '../i18n';
import { useTheme } from '../state/settings';

import { HIGHLIGHT_TINTS } from './highlight-bar';

export function HighlightsSheet({
  visible,
  annotations,
  onClose,
  onSelect,
  onRemove,
}: {
  visible: boolean;
  annotations: readonly Annotation[];
  onClose: () => void;
  onSelect: (tokenIndex: number) => void;
  onRemove: (id: string) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
            <T variant="title">{t('highlight.title')}</T>
          </View>
          <IconButton icon="close" label={t('common.close')} onPress={onClose} />
        </View>
        <Divider />

        {annotations.length === 0 ? (
          <View style={{ padding: theme.space[5] }}>
            <T tone="muted">{t('highlight.empty')}</T>
          </View>
        ) : (
          <FlatList
            data={annotations}
            keyExtractor={(annotation) => annotation.id}
            renderItem={({ item }) => (
              <Entry
                annotation={item}
                onPress={() => onSelect(item.startToken)}
                onRemove={() => onRemove(item.id)}
              />
            )}
            ItemSeparatorComponent={Divider}
            contentContainerStyle={{ paddingBottom: insets.bottom + theme.space[6] }}
          />
        )}
      </View>
    </Modal>
  );
}

/** One highlight: its colour, the passage, an optional note, and where it sits. */
function Entry({
  annotation,
  onPress,
  onRemove,
}: {
  annotation: Annotation;
  onPress: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: theme.colors.surfaceHover }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.space[3],
        paddingHorizontal: theme.space[4],
        paddingVertical: theme.space[3],
        backgroundColor: pressed ? theme.colors.surfaceHover : 'transparent',
      })}
    >
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          marginTop: 5,
          backgroundColor: HIGHLIGHT_TINTS[annotation.color],
          borderWidth: theme.hairline,
          borderColor: theme.colors.border,
        }}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <T numberOfLines={3}>{annotation.text}</T>
        {annotation.note ? (
          <T variant="small" tone="muted" numberOfLines={2}>
            {t('highlight.note')}: {annotation.note}
          </T>
        ) : null}
        <T variant="small" tone="faint">
          {t('search.chapter', { index: annotation.chapterIndex + 1 })}
        </T>
      </View>
      <IconButton icon="trash-outline" label={t('highlight.remove')} onPress={onRemove} />
    </Pressable>
  );
}
