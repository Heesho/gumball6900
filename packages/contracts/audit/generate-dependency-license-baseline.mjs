#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { reviewRequiredEntries } from './check-license-review.mjs';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function main() {
  if (process.argv.length !== 5) {
    throw new Error(
      'Usage: generate-dependency-license-baseline.mjs <inventory.json> <pnpm-lock.yaml> <output-policy.json>',
    );
  }
  const [inventoryPath, lockfilePath, outputPath] = process.argv.slice(2).map((value) => path.resolve(value));
  const [inventoryBytes, lockfileBytes] = await Promise.all([readFile(inventoryPath), readFile(lockfilePath)]);
  const inventory = JSON.parse(inventoryBytes.toString('utf8'));
  const entries = reviewRequiredEntries(inventory).map((entry) => ({
    ...entry,
    disposition: 'needs-counsel',
    releaseRelevance: 'undetermined',
    rationale: 'This inventory-only classification awaits owner and counsel disposition before release approval.',
  }));
  const policy = {
    kind: 'gumball-6900-dependency-license-review-policy',
    protocol: 'GUM BALL 6900',
    schemaVersion: 1,
    state: 'inventory-baselined',
    platform: inventory.source.platform,
    pnpmLockSha256: sha256(lockfileBytes),
    licenseReportSha256: sha256(inventoryBytes),
    reviewedAt: null,
    reviewedBy: null,
    entries,
  };
  await writeFile(outputPath, `${JSON.stringify(policy, null, 2)}\n`, 'utf8');
}

main().catch((error) => {
  process.stderr.write(`Dependency license baseline generation failed: ${error.message}\n`);
  process.exitCode = 1;
});
