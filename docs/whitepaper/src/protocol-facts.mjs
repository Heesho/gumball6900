/**
 * Machine-readable protocol facts for the whitepaper.
 *
 * This module is the single place the whitepaper takes protocol numbers from. It has three
 * layers, and the build fails if they disagree:
 *
 *  1. `contractConstants` mirrors named constants in the production Solidity under
 *     `packages/contracts/src/core`. Each entry cites its source. These are transcriptions
 *     of the reviewed contracts and change only when the contracts change.
 *  2. `derived` is computed here at build time by replaying the same integer arithmetic the
 *     contracts apply (sequential floor decay, pro-rata floors, stream rates).
 *  3. `verifyProtocolFacts()` cross-checks both layers against the committed simulation
 *     fixture `packages/simulations/fixtures/reference-results.json`, which the repository
 *     tests independently in TypeScript and Python. A mismatch throws and blocks the build,
 *     so a whitepaper number cannot silently drift away from the tested model.
 *
 * Audit-evidence numbers (test counts, gas, coverage) cannot be recomputed here; they are
 * transcribed once from `packages/contracts/audit/` and quoted only through this module so
 * every page cites the same figures.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const WAD = 10n ** 18n;

/* ---------------------------------------------------- contract constants ---- */

/** Mirrors of named production constants. Source paths are relative to the repo root. */
export const contractConstants = {
  gbx: {
    source: 'packages/contracts/src/core/GBX.sol',
    maxLifetimeMint: 1_000_000_000n * WAD,
    genesisLiquidityAllocation: 20_000_000n * WAD,
    fundraiserAllocation: 980_000_000n * WAD,
    name: 'GUM BALL 6900',
    symbol: 'GBX',
    decimals: 18,
  },
  fundraiser: {
    source: 'packages/contracts/src/core/Fundraiser.sol',
    epochDurationSeconds: 86_400n,
    distributionAllocation: 980_000_000n * WAD,
    initialDailyEmission: 465_152_749_681_042_811_702_004n,
    dailyDecayWad: 999_525_354_337_060_160n,
    distributionEpochs: 99_884n,
    minContributionRaw: 10_000n,
  },
  usdg: {
    source: 'packages/sdk/src/math/constants.ts (CANONICAL_USDG_DECIMALS)',
    decimals: 6,
  },
  strategy: {
    source: 'packages/contracts/src/core/Strategy.sol',
    minEpochDurationSeconds: 3_600n,
    maxEpochDurationSeconds: 365n * 86_400n,
    minPriceMultiplierWad: 1_100_000_000_000_000_000n,
    maxPriceMultiplierWad: 3n * WAD,
    absoluteMinimumPrice: 1_000_000n,
    absoluteMaximumPrice: 2n ** 192n - 1n,
    priceScale: WAD,
  },
  bribe: {
    source: 'packages/contracts/src/core/Bribe.sol',
    rewardDurationSeconds: 604_800n,
    rewardPrecision: WAD,
    maxRewardTokens: 8,
  },
  resonance: {
    source: 'packages/contracts/src/core/Resonance.sol',
    indexPrecision: WAD,
    ongoingOwnerMethods: ['addStrategy', 'killStrategy', 'addBribeReward'],
    oneTimeOwnerMethods: ['setResonanceRouter'],
  },
  liquidity: {
    source: 'packages/contracts/src/core/LiquidityPosition.sol',
    genesisGbx: 20_000_000n * WAD,
    surface: 'harvestFees',
    principal: 'fixed (a harvest reverts unless position liquidity is exactly unchanged)',
    usdgDestination: 'ResonanceRouter -> Resonance (routed in the same transaction)',
    gbxDestination: 'Fund -> burnGBX (burned in the same transaction)',
  },
};

/* --------------------------------------------------------- derived facts ---- */

/**
 * Replay the exact sequential schedule the contract applies:
 *   scheduled_0     = INITIAL_DAILY_EMISSION
 *   scheduled_{t+1} = floor(scheduled_t * DAILY_DECAY / WAD)
 * until the scheduled emission floors to zero.
 */
