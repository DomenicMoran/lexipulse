/**
 * The daily reading goal.
 *
 * A number the reader sets and the statistics screen measures against. Kept here rather
 * than in the screen because both the app and the web version show it, and because a
 * goal that counts differently in two places is worse than no goal at all.
 *
 * Pure on purpose: it takes the daily tally the store already keeps and a timestamp, so
 * a test can ask what tomorrow looks like without waiting for tomorrow.
 */
import { dayKey } from './storage/store.js';

export interface GoalProgress {
  /** Words read on the day `now` falls in. */
  read: number;
  /** The goal itself, 0 when none is set. */
  goal: number;
  /** 0 to 1, clamped. 0 when no goal is set, so a progress ring stays empty. */
  ratio: number;
  /** True once the goal is reached, and it stays true for the rest of the day. */
  met: boolean;
  /** Words still to go, never negative. */
  remaining: number;
}

export function goalProgress(
  daily: Record<string, number>,
  goal: number,
  now = Date.now(),
): GoalProgress {
  const read = Math.max(0, daily[dayKey(now)] ?? 0);
  if (goal <= 0) {
    return { read, goal: 0, ratio: 0, met: false, remaining: 0 };
  }
  return {
    read,
    goal,
    // Clamped, because a ring drawn past full looks like a rendering fault rather than
    // an achievement.
    ratio: Math.min(1, read / goal),
    met: read >= goal,
    remaining: Math.max(0, goal - read),
  };
}

/**
 * Goals offered as presets, in words.
 *
 * Round numbers a reader can reason about: roughly two, six, fifteen and thirty minutes
 * at a middling pace. Anything finer would be a slider nobody moves twice.
 */
export const GOAL_PRESETS: readonly number[] = [0, 500, 2000, 5000, 10_000];
