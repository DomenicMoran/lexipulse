/**
 * Back up, hand over, read back in.
 *
 * The app has always been able to write a JSON file and never been able to read one, which
 * made the "backup" a copy nobody could restore. These rows close that circle, and they do
 * it with the two modes the store offers rather than one silent behaviour: merging is the
 * safe default for two devices used side by side, replacing is for a fresh device where
 * the whole point is to overwrite what is there.
 *
 * Everything the user is told comes out of the store: `inspectBackup` before the import so
 * the choice is informed, and `ImportResult` after it so the report states what happened
 * instead of claiming success.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import { Modal, Platform, ScrollView, View } from 'react-native';

import {
  SCHEMA_VERSION,
  inspectBackup,
  type BackupSummary,
  type ImportMode,
  type ImportResult,
} from '@lexipulse/core';

import { formatDate, formatNumber, t, type MessageKey } from '../i18n';
import { store } from '../lib/store';
import { useLibrary } from '../state/library';
import { useReader } from '../state/reader';
import { useSettings, useTheme } from '../state/settings';
import { useAlert } from './alert';
import { Button, Divider, Row, T } from './ui';

/**
 * What the picker offers for a backup.
 *
 * `application/octet-stream` has to be in the list: several Android providers report an
 * unknown type for a `.json` file, and without it the file the user is looking for is
 * greyed out and cannot be selected at all.
 */
const BACKUP_MIME = ['application/json', 'text/plain', 'application/octet-stream'];

/** Dated so several backups can live in the same folder without overwriting each other. */
function backupBaseName(): string {
  return `lexipulse-backup-${new Date().toISOString().slice(0, 10)}`;
}

/**
 * The report lines, in the order they are shown.
 *
 * Singular and plural are separate messages rather than a rule: German and English disagree
 * on where the boundary sits often enough that a generic rule would be wrong in one of them.
 */
const REPORT_LINES = [
  {
    field: 'documentsAdded',
    one: 'backup.report.documentsAdded.one',
    other: 'backup.report.documentsAdded.other',
  },
  {
    field: 'documentsMatched',
    one: 'backup.report.documentsMatched.one',
    other: 'backup.report.documentsMatched.other',
  },
  {
    field: 'annotationsAdded',
    one: 'backup.report.annotationsAdded.one',
    other: 'backup.report.annotationsAdded.other',
  },
  {
    field: 'bookmarksAdded',
    one: 'backup.report.bookmarksAdded.one',
    other: 'backup.report.bookmarksAdded.other',
  },
  {
    field: 'tagsUpdated',
    one: 'backup.report.tagsUpdated.one',
    other: 'backup.report.tagsUpdated.other',
  },
  {
    field: 'progressUpdated',
    one: 'backup.report.progressUpdated.one',
    other: 'backup.report.progressUpdated.other',
  },
  {
    field: 'progressKept',
    one: 'backup.report.progressKept.one',
    other: 'backup.report.progressKept.other',
  },
] as const satisfies readonly { field: keyof ImportResult; one: MessageKey; other: MessageKey }[];

/** The numbers the store reported, one line each. Zero counts are left out. */
function reportBody(result: ImportResult): string {
  const lines: string[] = [];
  for (const line of REPORT_LINES) {
    const count = result[line.field];
    if (typeof count !== 'number' || count === 0) continue;
    lines.push(t(count === 1 ? line.one : line.other, { count: formatNumber(count) }));
  }
  if (lines.length === 0) return t('backup.report.nothing');
  return lines.join('\n');
}

interface Pending {
  json: string;
  summary: BackupSummary;
}

/**
 * The rows of the "back up and transfer" section.
 *
 * One component rather than three so the dividers between the rows stay correct when the
 * Android-only folder row is absent.
 */