function replaySchedule() {
  const { initialDailyEmission, dailyDecayWad } = contractConstants.fundraiser;
  let scheduled = initialDailyEmission;
  let cumulative = 0n;
  let epoch = 0n;
  let lastNonzeroEpoch = -1n;
  let lastNonzeroEmission = 0n;
  const byDay = new Map([
    [1n, null],
    [365n, null],
    [1_460n, null],
    [2_920n, null],
    [5_840n, null],
  ]);

  while (scheduled > 0n) {
    cumulative += scheduled;
    lastNonzeroEpoch = epoch;
    lastNonzeroEmission = scheduled;
    const day = epoch + 1n;
    if (byDay.has(day)) byDay.set(day, { daily: scheduled, cumulative });
    scheduled = (scheduled * dailyDecayWad) / WAD;
    epoch += 1n;
  }

  return {
    nonzeroEpochs: lastNonzeroEpoch + 1n,
    lastNonzeroEpochIndex: lastNonzeroEpoch,
    lastNonzeroEmission,
    cumulativeEmitted: cumulative,
    unmintedRemainder: contractConstants.fundraiser.distributionAllocation - cumulative,
    milestones: byDay,
  };
}

export const schedule = replaySchedule();

/** Exact-stream arithmetic used by Bribe: rate plus a one-unit remainder head. */
export function streamRate(amount) {
  const duration = contractConstants.bribe.rewardDurationSeconds;
  return { rate: amount / duration, remainderSeconds: amount % duration };
}

/* --------------------------------------------------------- status record ---- */

/**
 * Document-status facts. Everything here is verifiable inside the repository; nothing may
 * claim a deployment, an external audit, or a legal clearance that does not exist.
 */
export const status = {
  editionVersion: 'v0.3',
  editionDate: '10 August 2026',
  /** Head commit whose production contracts this paper describes. */
  contractsCommit: '5ad1ebc50f2963c54593430036d384221e0bc10a',
  contractsCommitShort: '5ad1ebc',
  /** Formal review-candidate commit named by the internal audit register. */
  auditCandidateCommit: '54e3f2c3ce1de25aea4da2f21fab27804a3bfa84',
  auditCandidateCommitShort: '54e3f2c',
  auditBaselineCommitShort: '395a0df',
  /**
   * Production Solidity changed between the register's candidate and the described head:
   * `Fundraiser.settleEpochs` moved to checked increments, and ADR 0022 replaced the
   * LiquidityPosition compounding surface with fixed-principal `harvestFees`. The final
   * recorded campaign (340/340 default tests and the genuine-v4 integration suite) covers
   * the post-ADR-0022 tree committed as 5ad1ebc.
   */
  solidityChangedAfterCandidate: true,
  targetNetwork: 'Robinhood Chain (chain ID 4663)',
  deployment: 'Not deployed and not authorized for user funds',
  testnetDeployment: 'None recorded in the repository',
  securityReview: 'Internal adversarial review only',
  externalAudit: 'Independent external audit: Not completed',
  licensing:
    'Repository license and upstream provenance unresolved; distribution and deployment blocked pending counsel review',
  legalReview: 'Not performed',
};

/* --------------------------------------------------------- audit evidence ---- */

/**
 * Transcribed once from packages/contracts/audit/. These are recorded internal-engineering
 * results, not independent assurance. Planned targets that did not complete are listed as
 * blocked, never as passes.
 */
