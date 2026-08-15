#!/usr/bin/env node

import { assertCurrentReleaseToolingAvailable } from '../current-release.js';

try {
  assertCurrentReleaseToolingAvailable();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
