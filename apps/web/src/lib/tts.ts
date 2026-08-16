'use client';

import * as React from 'react';

/**
 * Text-to-speech through the Web Speech API.
 *
 * The synthesiser belongs to the browser and the operating system — nothing is sent to
 * us, and no third-party voice service is involved. Whether the OS computes the voice
 * locally is outside our control, which is exactly what the privacy policy states.
 */

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function languageRank(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.toLowerCase();
  if (lang.startsWith('de')) return 0;
  if (lang.startsWith('en')) return 1;
  return 2;
}

/** German voices first — the interface and most imported material are German. */
export function sortVoices(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return [...voices].sort(
    (a, b) => languageRank(a) - languageRank(b) || a.name.localeCompare(b.name, 'de'),
  );
}

/**
 * The voice list.
 *
 * Chrome populates it asynchronously and fires `voiceschanged` afterwards, so a single
 * `getVoices()` call on mount returns an empty array often enough to look like a bug.
 */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);

  React.useEffect(() => {
    if (!speechSupported()) return;
    const read = () => setVoices(sortVoices(window.speechSynthesis.getVoices()));
    read();
    window.speechSynthesis.addEventListener('voiceschanged', read);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', read);
  }, []);

  return voices;
}

/** Utterance rate that roughly tracks the reading speed. 1.0 is about 175 words a minute. */
export function rateForWpm(wpm: number): number {
  return Math.min(Math.max(wpm / 175, 0.5), 4);
}

export interface SpeakOptions {
  voiceUri: string | null;
  wpm: number;
}

export function speak(text: string, { voiceUri, wpm }: SpeakOptions): void {
  if (!speechSupported() || text.trim().length === 0) return;
  const synth = window.speechSynthesis;
  // Always cancel first: queued utterances would run minutes behind the stream.
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rateForWpm(wpm);
  utterance.lang = 'de-DE';

  if (voiceUri) {
    const voice = synth.getVoices().find((candidate) => candidate.voiceURI === voiceUri);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
  }

  synth.speak(utterance);
}

export function cancelSpeech(): void {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
}
