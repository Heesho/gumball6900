import { deterministicJson } from '../tooling/deterministic-json.js';
import { HttpJsonRpcClient } from '../tooling/json-rpc.js';
import {
  buildRobinhoodAssetManifest,
  fetchOfficialRobinhoodAssetRegistry,
} from '../tooling/robinhood-asset-manifest.js';
import { assertKnownOptions, parseArguments, requireValue, writeOutput } from './cli-helpers.js';

function optionalBlockNumber(value: string | undefined): bigint | undefined {
  if (value === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(value)) throw new Error('--block-number must be a positive decimal integer');
  return BigInt(value);
}

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  assertKnownOptions(arguments_, ['block-number', 'observed-at', 'output', 'rpc-url'], []);
  const rpcUrl = requireValue(arguments_, 'rpc-url', process.env.ROBINHOOD_MAINNET_RPC_URL);
  const observedAt = requireValue(arguments_, 'observed-at');
  const blockNumber = optionalBlockNumber(arguments_.values.get('block-number'));
  const registryPayload = await fetchOfficialRobinhoodAssetRegistry();
  const manifest = await buildRobinhoodAssetManifest({
    ...(blockNumber === undefined ? {} : { blockNumber }),
    observedAt,
    registryPayload,
    rpc: new HttpJsonRpcClient(rpcUrl),
  });
  await writeOutput(deterministicJson(manifest), arguments_.values.get('output'));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Asset manifest generation failed: ${message}\n`);
  process.exitCode = 1;
});
