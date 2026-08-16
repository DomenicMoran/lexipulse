import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Speech from 'expo-speech';
import { useEffect, useRef } from 'react';

import { sentenceTextAt, type EngineEvent, type RsvpSettings } from '@lexipulse/core';

import { useReader } from '../state/reader';

/**
 * Everything the player does besides drawing words: the sentence click, text-to-speech,
 * and holding the screen awake. All three hang off engine events rather than off React
 * state, so they fire at the moment the boundary is crossed rather than a render later.
 */

const KEEP_AWAKE_TAG = 'lexipulse-player';

/** A short click on every sentence boundary. */
export function useSentenceClick(enabled: boolean) {
  const { subscribe } = useReader();
  const player = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;

    void (async () => {
      // Play through the silent switch is deliberately NOT requested: someone who has
      // silenced their phone has silenced this too, which is the behaviour they expect.
      await setAudioModeAsync({
        playsInSilentMode: false,
        shouldPlayInBackground: false,
        // `mixWithOthers` requests no audio focus at all, so a 28 ms click cannot pause
        // whatever the user is listening to while they read.
        interruptionMode: 'mixWithOthers',
        // Explicit, because it is also the app's promise: the audio session never enters
        // a recording category.
        allowsRecording: false,
      }).catch(() => undefined);
      if (disposed) return;
      player.current = createAudioPlayer(
        require('../../assets/audio/click.wav') as number,
      );
      player.current.volume = 0.5;
    })();

    return () => {
      disposed = true;
      player.current?.remove();
      player.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    return subscribe((event: EngineEvent) => {
      if (event.type !== 'sentence') return;
      const sound = player.current;
      if (!sound) return;
      // A click that fails to play must never interrupt reading.
      void sound
        .seekTo(0)
        .then(() => sound.play())
        .catch(() => undefined);
    });
  }, [enabled, subscribe]);
}

/**
 * Speak each sentence as the stream enters it.
 *
 * The synthesiser is told the whole sentence rather than each word: word-by-word TTS is
 * unintelligible, and the sentence boundary is the only point where the two clocks can be
 * resynchronised without one of them stuttering.
 */
export function useSpeech(settings: RsvpSettings) {
  const { subscribe, tokens, snapshot } = useReader();
  const enabled = settings.ttsEnabled;
  const voice = settings.ttsVoice;
  const wpm = settings.wpm;

  // Read through refs: the effect must not be rebuilt on every word, or it would stop
  // and restart the synthesiser mid-sentence.
  //
  // The writes happen in an effect, not in the render body. Assigning to `ref.current`
  // while rendering is a rules-of-React violation: React may render a component twice or
  // throw the result away, and the ref would then hold a value from a render that never
  // reached the screen.
  const tokensRef = useRef(tokens);
  const indexRef = useRef(snapshot.index);
  useEffect(() => {
    tokensRef.current = tokens;
    indexRef.current = snapshot.index;
  }, [tokens, snapshot.index]);

  useEffect(() => {
    if (!enabled) {
      void Speech.stop();
      return;
    }

    const speakAt = (index: number) => {
      const text = sentenceTextAt(tokensRef.current, index);
      if (!text) return;
      void Speech.stop();
      Speech.speak(text, {
        // Ordinary speech runs around 175 WPM, so the ratio keeps the voice roughly in
        // step with the stream. Beyond 2x most engines become unintelligible anyway.
        rate: Math.min(Math.max(wpm / 175, 0.5), 2),
        pitch: 1,
        ...(voice ? { voice } : {}),
      });
    };

    const unsubscribe = subscribe((event: EngineEvent) => {
      if (event.type === 'sentence') speakAt(event.index);
      if (event.type === 'status') {
        // Pressing play mid-paragraph must speak the sentence the reader is actually in.
        // Waiting for the next boundary would leave the voice silent for a whole sentence.
        if (event.status === 'playing') speakAt(indexRef.current);
        else void Speech.stop();
      }
    });

    return () => {
      unsubscribe();
      void Speech.stop();
    };
  }, [enabled, subscribe, voice, wpm]);

  useEffect(
    () => () => {
      void Speech.stop();
    },
    [],
  );
}

/** Hold the screen on while words are moving — but only then, and only if asked. */
export function useKeepAwakeWhilePlaying(enabled: boolean, playing: boolean) {
  useEffect(() => {
    if (!enabled || !playing) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      // Already released — deactivating twice is not an error worth surfacing.
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [enabled, playing]);
}
