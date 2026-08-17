import { describe, expect, it } from 'vitest';
import { GOAL_PRESETS, goalProgress } from './goal.js';
import { dayKey } from './storage/store.js';

const NOW = new Date(2026, 7, 17, 10, 0, 0).getTime();
const today = dayKey(NOW);
const yesterday = dayKey(NOW - 86_400_000);

describe('goalProgress', () => {
  it('counts only the day the timestamp falls in', () => {
    const p = goalProgress({ [today]: 400, [yesterday]: 9000 }, 1000, NOW);
    expect(p.read).toBe(400);
  });

  it('reports the share of the goal and what is left', () => {
    const p = goalProgress({ [today]: 750 }, 1000, NOW);
    expect(p.ratio).toBeCloseTo(0.75, 5);
    expect(p.remaining).toBe(250);
    expect(p.met).toBe(false);
  });

  it('caps the share at full instead of running past it', () => {
    const p = goalProgress({ [today]: 4000 }, 1000, NOW);
    expect(p.ratio).toBe(1);
    expect(p.met).toBe(true);
    expect(p.remaining).toBe(0);
  });

  it('stays empty when no goal is set, but still reports what was read', () => {
    const p = goalProgress({ [today]: 800 }, 0, NOW);
    expect(p.goal).toBe(0);
    expect(p.ratio).toBe(0);
    expect(p.met).toBe(false);
    expect(p.read).toBe(800);
  });

  it('treats a day with no entry as zero rather than failing', () => {
    const p = goalProgress({}, 1000, NOW);
    expect(p.read).toBe(0);
    expect(p.remaining).toBe(1000);
  });

  it('ignores a negative tally, which only a corrupt store could produce', () => {
    expect(goalProgress({ [today]: -5 }, 100, NOW).read).toBe(0);
  });

  it('offers "off" as the first preset, so turning it back off is one tap', () => {
    expect(GOAL_PRESETS[0]).toBe(0);
    expect([...GOAL_PRESETS].sort((a, b) => a - b)).toEqual([...GOAL_PRESETS]);
  });
});
