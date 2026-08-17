/**
 * The bar that appears once a passage is selected in page mode.
 *
 * Selection in a scrolling text is fiddly on a phone, so it is deliberately blunt: long
 * press starts it on one word, tapping another word extends to there. No drag handles,
 * nothing to grab and miss.
 */
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { HIGHLIGHT_COLORS, type Annotation, type HighlightColor } from '@lexipulse/core';

import { Button, Divider, IconButton, T } from '../components/ui';
import { t } from '../i18n';
import { useTheme } from '../state/settings';

/** Fixed swatches: readable on every theme, and distinguishable from the accent. */
export const HIGHLIGHT_TINTS: Record<HighlightColor, string> = {
  yellow: '#FFD54A',
  green: '#79D27A',
  blue: '#6FB6FF',
  pink: '#FF8FB8',
  purple: '#BFA0FF',
};

export function HighlightBar({
  selection,
  existing,
  onColor,
  onNote,
  onRemove,
  onCancel,
  onOverview,
}: {
  /** Token range currently selected, or null when an existing highlight is tapped. */
  selection: { start: number; end: number } | null;
  existing: Annotation | null;
  onColor: (color: HighlightColor) => void;
  onNote: (note: string) => void;
  onRemove: () => void;
  onCancel: () => void;
  /** Opens the word overview for whatever is selected. */
  onOverview: () => void;
}) {
  const theme = useTheme();
  const [note, setNote] = useState(existing?.note ?? '');
  const [editing, setEditing] = useState(false);

  return (
    <View
      style={{
        borderTopWidth: theme.hairline,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        paddingHorizontal: theme.space[4],
        paddingTop: theme.space[3],
        paddingBottom: theme.space[4],
        gap: theme.space[3],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
        <View style={{ flex: 1 }}>
          <T variant="small" tone="faint" numberOfLines={1}>
            {existing ? t('highlight.title') : t('highlight.selectHint')}
          </T>
        </View>
        {existing ? (
          <IconButton icon="trash-outline" label={t('highlight.remove')} onPress={onRemove} />
        ) : null}
        <IconButton icon="close" label={t('common.close')} onPress={onCancel} />
      </View>

      <View style={{ flexDirection: 'row', gap: theme.space[3], alignItems: 'center' }}>
        {HIGHLIGHT_COLORS.map((color) => {
          const chosen = existing?.color === color;
          return (
            <Pressable
              key={color}
              onPress={() => onColor(color)}
              accessibilityRole="button"
              accessibilityLabel={t(`highlight.color.${color}`)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: HIGHLIGHT_TINTS[color],
                borderWidth: chosen ? 3 : theme.hairline,
                borderColor: chosen ? theme.colors.text : theme.colors.border,
              }}
            />
          );
        })}
      </View>

      {/* The way into the word overview. It lives with the selection because that is the
          moment the reader has already said which word they mean; a tap in the text still
          means "read on from here". */}
      <Button
        label={t('lookup.open')}
        icon="search-outline"
        variant="secondary"
        onPress={onOverview}
      />

      {existing ? (
        <>
          <Divider />
          {editing ? (
            <View style={{ gap: theme.space[2] }}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={t('highlight.note.placeholder')}
                placeholderTextColor={theme.colors.textFaint}
                multiline
                autoFocus
                style={{
                  minHeight: 72,
                  borderWidth: theme.hairline,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.bg,
                  color: theme.colors.text,
                  padding: theme.space[3],
                  fontSize: theme.font.size.base,
                  textAlignVertical: 'top',
                }}
              />
              <Pressable
                onPress={() => {
                  onNote(note.trim());
                  setEditing(false);
                }}
                accessibilityRole="button"
                style={{ alignSelf: 'flex-end', padding: theme.space[2] }}
              >
                <T style={{ color: theme.accent.base, fontWeight: '600' }}>
                  {t('highlight.note.save')}
                </T>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditing(true)} accessibilityRole="button">
              <T tone={existing.note ? 'default' : 'faint'} numberOfLines={3}>
                {existing.note ?? t('highlight.note.placeholder')}
              </T>
            </Pressable>
          )}
        </>
      ) : null}

      {selection ? (
        <T variant="small" tone="faint">
          {t('highlight.add')}
        </T>
      ) : null}
    </View>
  );
}
