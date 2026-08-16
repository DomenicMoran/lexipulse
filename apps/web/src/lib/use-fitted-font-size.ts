'use client';

import { computeStageGeometry, fitFontSize } from '@lexipulse/ui';
import * as React from 'react';

/**
 * `useLayoutEffect` on the client, `useEffect` on the server.
 *
 * The stage has to be sized before the browser paints, otherwise the first frame shows
 * the fallback size and the correction registers as layout shift. The branch is on the
 * environment, which never changes within a render tree, so the hook order stays stable.
 */
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

export interface FitOptions {
  maxWordLength: number;
  min?: number;
  max?: number;
  /** Server-render value. Chosen close to the common desktop result. */
  initial?: number;
}

/**
 * Largest player font size that still fits the RSVP stage into its container.
 *
 * The stage is exactly `columns` characters wide by construction, so this is pure
 * arithmetic on the measured width — no text measurement, no reflow loop.
 */
export function useFittedFontSize(
  ref: React.RefObject<HTMLElement | null>,
  { maxWordLength, min = 20, max = 96, initial = 44 }: FitOptions,
): number {
  const [size, setSize] = React.useState(initial);

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const geometry = computeStageGeometry({ maxWordLength });
    const measure = () => {
      const width = element.clientWidth;
      if (width > 0) setSize(fitFontSize(width, geometry, { min, max }));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, maxWordLength, min, max]);

  return size;
}
