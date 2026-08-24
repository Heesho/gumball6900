import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import evidenceJson from '../deployments/robinhood-testnet-fork-evidence.json' with { type: 'json' };
import {
  parseRobinhoodTestnetForkEvidence,
  requireFreshRobinhoodTestnetForkEvidence,
} from '../schemas/testnet-fork-evidence.js';
import { deterministicJson } from '../tooling/deterministic-json.js';

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} is required`);
  return path.resolve(value);
}

const githubEnvPath = option('--github-env');
const contextPath = option('--context');
const parsedEvidence = parseRobinhoodTestnetForkEvidence(evidenceJson);
await mkdir(path.dirname(contextPath), { recursive: true });
await writeFile(contextPath, deterministicJson(parsedEvidence), { encoding: 'utf8', flag: 'wx' });
const evidence = requireFreshRobinhoodTestnetForkEvidence(parsedEvidence);
const variables = {
  ROBINHOOD_TESTNET_FORK_BLOCK: evidence.blockNumber,
  ROBINHOOD_TESTNET_FORK_BLOCK_HASH: evidence.blockHash,
  ROBINHOOD_TESTNET_OBSERVED_AT_UNIX: String(Math.floor(Date.parse(evidence.observedAt) / 1_000)),
  ROBINHOOD_TESTNET_PARENT_BLOCK_HASH: evidence.parentBlockHash,
  ROBINHOOD_TESTNET_USDG_ADDRESS: evidence.dependencies.usdG.address,
  ROBINHOOD_TESTNET_USDG_CODE_HASH: evidence.dependencies.usdG.runtimeBytecodeHash,
} as const;

await appendFile(
  githubEnvPath,
  `${Object.entries(variables)
    .map(([name, value]) => `${name}=${value}`)
    .join('\n')}\n`,
  'utf8',
);

console.log(`Exported build-bound Robinhood testnet fork evidence observed at ${evidence.observedAt}.`);
