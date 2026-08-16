import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fold, formatDuration, type LexiDocument, type LibraryEntry } from '@lexipulse/core';

import { SwipeToDelete } from '../../src/components/swipe';
import { TagEditor, TagFilterBar } from '../../src/components/tags';
import {
  Button,
  EmptyState,
  IconButton,
  ProgressBar,
  Screen,
  ScreenTitle,
  T,
} from '../../src/components/ui';
import { useAlert } from '../../src/components/alert';
import { formatNumber, t, type MessageKey } from '../../src/i18n';
import { initStore, store } from '../../src/lib/store';
import { useLibrary } from '../../src/state/library';
import { useReader } from '../../src/state/reader';
import { useSettings, useTheme } from '../../src/state/settings';

type SortKey = 'recent' | 'title' | 'added' | 'progress';
type FilterKey = 'all' | 'reading' | 'unread' | 'finished';
type EntryStatus = Exclude<FilterKey, 'all'>;

/**
 * The same threshold the card uses for its "Finished" label. Sharing one number is the
 * point: a document that reads as finished in the list must also survive the "finished"
 * filter, and a card whose bar sits at 99.95 % would otherwise fall through both.
 */
const FINISHED = 0.999;

function statusOf(entry: LibraryEntry): EntryStatus {
  const percent = entry.progress?.percent ?? 0;
  if (percent >= FINISHED) return 'finished';
  return percent > 0 ? 'reading' : 'unread';
}

/** When the document was last in front of the reader, with import as the fallback. */
function lastOpened(entry: LibraryEntry): number {
  return entry.progress?.updatedAt ?? entry.document.createdAt;
}

const COMPARATORS: Record<SortKey, (a: LibraryEntry, b: LibraryEntry) => number> = {
  recent: (a, b) => lastOpened(b) - lastOpened(a),
  // Folded before comparing so "Über" files under U instead of after Z, which is where a
  // raw code-unit comparison puts every umlaut.
  title: (a, b) => fold(a.document.title).localeCompare(fold(b.document.title)),
  added: (a, b) => b.document.createdAt - a.document.createdAt,
  progress: (a, b) => (b.progress?.percent ?? 0) - (a.progress?.percent ?? 0),
};

