import { deterministicJson } from '../tooling/deterministic-json.js';
import { HttpJsonRpcClient } from '../tooling/json-rpc.js';
import { selectNightlyMainnetPin } from '../tooling/nightly-mainnet-pin.js';
import { assertKnownOptions, parseArguments, requireValue, writeOutput } from './cli-helpers.js';

function confirmationDepth(value: string | undefined): number {
  if (value === undefined) return 64;
  if (!/^\d+$/.test(value)) throw new Error('--confirmation-depth must be a decimal integer');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error('--confirmation-depth exceeds the safe integer range');
  return parsed;
}

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  assertKnownOptions(arguments_, ['confirmation-depth', 'output', 'rpc-url'], []);
  const rpcUrl = requireValue(arguments_, 'rpc-url', process.env.ROBINHOOD_MAINNET_ARCHIVE_RPC_URL);
  const pin = await selectNightlyMainnetPin(
    new HttpJsonRpcClient(rpcUrl),
    confirmationDepth(arguments_.values.get('confirmation-depth')),
  );
  await writeOutput(deterministicJson(pin), arguments_.values.get('output'));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Nightly mainnet pin selection failed: ${message}\n`);
  process.exitCode = 1;
});
