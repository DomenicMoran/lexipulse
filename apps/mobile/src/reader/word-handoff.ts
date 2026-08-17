/**
 * Handing a single word to the operating system, and nothing else.
 *
 * LexiPulse ships no dictionary and asks no server: the privacy policy names exactly one
 * feature that talks to a server, and a built-in lookup would make that sentence false.
 * The device already has dictionaries, translators and browsers installed, so the honest
 * move is to pass the word out and let the reader pick who answers it.
 *
 * Android has a purpose-built contract for this. `PROCESS_TEXT` is the intent behind the
 * "Translate" and "Search" entries in the system's own text selection toolbar, so every
 * dictionary worth having already registers for it, and the reader gets the app chooser
 * they know rather than one we picked for them. It is marked read-only because we do not
 * want the answer back; the word travels one way.
 *
 * iOS has no equivalent public API, so the share sheet does the same job: the same list
 * of apps, the same explicit tap, and nothing leaves the device until that tap happens.
 */
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Share } from 'react-native';

/** The system's own "another app should process this text" intent. */
const PROCESS_TEXT = 'android.intent.action.PROCESS_TEXT';
const EXTRA_PROCESS_TEXT = 'android.intent.extra.PROCESS_TEXT';
const EXTRA_READ_ONLY = 'android.intent.extra.PROCESS_TEXT_READONLY';

/**
 * `handed` means the word is with the other app now. `unavailable` means no app on this
 * device accepted it, which is a normal state on a bare device and not an error to report
 * as a crash.
 */
export type HandoffResult = 'handed' | 'unavailable';

export async function handOffWord(word: string): Promise<HandoffResult> {
  const text = word.trim();
  if (text.length === 0) return 'unavailable';

  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync(PROCESS_TEXT, {
        type: 'text/plain',
        extra: { [EXTRA_PROCESS_TEXT]: text, [EXTRA_READ_ONLY]: true },
      });
      return 'handed';
    } catch {
      // No installed app answers PROCESS_TEXT, or the chooser was killed. Either way the
      // word stayed here, and the caller says so rather than letting the rejection
      // surface as an unhandled promise.
      return 'unavailable';
    }
  }

  try {
    await Share.share({ message: text });
    // Dismissing the sheet is a decision, not a failure: the reader saw the list and
    // chose no one.
    return 'handed';
  } catch {
    return 'unavailable';
  }
}