export default function LibraryScreen() {
  const alert = useAlert();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { entries, loading, refresh, remove } = useLibrary();
  const { open, discard, document: openDocument } = useReader();

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [controlsOpen, setControlsOpen] = useState(false);
  const [tags, setTags] = useState<Record<string, string[]>>({});
  /** Folded, because that is what the chip and the entry are compared in. */
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<LexiDocument | null>(null);

  /**
   * Tags live beside the documents rather than inside them, so the library state does not
   * carry them; one indexed read per visit is cheaper than widening every entry.
   */
  const loadTags = useCallback(async () => {
    try {
      await initStore();
      setTags(await store.tagIndex());
    } catch (error) {
      // Same reasoning as in the library provider: a database that will not answer must
      // not take the whole screen down with it.
      console.error('[LexiPulse] could not read the tags', error);
    }
  }, []);

  /** Every tag in the library; the first spelling encountered names the shelf. */
  const allTags = useMemo(() => {
    const bySpelling = new Map<string, string>();
    for (const list of Object.values(tags)) {
      for (const tag of list) if (!bySpelling.has(fold(tag))) bySpelling.set(fold(tag), tag);
    }
    return [...bySpelling.values()].sort((a, b) => fold(a).localeCompare(fold(b)));
  }, [tags]);

  // Derived instead of corrected in an effect: removing the last document of a shelf makes
  // its chip disappear, and a selection still pointing at it would hide the whole library
  // with no visible filter to switch off.
  const activeTag =
    selectedTag !== null && allTags.some((tag) => fold(tag) === selectedTag) ? selectedTag : null;

  /**
   * Derived, never stored: a second copy of the library would drift the moment the focus
   * refresh below writes new progress, and the list would show yesterday's order.
   */
  const visible = useMemo(() => {
    const needle = fold(query.trim());
    const matched = entries.filter((entry) => {
      if (filter !== 'all' && statusOf(entry) !== filter) return false;
      const entryTags = tags[entry.document.id] ?? [];
      if (activeTag !== null && !entryTags.some((tag) => fold(tag) === activeTag)) return false;
      if (!needle) return true;
      const { title, author } = entry.document;
      return (
        fold(title).includes(needle) ||
        (author !== null && fold(author).includes(needle)) ||
        entryTags.some((tag) => fold(tag).includes(needle))
      );
    });
    // `filter` already returned a fresh array, so sorting in place leaves `entries` alone.
    return matched.sort(COMPARATORS[sort]);
  }, [activeTag, entries, filter, query, sort, tags]);

  /**
   * Reading progress is written while the player runs, and the list holds the copy it
   * loaded when the app started. Without this, finishing a document and walking back to
   * the library showed it as "Not started" until the next cold start — the list quietly
   * contradicting the player.
   */
  useFocusEffect(
    useCallback(() => {
      void refresh();
      void loadTags();
    }, [loadTags, refresh]),
  );

  const onSaveTags = useCallback(
    async (documentId: string, next: string[]) => {
      await store.setTags(documentId, next);
      setEditing(null);
      await loadTags();
    },
    [loadTags],
  );

  const onOpen = useCallback(
    async (documentId: string) => {
      await open(documentId);
      router.navigate('/read');
    },
    [open, router],
  );

  const onDelete = useCallback(
    (entry: LibraryEntry) => {
      alert(
        t('library.deleteConfirm.title', { title: entry.document.title }),
        t('library.deleteConfirm.body'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: () => {
              // The player would otherwise keep streaming a document that no longer
              // exists, and its next progress save would resurrect the row.
              if (openDocument?.id === entry.document.id) discard();
              // The store drops the document's tags with it, so the screen's copy of the
              // index has to follow — otherwise the filter row keeps offering a shelf
              // that nothing stands on.
              void remove(entry.document.id).then(loadTags);
            },
          },
        ],
      );
    },
    [alert, discard, loadTags, openDocument, remove],
  );

  if (!loading && entries.length === 0) {
    return (
      <Screen contentStyle={{ paddingTop: insets.top + theme.space[4] }}>
        <ScreenTitle>{t('library.title')}</ScreenTitle>
        <EmptyState
          icon="book-outline"
          title={t('library.empty.title')}
          body={t('library.empty.body')}
          action={
            <Button
              label={t('library.import')}
              icon="add"
              onPress={() => router.navigate('/import')}
            />
          }
        />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <FlatList
        data={visible}
        keyExtractor={(entry) => entry.document.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: theme.space[5],
          paddingTop: insets.top + theme.space[4],
          paddingBottom: theme.space[16],
          gap: theme.space[3],
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.space[2] }}>
            <ScreenTitle>{t('library.title')}</ScreenTitle>
            <Button
              label={t('library.import')}
              icon="add"
              variant="secondary"
              onPress={() => router.navigate('/import')}
            />
            <LibraryControls
              query={query}
              onQuery={setQuery}
              sort={sort}
              onSort={setSort}
              filter={filter}
              onFilter={setFilter}
              open={controlsOpen}
              onToggle={() => setControlsOpen((previous) => !previous)}
              tags={allTags}
              activeTag={activeTag}
              onTag={(tag) =>
                setSelectedTag((previous) => (previous === fold(tag) ? null : fold(tag)))
              }
            />
            <T variant="small" tone="faint" style={{ marginTop: theme.space[3] }}>
              {t('library.swipeHint')}
            </T>
          </View>
        }
        // Only reachable once something has been imported: with an empty library the
        // screen above already returned the import prompt, and while the first load runs
        // there is nothing to say yet.
        ListEmptyComponent={entries.length > 0 ? <NoMatches /> : null}
        renderItem={({ item }) => (
          <SwipeToDelete onDelete={() => onDelete(item)} label={t('library.delete')}>
            <LibraryCard
              entry={item}
              tags={tags[item.document.id] ?? []}
              onPress={() => void onOpen(item.document.id)}
              onLongPress={() => setEditing(item.document)}
            />
          </SwipeToDelete>
        )}
      />

      {editing ? (
        <TagEditor
          documentTitle={editing.title}
          tags={tags[editing.id] ?? []}
          suggestions={allTags}
          onCancel={() => setEditing(null)}
          onSave={(next) => void onSaveTags(editing.id, next)}
        />
      ) : null}
    </View>
  );
}

