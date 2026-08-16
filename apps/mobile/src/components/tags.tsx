/**
 * Tags: the shelves a reader sorts the library onto.
 *
 * Two pieces, because the library needs them in two places — a row of chips that filters
 * the list, and a sheet that edits one document's tags. Both share the same chip so a tag
 * looks the same wherever it appears.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { fold, normalizeTags } from '@lexipulse/core';

import { t } from '../i18n';
import { useTheme } from '../state/settings';
import { Button, T } from './ui';

export function TagChip({
  label,
  selected,
  onPress,
  removable,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /**
   * Draws the remove affordance. The whole chip stays the touch target rather than the
   * small cross — a nested pressable inside a pressable is a coin toss on Android.
   */
  removable?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={onPress ? { selected: selected === true } : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[2],
        minHeight: 38,
        paddingHorizontal: theme.space[3],
        borderRadius: theme.radius.full,
        borderWidth: theme.hairline,
        borderColor: selected ? theme.accent.base : theme.colors.border,
        backgroundColor: selected
          ? theme.accent.soft
          : pressed && onPress
            ? theme.colors.surfaceHover
            : theme.colors.surface,
      })}
    >
      <T variant="small" tone={selected ? 'accent' : 'muted'}>
        {label}
      </T>
      {removable ? (
        <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

/**
 * The filter row above the list.
 *
 * Horizontal rather than wrapping: a reader with a dozen shelves would otherwise push the
 * first book off the screen before the list even starts.
 */
export function TagFilterBar({
  tags,
  active,
  onToggle,
}: {
  tags: string[];
  /** Folded form of the selected tag, or null. */
  active: string | null;
  onToggle: (tag: string) => void;
}) {
  const theme = useTheme();
  if (tags.length === 0) return null;

  return (
    <View style={{ gap: theme.space[2] }}>
      <T variant="label" tone="faint">
        {t('library.tags')}
      </T>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.space[2], paddingRight: theme.space[4] }}
      >
        {tags.map((tag) => (
          <TagChip
            key={tag}
            label={tag}
            selected={active === fold(tag)}
            onPress={() => onToggle(tag)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Edit one document's tags.
 *
 * Mounted only while open, so the draft starts from the stored list without an effect
 * copying props into state. Nothing is written until the reader saves — a sheet that
 * persists every keystroke cannot be cancelled.
 */
export function TagEditor({
  documentTitle,
  tags,
  suggestions,
  onCancel,
  onSave,
}: {
  documentTitle: string;
  tags: string[];
  /** Tags used on other documents, offered as one-tap additions. */
  suggestions: string[];
  onCancel: () => void;
  onSave: (next: string[]) => void;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState<string[]>(tags);
  const [input, setInput] = useState('');

  const add = (raw: string) => {
    const next = normalizeTags([...draft, raw]);
    setDraft(next);
    setInput('');
  };

  const unused = suggestions.filter(
    (tag) => !draft.some((existing) => fold(existing) === fold(tag)),
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
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
            maxHeight: '85%',
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.lg,
            borderWidth: theme.hairline,
            borderColor: theme.colors.border,
            overflow: 'hidden',
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: theme.space[5], gap: theme.space[4] }}
          >
            <View style={{ gap: theme.space[1] }}>
              <T variant="title">{t('library.tags.edit')}</T>
              <T variant="small" tone="muted" numberOfLines={2}>
                {documentTitle}
              </T>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
              <View
                style={{
                  flex: 1,
                  paddingHorizontal: theme.space[3],
                  borderRadius: theme.radius.md,
                  borderWidth: theme.hairline,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.bg,
                }}
              >
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={() => add(input)}
                  placeholder={t('library.tags.placeholder')}
                  placeholderTextColor={theme.colors.textFaint}
                  autoCapitalize="sentences"
                  autoCorrect={false}
                  returnKeyType="done"
                  maxLength={32}
                  style={{
                    minHeight: 44,
                    paddingVertical: 0,
                    color: theme.colors.text,
                    fontSize: theme.font.size.base,
                  }}
                />
              </View>
              <Button
                label={t('library.tags.add')}
                onPress={() => add(input)}
                variant="secondary"
                disabled={input.trim().length === 0}
              />
            </View>

            {draft.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
                {draft.map((tag) => (
                  <TagChip
                    key={tag}
                    label={tag}
                    selected
                    removable
                    accessibilityLabel={t('library.tags.remove', { tag })}
                    onPress={() => setDraft(draft.filter((existing) => existing !== tag))}
                  />
                ))}
              </View>
            ) : (
              <T variant="small" tone="faint">
                {t('library.tags.empty')}
              </T>
            )}

            {unused.length > 0 ? (
              <View style={{ gap: theme.space[2] }}>
                <T variant="label" tone="faint">
                  {t('library.tags.suggestions')}
                </T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
                  {unused.map((tag) => (
                    <TagChip key={tag} label={tag} onPress={() => add(tag)} />
                  ))}
                </View>
              </View>
            ) : null}
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
            <Button label={t('common.cancel')} onPress={onCancel} variant="ghost" />
            <Button label={t('library.tags.save')} onPress={() => onSave(draft)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
