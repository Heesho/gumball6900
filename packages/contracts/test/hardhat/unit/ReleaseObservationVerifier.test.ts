import { expect } from 'chai';
import type { Provider } from 'ethers';

import type { ReleaseObservation } from '../../../script/hardhat/release-manifest-binding';
import {
  RELEASE_OBSERVATION_MAX_BLOCK_TIMESTAMP_LAG_MS,
  RELEASE_OBSERVATION_MAX_HEAD_AGE_MS,
  RELEASE_OBSERVATION_MIN_CONFIRMATIONS,
  verifyLiveReleaseObservation,
} from '../../../script/hardhat/release-observation-verifier';

const HASH_A = `0x${'ab'.repeat(32)}`;
const HASH_B = `0x${'cd'.repeat(32)}`;
const OBSERVATION_BLOCK = 1_000;
const NOW_MS = Date.parse('2026-08-01T00:10:00Z');
const OBSERVED_AT_MS = NOW_MS - 60_000;

interface Header {
  hash: string | null;
  number: number;
  timestamp: number;
}

function observation(overrides: Partial<ReleaseObservation> = {}): ReleaseObservation {
  return {
    blockHash: HASH_A,
    blockNumber: String(OBSERVATION_BLOCK),
    expiresAt: new Date(NOW_MS + 60 * 60 * 1_000).toISOString(),
    observedAt: new Date(OBSERVED_AT_MS).toISOString(),
    ...overrides,
  };
}

function provider(
  options: {
    head?: Partial<Header>;
    secondSigned?: Partial<Header>;
    signed?: Partial<Header>;
  } = {},
): Pick<Provider, 'getBlock'> {
  const signed: Header = {
    hash: HASH_A,
    number: OBSERVATION_BLOCK,
    timestamp: Math.floor((OBSERVED_AT_MS - RELEASE_OBSERVATION_MAX_BLOCK_TIMESTAMP_LAG_MS) / 1_000),
    ...options.signed,
  };
  const head: Header = {
    hash: HASH_B,
    number: OBSERVATION_BLOCK + Number(RELEASE_OBSERVATION_MIN_CONFIRMATIONS),
    timestamp: Math.floor((NOW_MS - 1_000) / 1_000),
    ...options.head,
  };
  let signedReads = 0;
  return {
    getBlock: async (blockTag) => {
      if (blockTag === 'latest') return head as never;
      signedReads += 1;
      return (signedReads === 2 ? { ...signed, ...options.secondSigned } : signed) as never;
    },
  };
}

async function expectRejected(promise: Promise<unknown>, message: string): Promise<void> {
  try {
    await promise;
    expect.fail(`Expected rejection containing: ${message}`);
  } catch (error) {
    expect(error).to.be.instanceOf(Error);
    expect((error as Error).message).to.contain(message);
  }
}

describe('Live release observation verification', function () {
  it('accepts the exact block-lag and confirmation boundaries and re-reads the signed header', async function () {
    const result = await verifyLiveReleaseObservation(provider(), observation(), NOW_MS);
    expect(result).to.deep.equal({
      confirmations: RELEASE_OBSERVATION_MIN_CONFIRMATIONS,
      headBlock: BigInt(OBSERVATION_BLOCK) + RELEASE_OBSERVATION_MIN_CONFIRMATIONS,
      headHash: HASH_B,
      observationBlock: BigInt(OBSERVATION_BLOCK),
    });
  });

  it('rejects a fresh observedAt attached to an older historical block', async function () {
    const tooOldSeconds = Math.floor((OBSERVED_AT_MS - RELEASE_OBSERVATION_MAX_BLOCK_TIMESTAMP_LAG_MS) / 1_000 - 1);
    await expectRejected(
      verifyLiveReleaseObservation(provider({ signed: { timestamp: tooOldSeconds } }), observation(), NOW_MS),
      'detached from an observation block older than 15 minutes',
    );
  });

  it('rejects insufficient burial and stale or future-dated live heads', async function () {
    await expectRejected(
      verifyLiveReleaseObservation(
        provider({ head: { number: OBSERVATION_BLOCK + Number(RELEASE_OBSERVATION_MIN_CONFIRMATIONS) - 1 } }),
        observation(),
        NOW_MS,
      ),
      'confirmations',
    );

    await expectRejected(
      verifyLiveReleaseObservation(
        provider({ head: { timestamp: Math.floor((NOW_MS - RELEASE_OBSERVATION_MAX_HEAD_AGE_MS) / 1_000 - 1) } }),
        observation(),
        NOW_MS,
      ),
      'more than 5 minutes stale',
    );

    await expectRejected(
      verifyLiveReleaseObservation(
        provider({ head: { timestamp: Math.floor((NOW_MS + 61_000) / 1_000) } }),
        observation(),
        NOW_MS,
      ),
      'materially in the future',
    );
  });

  it('rejects a signed block that changes around the current-head query', async function () {
    await expectRejected(
      verifyLiveReleaseObservation(provider({ secondSigned: { hash: HASH_B } }), observation(), NOW_MS),
      'block hash mismatch',
    );
  });
});
