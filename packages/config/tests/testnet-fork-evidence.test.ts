import { describe, expect, it } from 'vitest';

import evidenceJson from '../deployments/robinhood-testnet-fork-evidence.json' with { type: 'json' };
import {
  TESTNET_FORK_OBSERVATION_MAX_BLOCK_TIMESTAMP_LAG_MS,
  TESTNET_FORK_OBSERVATION_MAX_HEAD_AGE_MS,
  TESTNET_FORK_OBSERVATION_MIN_CONFIRMATIONS,
  parseRobinhoodTestnetForkEvidence,
  requireConfiguredRobinhoodTestnetForkEvidence,
  requireFreshRobinhoodTestnetForkEvidence,
  verifyLiveRobinhoodTestnetForkEvidence,
  type TestnetForkBlockHeader,
  type TestnetForkHeaderProvider,
} from '../schemas/testnet-fork-evidence.js';

const address = (suffix: number) => `0x${suffix.toString(16).padStart(40, '0')}`;
const hash = (byte: string) => `0x${byte.repeat(64)}`;
const NOW_MS = Date.parse('2026-08-01T12:30:00Z');
const OBSERVED_AT_MS = Date.parse('2026-08-01T12:00:00Z');
const OBSERVATION_BLOCK = 123_456n;

function headerProvider(
  options: {
    chainId?: number;
    confirmations?: bigint;
    headTimestampMs?: number;
    observationTimestampMs?: number;
    secondObservationHash?: string;
  } = {},
): TestnetForkHeaderProvider {
  const observation: TestnetForkBlockHeader = {
    hash: hash('b'),
    number: OBSERVATION_BLOCK,
    timestamp: BigInt(Math.floor((options.observationTimestampMs ?? OBSERVED_AT_MS - 60_000) / 1_000)),
  };
  const head: TestnetForkBlockHeader = {
    hash: hash('c'),
    number: OBSERVATION_BLOCK + (options.confirmations ?? TESTNET_FORK_OBSERVATION_MIN_CONFIRMATIONS),
    timestamp: BigInt(Math.floor((options.headTimestampMs ?? NOW_MS - 1_000) / 1_000)),
  };
  let observationReads = 0;
  return {
    getBlock: async ({ blockNumber }) => {
      if (blockNumber === undefined) return head;
      observationReads += 1;
      if (observationReads === 2 && options.secondObservationHash !== undefined) {
        return { ...observation, hash: options.secondObservationHash };
      }
      return observation;
    },
    getChainId: async () => options.chainId ?? 46_630,
  };
}

function configuredEvidence() {
  return {
    blockHash: hash('b'),
    blockNumber: '123456',
    chainId: 46630,
    dependencies: {
      permit2: { address: address(1), runtimeBytecodeHash: hash('1') },
      poolManager: { address: address(2), runtimeBytecodeHash: hash('2') },
      positionManager: { address: address(3), runtimeBytecodeHash: hash('3') },
      usdG: { address: address(4), runtimeBytecodeHash: hash('4') },
      weth: { address: address(5), runtimeBytecodeHash: hash('5') },
    },
    expiresAt: '2026-08-01T13:00:00Z',
    kind: 'gumball-6900-robinhood-testnet-fork-evidence',
    observedAt: '2026-08-01T12:00:00Z',
    parentBlockHash: hash('a'),
    protocol: 'GUM BALL 6900',
    schemaVersion: 1,
    sourceUrl: 'https://docs.robinhood.com/chain/contracts/',
    state: 'configured',
  } as const;
}

