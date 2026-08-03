import { readFile } from 'node:fs/promises';

import {
  expectedBytecodeHashesSchema,
  verifyCanonicalBytecode,
  type ExpectedBytecodeHashes,
} from '../tooling/bytecode-verifier.js';
import { deterministicJson } from '../tooling/deterministic-json.js';
import { HttpJsonRpcClient } from '../tooling/json-rpc.js';
import { assertKnownOptions, parseArguments, requireValue, resolveUserPath, writeOutput } from './cli-helpers.js';

async function loadExpectedHashes(path: string): Promise<ExpectedBytecodeHashes> {
  return expectedBytecodeHashesSchema.parse(JSON.parse(await readFile(resolveUserPath(path), 'utf8')) as unknown);
}

function optionalBlockNumber(value: string | undefined): bigint | undefined {
  if (value === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(value)) throw new Error('--block-number must be a positive decimal integer');
  return BigInt(value);
}

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  assertKnownOptions(
    arguments_,
    ['block-number', 'expected-hashes', 'observed-at', 'output', 'rpc-url'],
    ['collect-unpinned'],
  );
  const collectUnpinned = arguments_.flags.has('collect-unpinned');
  const expectedHashesPath = arguments_.values.get('expected-hashes');
  if (collectUnpinned === (expectedHashesPath !== undefined)) {
    throw new Error('Choose exactly one of --expected-hashes or --collect-unpinned');
  }

  const expectedHashes = expectedHashesPath === undefined ? undefined : await loadExpectedHashes(expectedHashesPath);
  const blockNumber = optionalBlockNumber(arguments_.values.get('block-number'));
  const report = await verifyCanonicalBytecode({
    ...(blockNumber === undefined ? {} : { blockNumber }),
    ...(expectedHashes === undefined ? {} : { expectedHashes }),
    observedAt: requireValue(arguments_, 'observed-at'),
    requirePinnedHashes: !collectUnpinned,
    rpc: new HttpJsonRpcClient(requireValue(arguments_, 'rpc-url', process.env.ROBINHOOD_MAINNET_RPC_URL)),
  });
  await writeOutput(deterministicJson(report), arguments_.values.get('output'));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Canonical bytecode verification failed: ${message}\n`);
  process.exitCode = 1;
});