/**
 * Search, sort and filter in one row.
 *
 * Only the search field is permanently on screen; sorting and filtering live behind the
 * toggle, because a library of five books does not need two rows of chips shouting above
 * it. The toggle carries the accent while a non-default order or filter is active, so a
 * collapsed panel can never quietly shorten the list.
 */
function LibraryControls({
  query,
  onQuery,
  sort,
  onSort,
  filter,
  onFilter,
  open,
  onToggle,
  tags,
  activeTag,
  onTag,
}: {
  query: string;
  onQuery: (next: string) => void;
  sort: SortKey;
  onSort: (next: SortKey) => void;
  filter: FilterKey;
  onFilter: (next: FilterKey) => void;
  open: boolean;
  onToggle: () => void;
  tags: string[];
  activeTag: string | null;
  onTag: (tag: string) => void;
}) {
  const theme = useTheme();
  const tuned = sort !== 'recent' || filter !== 'all';

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: 'recent', label: t('library.sort.recent') },
    { value: 'title', label: t('library.sort.title') },
    { value: 'added', label: t('library.sort.added') },
    { value: 'progress', label: t('library.sort.progress') },
  ];
  const filterOptions: { value: FilterKey; label: string }[] = [
    { value: 'all', label: t('library.filter.all') },
    { value: 'reading', label: t('library.filter.reading') },
    { value: 'unread', label: t('library.filter.unread') },
    { value: 'finished', label: t('library.filter.finished') },
  ];

  return (
    <View style={{ marginTop: theme.space[3], gap: theme.space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[1] }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space[2],
            paddingLeft: theme.space[3],
            paddingRight: theme.space[2],
            borderRadius: theme.radius.md,
            borderWidth: theme.hairline,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}
        >
          <Ionicons name="search" size={16} color={theme.colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={onQuery}
            placeholder={t('library.search.placeholder')}
            placeholderTextColor={theme.colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="never"
            style={{
              flex: 1,
              minHeight: 44,
              paddingVertical: 0,
              color: theme.colors.text,
              fontSize: theme.font.size.base,
            }}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => onQuery('')}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={12}
            >
              <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <IconButton
          icon="options-outline"
          label={t('library.sort')}
          active={open || tuned}
          onPress={onToggle}
        />
      </View>

      {/* Outside the panel: tags only exist because the reader created them, so showing
          them costs no one anything, and a shelf you have to unfold twice is not a shelf. */}
      <TagFilterBar tags={tags} active={activeTag} onToggle={onTag} />

      {open ? (
        <View style={{ gap: theme.space[3] }}>
          <ChipRow label={t('library.sort')} options={sortOptions} value={sort} onChange={onSort} />
          <ChipRow
            label={t('library.filter')}
            options={filterOptions}
            value={filter}
            onChange={onFilter}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * A labelled row of choices that wraps instead of dividing the width evenly.
 *
 * `Segmented` was the obvious fit, but four German sort labels do not survive a quarter of
 * a phone's width — "Zuletzt geöffnet" hits the shrink floor and still clips. Chips take
 * the width their word needs and drop to a second line when they run out.
 */
function ChipRow<Value extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: Value; label: string }[];
  value: Value;
  onChange: (next: Value) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space[2] }}>
      <T variant="label" tone="faint">
        {label}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => ({
                minHeight: 38,
                justifyContent: 'center',
                paddingHorizontal: theme.space[3],
                borderRadius: theme.radius.full,
                borderWidth: theme.hairline,
                borderColor: selected ? theme.accent.base : theme.colors.border,
                backgroundColor: selected
                  ? theme.accent.soft
                  : pressed
                    ? theme.colors.surfaceHover
                    : theme.colors.surface,
              })}
            >
              <T variant="small" tone={selected ? 'accent' : 'muted'}>
                {option.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Distinct from the "nothing imported" state: here the books exist, the query hides them. */
function NoMatches() {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: theme.space[12], gap: theme.space[3] }}>
      <Ionicons name="search-outline" size={32} color={theme.colors.textFaint} />
      <T tone="muted" style={{ textAlign: 'center' }}>
        {t('library.empty.filtered')}
      </T>
    </View>
  );
}