export const auditEvidence = {
  register: 'packages/contracts/audit/FINDINGS.md',
  toolchain: {
    foundry: '1.7.1 (commit 4072e48705af9d93e3c0f6e29e93b5e9a40caed8)',
    solidity: '0.8.26, Cancun, optimizer 10,000, legacy pipeline',
    hardhat: '2.29.0',
    node: '22.23.1',
    pnpm: '10.14.0',
    medusa: '1.5.1',
    echidna: 'pinned 2.3.2 (blocked: no Docker); native fallback 2.3.3 (invalid run)',
    mythril: '0.24.8 (blocked: Cancun opcodes unsupported)',
    slither: '0.11.5',
    aderyn: '0.6.8',
    semgrep: '1.162.0',
    solhint: '6.0.1',
    gitleaks: '8.30.1',
  },
  foundry: {
    defaultTests: 340,
    defaultFailures: 0,
    integrationTests: 17,
    hardhatTests: 2,
    fuzzProperties: 27,
    fuzzRunsPerProperty: 10_000,
    invariantProperties: 27,
    invariantRunsPerProperty: 1_000,
    invariantDepth: 500,
    invariantAggregateCalls: 13_500_000,
    invariantHandlerActions: 22,
    invariantHandlerReverts: 0,
    harvestFuzzCases: 10_000,
    nightlyProfile: 'configured (100,000 fuzz runs; 10,000 invariant runs at depth 1,000) but not completed',
  },
  medusa: { calls: 101_840, branches: 3_632, corpus: 101, surfaces: '62/62 pass (23 properties, 39 assertions)' },
  echidna:
    'invalid: all four native 2.3.3 workers crashed before transaction one (0/25 tests); pinned 2.3.2 blocked without Docker',
  mutation: 'no defensible current-tree score; raw and equivalent-adjusted scores unavailable; release blocker',
  formal: 'not formally verified; Mythril 0.24.8 fails closed on Cancun opcodes; no symbolic proof exists',
  coverage: { lines: '92.98%', statements: '92.86%', branches: '80.22%', functions: '89.34%' },
  staticAnalysis: {
    dispositionedFindings: 186,
    detectorClasses: 23,
    semgrepFindings: 0,
    solhintWarnings: 106,
    gitleaksOpen: 6,
  },
  gas: {
    note: 'Foundry 1.7.1, solc 0.8.26, optimizer 10,000; recorded in TEST-CAMPAIGN.md',
    addSignalOneToken: 227_777,
    addSignalEightTokens: 336_621,
    removeSignalOneToken: 176_166,
    removeSignalEightTokens: 1_341_818,
    claimOneToken: 168_113,
    claimEightSelective: 1_348_052,
    claimAllConvenience: 1_339_891,
    strategyBuyEightTokens: 196_941,
    addTokenEight: 50_840,
    rejectTokenNine: 5_379,
    killStrategy: 12_916,
  },
  fork: {
    status: 'no current-graph fork ran; read-only evidence only',
    chainId: 4663,
    block: 32_035_314,
    blockHash: '0xe13569d3a71001227e35d660dfbcfed1e7660d10b74c0c639e4bc0eab1555aea',
  },
  findings: [
    {
      id: 'A-02',
      severity: 'High',
      status: 'Resolved in the reviewed candidate',
      summary: 'Exact carried USDG revenue accounting replaces lossy index flooring.',
    },
    {
      id: 'A-03',
      severity: 'High',
      status: 'Resolved in the reviewed candidate',
      summary: 'Bribe keeps exact rate and index carry, zero-supply pausing, queues, and selective claims.',
    },
    {
      id: 'A-04',
      severity: 'High',
      status: 'Resolved in the reviewed candidate',
      summary: 'Fixed Fund liabilities isolate signal exit from failing destination transfers.',
    },
    {
      id: 'A-05',
      severity: 'Product behavior',
      status: 'Accepted and disclosed',
      summary: 'A late fill can clear at or near zero and the next auction restarts from its configured floor.',
    },
    {
      id: 'A-06',
      severity: 'Medium',
      status: 'Resolved by ADR 0022',
      summary: 'Caller-funded LP compounding was removed; harvesting preserves principal with fixed destinations.',
    },
    {
      id: 'A-08',
      severity: 'Medium',
      status: 'Liveness resolved; linear cost retained',
      summary: 'Reward loops stay capped at eight tokens with scalar and selective escape paths.',
    },
    {
      id: 'A-09',
      severity: 'Medium',
      status: 'Open; owner decision required',
      summary: 'Conserved sub-index carry can be shared with signal weight that arrives after the value did.',
    },
  ],
};

