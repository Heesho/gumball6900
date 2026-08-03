import { deterministicJson } from '../tooling/deterministic-json.js';
import { HttpJsonRpcClient } from '../tooling/json-rpc.js';
import { resolveRobinhoodMainnetWrappedBtc } from '../tooling/wrapped-btc-bridge.js';
import { assertKnownOptions, parseArguments, requireValue, writeOutput } from './cli-helpers.js';

function optionalBlockNumber(value: string | undefined): bigint | undefined {
  if (value === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(value)) throw new Error('--block-number must be a positive decimal integer');
  return BigInt(value);
}

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  assertKnownOptions(arguments_, ['block-number', 'output', 'rpc-url'], []);
  const rpcUrl = requireValue(arguments_, 'rpc-url', process.env.ROBINHOOD_MAINNET_ARCHIVE_RPC_URL);
  const blockNumber = optionalBlockNumber(arguments_.values.get('block-number'));
  const rpc = new HttpJsonRpcClient(rpcUrl);
  const candidate = await resolveRobinhoodMainnetWrappedBtc(blockNumber === undefined ? { rpc } : { blockNumber, rpc });
  await writeOutput(deterministicJson(candidate), arguments_.values.get('output'));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Wrapped-BTC candidate generation failed: ${message}\n`);
  process.exitCode = 1;
});
