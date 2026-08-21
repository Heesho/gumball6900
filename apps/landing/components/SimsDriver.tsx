'use client';

import { useEffect } from 'react';
import { startHarness } from '../lib/harness';

/**
 * Mounts the page-wide simulation/entrance driver. Rendered last in the page
 * so section effects (which register sims) run first.
 */
export function SimsDriver(): null {
  useEffect(() => startHarness(), []);
  return null;
}