/* ----------------------------------------------------------- verification ---- */

function readFixture() {
  const path = resolve(repoRoot, 'packages/simulations/fixtures/reference-results.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Build gate. Throws when a stated fact disagrees with the replayed contract arithmetic or
 * with the independently tested simulation fixture.
 */
export function verifyProtocolFacts() {
  const failures = [];
  const check = (label, actual, expected) => {
    if (actual !== expected) failures.push(`${label}: stated ${expected}, computed ${actual}`);
  };

  // Internal identities.
  check(
    'GBX allocation partition',
    contractConstants.gbx.genesisLiquidityAllocation + contractConstants.gbx.fundraiserAllocation,
    contractConstants.gbx.maxLifetimeMint,
  );
  check(
    'Fundraiser allocation equals GBX fundraiser allocation',
    contractConstants.fundraiser.distributionAllocation,
    contractConstants.gbx.fundraiserAllocation,
  );

  // The derived initial emission must reproduce the contract constant:
  // floor(allocation * (1 - 2^(-1/1460))) at 54 significant digits.
  const complementX54 = 474_645_662_939_839_603_777_555_401_729_090_269_549_790_568_890_158n;
  const derivedInitial = (contractConstants.fundraiser.distributionAllocation * complementX54) / 10n ** 54n;
  check('initial daily emission derivation', derivedInitial, contractConstants.fundraiser.initialDailyEmission);

  // Replayed schedule versus the contract's epoch-count constant.
  check('nonzero epoch count', schedule.nonzeroEpochs, contractConstants.fundraiser.distributionEpochs);

  // Replayed schedule versus the committed cross-language simulation fixture.
  const fixture = readFixture();
  check('fixture positive epochs', schedule.nonzeroEpochs, BigInt(fixture.emissionScheduleLifetime.positiveEpochs));
  check(
    'fixture cumulative emitted',
    schedule.cumulativeEmitted,
    BigInt(fixture.emissionScheduleLifetime.sequentialScheduledTotal),
  );
  check(
    'fixture unminted remainder',
    schedule.unmintedRemainder,
    BigInt(fixture.emissionScheduleLifetime.nominalAllocationResidual),
  );
  check(
    'fixture initial emission',
    BigInt(fixture.initialDailyScheduledEmission),
    contractConstants.fundraiser.initialDailyEmission,
  );
  check('fixture genesis supply', BigInt(fixture.genesisSupply), contractConstants.gbx.genesisLiquidityAllocation);
  check(
    'fixture mining allocation',
    BigInt(fixture.miningEmissionAllocation),
    contractConstants.fundraiser.distributionAllocation,
  );

  // Milestone spot checks against the fixture's emission horizons.
  const horizonByDays = new Map((fixture.emissionHorizons ?? []).map((entry) => [BigInt(entry.days), entry]));
  for (const [day, milestone] of schedule.milestones) {
    const horizon = horizonByDays.get(day);
    if (horizon && milestone) {
      check(`fixture cumulative at day ${day}`, milestone.cumulative, BigInt(horizon.recurringMinted));
    }
  }

  // Stream arithmetic sanity: a 7-day stream of A emits exactly A.
  const sample = 1_234_567_891_234_567_891n;
  const { rate, remainderSeconds } = streamRate(sample);
  check('stream conservation', rate * contractConstants.bribe.rewardDurationSeconds + remainderSeconds, sample);

  if (failures.length > 0) {
    throw new Error(`Protocol fact check failed:\n  ${failures.join('\n  ')}`);
  }

  return {
    checks: 12 + schedule.milestones.size,
    nonzeroEpochs: schedule.nonzeroEpochs,
    cumulativeEmitted: schedule.cumulativeEmitted,
    unmintedRemainder: schedule.unmintedRemainder,
  };
}