export function BackupRows() {
  const alert = useAlert();
  const { refresh } = useLibrary();
  const { discard } = useReader();
  const { replace: replaceSettings } = useSettings();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  // ------------------------------------------------------------------------ writing

  const onShare = useCallback(() => {
    setBusy(true);
    void (async () => {
      try {
        const json = await store.exportAll();
        const file = new FileSystem.File(FileSystem.Paths.cache, `${backupBaseName()}.json`);
        if (file.exists) file.delete();
        file.create();
        file.write(json);

        if (!(await Sharing.isAvailableAsync())) {
          alert(t('backup.failed'), t('backup.share.unavailable'));
          return;
        }
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: t('backup.create'),
          UTI: 'public.json',
        });
      } catch (error) {
        alert(t('backup.failed'), String(error));
      } finally {
        setBusy(false);
      }
    })();
  }, [alert]);

  /**
   * Android only: write straight into a folder the user picks.
   *
   * iOS needs nothing here, its share sheet already offers "Save to Files". Android's does
   * not reliably, so without this the only way out of the app is a messenger.
   */
  const onSaveToFolder = useCallback(() => {
    setBusy(true);
    void (async () => {
      try {
        const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
        // Declining is an answer, not a failure. Saying nothing is the correct response.
        if (!permission.granted) return;

        const json = await store.exportAll();
        const name = backupBaseName();
        // SAF appends the extension belonging to the MIME type, so the name goes in bare;
        // passing "…json" here would produce "….json.json".
        const uri = await StorageAccessFramework.createFileAsync(
          permission.directoryUri,
          name,
          'application/json',
        );
        await StorageAccessFramework.writeAsStringAsync(uri, json);
        alert(t('backup.folder.done'), t('backup.folder.doneBody', { name: `${name}.json` }));
      } catch (error) {
        alert(t('backup.failed'), String(error));
      } finally {
        setBusy(false);
      }
    })();
  }, [alert]);

  // ------------------------------------------------------------------------ reading

  const onPick = useCallback(() => {
    setBusy(true);
    void (async () => {
      try {
        const picked = await DocumentPicker.getDocumentAsync({
          type: BACKUP_MIME,
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (picked.canceled) return;
        const asset = picked.assets[0];
        if (!asset) return;

        const json = await new FileSystem.File(asset.uri).text();
        const summary = inspectBackup(json, SCHEMA_VERSION);
        if (summary === 'unreadable') {
          alert(t('backup.restore.unreadable.title'), t('backup.restore.unreadable.body'));
          return;
        }
        if (summary === 'too-new') {
          alert(t('backup.restore.tooNew.title'), t('backup.restore.tooNew.body'));
          return;
        }
        setPending({ json, summary });
      } catch (error) {
        // Anything that cannot even be read as text ends here: a provider URI that went
        // stale, a file the app has no access to. From the reader's side that is the same
        // mistake as picking the wrong file, so it gets the same answer.
        console.warn('[LexiPulse] could not read backup file', error);
        alert(t('backup.restore.unreadable.title'), t('backup.restore.unreadable.body'));
      } finally {
        setBusy(false);
      }
    })();
  }, [alert]);

  const runImport = useCallback(
    (json: string, mode: ImportMode) => {
      setBusy(true);
      void (async () => {
        try {
          const result = await store.importAll(json, { mode });
          /*
           * The player still holds the token stream and the position from before the
           * import. Its next save would write that stale position back over what was just
           * restored, and after a replace the open document may not exist any more.
           * `discard` tears it down without writing, which is exactly what is wanted.
           */
          discard();
          await refresh();
          // Only a replace brings settings along; the in-memory copy has to be told, or
          // the next debounced write would put the old theme back.
          if (mode === 'replace') replaceSettings(await store.getSettings());
          alert(
            t(mode === 'replace' ? 'backup.report.replace' : 'backup.report.merge'),
            reportBody(result),
          );
        } catch (error) {
          alert(t('backup.restore.failed'), String(error));
        } finally {
          setBusy(false);
        }
      })();
    },
    [alert, discard, refresh, replaceSettings],
  );

  const onMerge = useCallback(() => {
    const current = pending;
    if (!current) return;
    setPending(null);
    runImport(current.json, 'merge');
  }, [pending, runImport]);

  /** Replacing throws data away, so it asks once more with the consequence spelled out. */
  const onReplace = useCallback(() => {
    const current = pending;
    if (!current) return;
    // The preview closes first: two native modals on screen at once is a coin toss on
    // Android, and the question needs no picture behind it.
    setPending(null);
    alert(t('backup.replace.confirm.title'), t('backup.replace.confirm.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('backup.mode.replace'),
        style: 'destructive',
        onPress: () => runImport(current.json, 'replace'),
      },
    ]);
  }, [alert, pending, runImport]);

  return (
    <>
      <Row
        label={t('backup.create')}
        hint={t('backup.create.hint')}
        icon="download-outline"
        onPress={busy ? undefined : onShare}
      />
      {Platform.OS === 'android' ? (
        <>
          <Divider />
          <Row
            label={t('backup.folder')}
            hint={t('backup.folder.hint')}
            icon="folder-open-outline"
            onPress={busy ? undefined : onSaveToFolder}
          />
        </>
      ) : null}
      <Divider />
      <Row
        label={t('backup.restore')}
        hint={t('backup.restore.hint')}
        icon="push-outline"
        onPress={busy ? undefined : onPick}
      />
      {pending ? (
        <BackupPreview
          summary={pending.summary}
          onCancel={() => setPending(null)}
          onMerge={onMerge}
          onReplace={onReplace}
        />
      ) : null}
    </>
  );
}

