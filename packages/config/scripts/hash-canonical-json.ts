import { readFile } from 'node:fs/promises';

import { deterministicJson, sha256Hex } from '../tooling/deterministic-json.js';
import { assertKnownOptions, parseArguments, requireValue, resolveUserPath, writeOutput } from './cli-helpers.js';

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  assertKnownOptions(arguments_, ['file', 'output'], []);
  const inputPath = resolveUserPath(requireValue(arguments_, 'file'));
  const value = JSON.parse(await readFile(inputPath, 'utf8')) as unknown;
  await writeOutput(`${sha256Hex(deterministicJson(value))}\n`, arguments_.values.get('output'));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Canonical JSON hashing failed: ${message}\n`);
  process.exitCode = 1;
});
