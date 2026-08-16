'use client';

/**
 * The sentence-end click.
 *
 * Synthesised with a single oscillator instead of an audio file: no request, no decode,
 * and a 12 ms envelope that cannot be mistaken for a notification sound. The context is
 * created lazily on the first click, because browsers refuse to start one before a user
 * gesture anyway.
 */
let context: AudioContext | null = null;

type AudioContextConstructor = typeof AudioContext;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (context) return context;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    return null;
  }
  return context;
}

export function playTick(): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(1180, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.05, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.02);
}