/**
 * What the file holds, before anything is written.
 *
 * Counts and a few titles, because a number alone does not tell anyone whether this is the
 * right file; seeing a book they recognise does. The mode is chosen here rather than
 * afterwards, so the reader picks with the contents in front of them.
 */
function BackupPreview({
  summary,
  onCancel,
  onMerge,
  onReplace,
}: {
  summary: BackupSummary;
  onCancel: () => void;
  onMerge: () => void;
  onReplace: () => void;
}) {
  const theme = useTheme();
  const exportedAt = summary.exportedAt ? Date.parse(summary.exportedAt) : Number.NaN;

  const counts: { label: string; value: number }[] = [
    { label: t('backup.preview.documents'), value: summary.documents },
    { label: t('backup.preview.annotations'), value: summary.annotations },
    { label: t('backup.preview.bookmarks'), value: summary.bookmarks },
    { label: t('backup.preview.tags'), value: summary.tags },
  ];

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
          <ScrollView contentContainerStyle={{ padding: theme.space[5], gap: theme.space[4] }}>
            <View style={{ gap: theme.space[1] }}>
              <T variant="title">{t('backup.preview.title')}</T>
              <T variant="small" tone="muted">
                {Number.isFinite(exportedAt)
                  ? t('backup.preview.exportedAt', { date: formatDate(exportedAt) })
                  : t('backup.preview.exportedAt.unknown')}
              </T>
            </View>

            <View style={{ gap: theme.space[2] }}>
              {counts.map((count) => (
                <View
                  key={count.label}
                  style={{ flexDirection: 'row', justifyContent: 'space-between' }}
                >
                  <T tone="muted">{count.label}</T>
                  <T variant="mono">{formatNumber(count.value)}</T>
                </View>
              ))}
              {summary.hasSettings || summary.hasStats ? (
                <T variant="small" tone="faint">
                  {t('backup.preview.extras')}
                </T>
              ) : null}
            </View>

            {summary.sampleTitles.length > 0 ? (
              <View style={{ gap: theme.space[1] }}>
                <T variant="label" tone="faint">
                  {t('backup.preview.titles')}
                </T>
                {summary.sampleTitles.map((title) => (
                  <T key={title} variant="small" tone="muted" numberOfLines={1}>
                    {title}
                  </T>
                ))}
              </View>
            ) : null}

            <Divider />

            <View style={{ gap: theme.space[2] }}>
              <Button label={t('backup.mode.merge')} onPress={onMerge} icon="git-merge-outline" />
              <T variant="small" tone="faint">
                {t('backup.mode.merge.hint')}
              </T>
              <Button
                label={t('backup.mode.replace')}
                onPress={onReplace}
                variant="secondary"
                icon="swap-horizontal-outline"
                style={{ marginTop: theme.space[2] }}
              />
              <T variant="small" tone="faint">
                {t('backup.mode.replace.hint')}
              </T>
            </View>
          </ScrollView>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              paddingHorizontal: theme.space[4],
              paddingBottom: theme.space[4],
            }}
          >
            <Button label={t('common.cancel')} onPress={onCancel} variant="ghost" />
          </View>
        </View>
      </View>
    </Modal>
  );
}