function LibraryCard({
  entry,
  tags,
  onPress,
  onLongPress,
}: {
  entry: LibraryEntry;
  tags: string[];
  onPress: () => void;
  onLongPress: () => void;
}) {
  const theme = useTheme();
  const { settings } = useSettings();
  const { document, progress } = entry;

  const percent = progress?.percent ?? 0;
  // Remaining time is estimated from the words actually left, at the user's current
  // speed — a fixed 200 WPM figure would be wrong for everyone who changed the setting.
  const remainingWords = Math.max(0, document.totalTokens - (progress?.tokenIndex ?? 0));
  const remainingMs = (remainingWords / Math.max(settings.wpm, 1)) * 60_000;

  const sourceKey = `library.sourceLabel.${document.source}` as MessageKey;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityHint={t('library.tags.edit')}
      android_ripple={{ color: theme.colors.surfaceHover }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: theme.space[4],
        padding: theme.space[4],
        borderRadius: theme.radius.lg,
        borderWidth: theme.hairline,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.surfaceHover : theme.colors.surface,
      })}
    >
      <Cover uri={document.coverDataUrl} title={document.title} />

      <View style={{ flex: 1, gap: theme.space[2] }}>
        <T variant="title" numberOfLines={2}>
          {document.title}
        </T>
        {document.author ? (
          <T variant="small" tone="muted" numberOfLines={1}>
            {document.author}
          </T>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          <View
            style={{
              paddingHorizontal: theme.space[2],
              paddingVertical: 2,
              borderRadius: theme.radius.sm,
              backgroundColor: theme.accent.soft,
            }}
          >
            <T variant="small" tone="accent">
              {t(sourceKey)}
            </T>
          </View>
          <T variant="small" tone="faint">
            {t('library.words', { count: formatNumber(document.wordCount) })}
          </T>
        </View>

        {/* One line, not chips: the card already carries four rows, and the shelves are
            here to be recognised in passing, not tapped. */}
        {tags.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
            <Ionicons name="pricetags-outline" size={13} color={theme.colors.textFaint} />
            <T variant="small" tone="faint" numberOfLines={1} style={{ flex: 1 }}>
              {tags.join(' · ')}
            </T>
          </View>
        ) : null}

        <View style={{ gap: theme.space[1], marginTop: theme.space[1] }}>
          <ProgressBar percent={percent} />
          <T variant="small" tone="faint">
            {percent >= 0.999
              ? t('library.finished')
              : percent <= 0
                ? t('library.notStarted')
                : t('library.remaining', { time: formatDuration(remainingMs) })}
          </T>
        </View>
      </View>
    </Pressable>
  );
}

function Cover({ uri, title }: { uri: string | null; title: string }) {
  const theme = useTheme();
  const size = { width: 56, height: 78 };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ ...size, borderRadius: theme.radius.sm, backgroundColor: theme.colors.bg }}
        resizeMode="cover"
      />
    );
  }

  // No cover: the first letter on a tinted plate reads better in a list than a generic
  // placeholder icon repeated down the page.
  return (
    <View
      style={{
        ...size,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.bg,
        borderWidth: theme.hairline,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <T variant="mono" tone="accent" style={{ fontSize: 26 }}>
        {title.trim().charAt(0).toUpperCase() || '·'}
      </T>
    </View>
  );
}