describe('build-bound Robinhood testnet fork evidence', () => {
  it('keeps the committed release input explicitly unconfigured', () => {
    expect(parseRobinhoodTestnetForkEvidence(evidenceJson)).toEqual(evidenceJson);
    expect(() => requireConfiguredRobinhoodTestnetForkEvidence(evidenceJson)).toThrow(/unconfigured/);
  });

  it('accepts exact configured block, block hash, parent hash, and dependency bytecode identities', () => {
    expect(requireConfiguredRobinhoodTestnetForkEvidence(configuredEvidence()).blockNumber).toBe('123456');
    expect(requireFreshRobinhoodTestnetForkEvidence(configuredEvidence(), Date.parse('2026-08-01T12:30:00Z'))).toEqual(
      configuredEvidence(),
    );
  });

  it('rejects zero blocks, zero hashes, and aliased dependency addresses', () => {
    expect(() => parseRobinhoodTestnetForkEvidence({ ...configuredEvidence(), blockNumber: '0' })).toThrow();
    expect(() => parseRobinhoodTestnetForkEvidence({ ...configuredEvidence(), blockHash: hash('0') })).toThrow();
    expect(() => parseRobinhoodTestnetForkEvidence({ ...configuredEvidence(), parentBlockHash: hash('0') })).toThrow();
    const duplicate = configuredEvidence();
    expect(() =>
      parseRobinhoodTestnetForkEvidence({
        ...duplicate,
        dependencies: {
          ...duplicate.dependencies,
          weth: { ...duplicate.dependencies.weth, address: duplicate.dependencies.usdG.address },
        },
      }),
    ).toThrow(/unique/);
  });

  it('rejects expired, future-dated, and overlong evidence at the release boundary', () => {
    expect(() =>
      requireFreshRobinhoodTestnetForkEvidence(configuredEvidence(), Date.parse('2026-08-01T13:00:00Z')),
    ).toThrow(/expired/);
    expect(() =>
      requireFreshRobinhoodTestnetForkEvidence(configuredEvidence(), Date.parse('2026-08-01T11:59:59Z')),
    ).toThrow(/future-dated/);
    expect(() =>
      parseRobinhoodTestnetForkEvidence({ ...configuredEvidence(), expiresAt: '2026-08-02T12:00:01Z' }),
    ).toThrow(/no longer than 24 hours/);
  });

  it('binds a recent signed observation block to a fresh, sufficiently confirmed canonical head', async () => {
    await expect(
      verifyLiveRobinhoodTestnetForkEvidence(headerProvider(), configuredEvidence(), NOW_MS),
    ).resolves.toEqual({
      confirmations: TESTNET_FORK_OBSERVATION_MIN_CONFIRMATIONS,
      headBlock: OBSERVATION_BLOCK + TESTNET_FORK_OBSERVATION_MIN_CONFIRMATIONS,
      headHash: hash('c'),
      observationBlock: OBSERVATION_BLOCK,
    });
  });

  it('rejects an old block laundered through a fresh observedAt or a block substituted during verification', async () => {
    await expect(
      verifyLiveRobinhoodTestnetForkEvidence(
        headerProvider({
          observationTimestampMs: OBSERVED_AT_MS - TESTNET_FORK_OBSERVATION_MAX_BLOCK_TIMESTAMP_LAG_MS - 1_000,
        }),
        configuredEvidence(),
        NOW_MS,
      ),
    ).rejects.toThrow(/older than 15 minutes/);
    await expect(
      verifyLiveRobinhoodTestnetForkEvidence(
        headerProvider({ secondObservationHash: hash('d') }),
        configuredEvidence(),
        NOW_MS,
      ),
    ).rejects.toThrow(/signed hash/);
  });

  it('rejects the wrong chain, insufficient confirmations, and a stale head', async () => {
    await expect(
      verifyLiveRobinhoodTestnetForkEvidence(headerProvider({ chainId: 1 }), configuredEvidence(), NOW_MS),
    ).rejects.toThrow(/46630/);
    await expect(
      verifyLiveRobinhoodTestnetForkEvidence(
        headerProvider({ confirmations: TESTNET_FORK_OBSERVATION_MIN_CONFIRMATIONS - 1n }),
        configuredEvidence(),
        NOW_MS,
      ),
    ).rejects.toThrow(/confirmations/);
    await expect(
      verifyLiveRobinhoodTestnetForkEvidence(
        headerProvider({ headTimestampMs: NOW_MS - TESTNET_FORK_OBSERVATION_MAX_HEAD_AGE_MS - 1_000 }),
        configuredEvidence(),
        NOW_MS,
      ),
    ).rejects.toThrow(/more than 5 minutes stale/);
  });
});
