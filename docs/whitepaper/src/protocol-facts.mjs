import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

export const contractConstants = {
  gbx: {
    source: 'packages/contracts/src/core/GBX.sol',
    genesisLiquidityTokens: 20_000_000,
    unlimitedSupply: true,
    supportsPermit: true,
    supportsVotes: false,
  },
  signalGbx: {
    source: 'packages/contracts/src/core/SignalGBX.sol',
    nonTransferable: true,
    supportsPermit: false,
    supportsVotes: true,
    soleSignalCoordinator: true,
    idleSupplyForbidden: true,
  },
  mine: {
    source: 'packages/contracts/src/core/Mine.sol',
    priceDecaySeconds: 3_600,
    previousMinerBps: 8_000,
    resonanceBps: 2_000,
    slotCount: 16,
    priceMultiplier: 2n,
    minimumInitialPrice: 1_000_000n,
    initialTps: 64n * 10n ** 18n,
    halvingPeriodSeconds: 69n * 86_400n,
    tailTps: 1n * 10n ** 18n,
    tenureRatesLocked: true,
    constantTimePendingEmission: true,
  },
  bribe: {
    source: 'packages/contracts/src/core/Bribe.sol',
    maxRewardTokens: 8,
    rewardPrecision: 10n ** 36n,
  },
  resonance: {
    source: 'packages/contracts/src/core/Resonance.sol',
    bps: 10_000,
    minimumBribeBps: 0,
    defaultBribeBps: 1_000,
    maximumBribeBps: 2_000,
    minimumFundBps: 8_000,
    defaultFundBps: 9_000,
  },
  bribeRouter: {
    source: 'packages/contracts/src/core/BribeRouter.sol',
    bps: 10_000,
    // Retained as default-rate aliases for the historical long-form chart renderer.
    fundBps: 9_000,
    bribeBps: 1_000,
    usesGlobalProspectiveRate: true,
    cumulativeSplit: true,
  },
};

export const status = {
  editionVersion: 'v0.8',
  editionDate: '22 August 2026',
  contractsCommit: 'uncommitted working tree based on e3ebdd7987653969b31dbf0e8d20b68a838dfa5d',
  contractsCommitShort: 'uncommitted',
  auditCandidateCommit: 'none for the current architecture',
  auditCandidateCommitShort: 'none',
  deployment: 'Not deployed and not authorized for user funds',
  externalAudit: 'Independent external audit not completed',
  licensing: 'donut-miner, give.fun, Liquid Signal, and transitive lineage remain unresolved release blockers',
  architectureImplementation:
    'ADRs 0031 and 0033-0044 implemented in the development tree; the provisional Mine emission schedule and external governance owner remain under review',
};

export function verifyProtocolFacts() {
  const fixturePath = resolve(repoRoot, 'packages/simulations/fixtures/economic-scenarios.json');
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const expected = contractConstants.mine;
  const mineSource = readFileSync(resolve(repoRoot, contractConstants.mine.source), 'utf8');
  const resonanceSource = readFileSync(resolve(repoRoot, contractConstants.resonance.source), 'utf8');
  const routerSource = readFileSync(resolve(repoRoot, contractConstants.bribeRouter.source), 'utf8');
  const bribeSource = readFileSync(resolve(repoRoot, contractConstants.bribe.source), 'utf8');
  const checks = [
    ['genesis allocation', BigInt(fixture.assumptions.genesisLiquidityAllocationGBXRaw), 20_000_000n * 10n ** 18n],
    ['price decay', BigInt(fixture.assumptions.priceDecaySeconds), BigInt(expected.priceDecaySeconds)],
    ['previous miner bps', BigInt(fixture.assumptions.previousMinerBps), BigInt(expected.previousMinerBps)],
    ['resonance bps', BigInt(fixture.assumptions.resonanceRevenueBps), BigInt(expected.resonanceBps)],
    ['fixed slot count', BigInt(fixture.assumptions.fixedSlotCount), BigInt(expected.slotCount)],
    ['Mine price multiplier', BigInt(fixture.assumptions.minePriceMultiplier), expected.priceMultiplier],
    ['Mine minimum initial price', BigInt(fixture.assumptions.mineMinimumInitialPrice), expected.minimumInitialPrice],
    ['Mine initial TPS', BigInt(fixture.assumptions.mineInitialTps), expected.initialTps],
    ['Mine halving period', BigInt(fixture.assumptions.mineHalvingPeriodSeconds), expected.halvingPeriodSeconds],
    ['Mine tail TPS', BigInt(fixture.assumptions.mineTailTps), expected.tailTps],
    [
      'default Strategy Bribe bps',
      BigInt(fixture.assumptions.defaultStrategyBribeBps),
      BigInt(contractConstants.resonance.defaultBribeBps),
    ],
    [
      'maximum Strategy Bribe bps',
      BigInt(fixture.assumptions.maximumStrategyBribeBps),
      BigInt(contractConstants.resonance.maximumBribeBps),
    ],
    [
      'minimum Strategy Bribe bps',
      BigInt(fixture.assumptions.minimumStrategyBribeBps),
      BigInt(contractConstants.resonance.minimumBribeBps),
    ],
    [
      'incumbent rate lock',
      fixture.mining.staggeredFixedSlots.incumbentRateAfterHalvingPerHour,
      fixture.mining.staggeredFixedSlots.incumbentRatePerHour,
    ],
  ];
  const failures = checks.filter(([, actual, wanted]) => actual !== wanted);
  if (
    !fixture.assumptions.infiniteSupply ||
    !fixture.assumptions.tenureRatesLocked ||
    !fixture.assumptions.redemptionsUseConstantTimeEffectiveSupply ||
    !fixture.assumptions.strategyFundBpsIsDerived ||
    fixture.assumptions.checkpointAllExists
  ) {
    failures.push(['boolean protocol assumptions', false, true]);
  }
  const resonancePins = [
    ['Resonance bps', /uint256 public constant BPS = 10_000;/],
    ['default Bribe bps', /uint256 public constant DEFAULT_BRIBE_BPS = 1_000;/],
    ['maximum Bribe bps', /uint256 public constant MAX_BRIBE_BPS = 2_000;/],
    ['default Bribe state', /uint256 public bribeBps = DEFAULT_BRIBE_BPS;/],
    ['bounded setter', /if \(newBribeBps > MAX_BRIBE_BPS\) revert BribeBpsAboveMaximum\(newBribeBps\);/],
  ];
  for (const [name, pattern] of resonancePins) {
    if (!pattern.test(resonanceSource)) failures.push([name, false, true]);
  }
  const minePins = [
    ['Mine price multiplier source', /uint256 public constant PRICE_MULTIPLIER = 2;/],
    ['Mine minimum initial price source', /uint256 public constant MINIMUM_INITIAL_PRICE = 1e6;/],
    ['Mine initial TPS source', /uint256 public constant INITIAL_TPS = 64 ether;/],
    ['Mine halving period source', /uint256 public constant HALVING_PERIOD = 69 days;/],
    ['Mine tail TPS source', /uint256 public constant TAIL_TPS = 1 ether;/],
    ['Mine start time declaration', /uint256 public immutable startTime;/],
    ['Mine start time assignment', /startTime = block\.timestamp;/],
    ['Mine elapsed-time era calculation', /uint256 halvings = \(block\.timestamp - startTime\) \/ HALVING_PERIOD;/],
    ['Mine prospective rate shift', /tps = INITIAL_TPS >> halvings;/],
    ['Mine tail clamp', /if \(tps < TAIL_TPS\) tps = TAIL_TPS;/],
    [
      'Mine Router-deposit event',
      /event RevenueDeposited\(uint256 indexed index, uint256 indexed epochId, uint256 amount\);/,
    ],
    ['Mine exact Router deposit', /usdg\.safeTransfer\(resonanceRouter, revenueAmount\);/],
  ];
  for (const [name, pattern] of minePins) {
    if (!pattern.test(mineSource)) failures.push([name, false, true]);
  }
  const removedMinePins = [
    ['removed cumulative halving amount', /\bHALVING_AMOUNT\b/],
    ['removed iterative rate state', /\b_rateState\b/],
    ['removed economic-supply rate input', /totalMined\s*\+\s*pendingEmission\s*\(/],
    ['removed synchronous Mine route call', /\.route\(\);/],
    [
      'removed ambiguous Mine revenue event',
      /event RevenueRouted\(uint256 indexed index, uint256 indexed epochId, uint256 amount\);/,
    ],
  ];
  for (const [name, pattern] of removedMinePins) {
    if (pattern.test(mineSource)) failures.push([name, true, false]);
  }
  const routerPins = [
    ['router bps', /uint256 public constant BPS = 10_000;/],
    ['router rate snapshot', /uint256 appliedBribeBps = ICoreResonance\(resonance\)\.bribeBps\(\);/],
    ['router dynamic Bribe amount', /Math\.mulDiv\(amount, appliedBribeBps, BPS\)/],
    ['router weighted carry', /mulmod\(amount, appliedBribeBps, BPS\)/],
    ['router Fund liability', /fundPaymentLiability \+= fundAmount;/],
    ['router Bribe liability', /bribePaymentLiability \+= bribeAmount;/],
    ['router cumulative remainder', /splitRemainder = accumulatedRemainder % BPS;/],
  ];
  for (const [name, pattern] of routerPins) {
    if (!pattern.test(routerSource)) failures.push([name, false, true]);
  }
  const bribePins = [
    ['Bribe reward precision', /uint256 public constant REWARD_PRECISION = 1e36;/],
    [
      'Bribe lifetime cap follows precision',
      /uint256 public constant MAX_LIFETIME_REWARD_AMOUNT = type\(uint256\)\.max \/ REWARD_PRECISION;/,
    ],
  ];
  for (const [name, pattern] of bribePins) {
    if (!pattern.test(bribeSource)) failures.push([name, false, true]);
  }
  if (failures.length)
    throw new Error(
      `Protocol fact check failed:\n${failures.map(([name, a, e]) => `  ${name}: ${a} != ${e}`).join('\n')}`,
    );
  return {
    checks:
      checks.length +
      5 +
      resonancePins.length +
      minePins.length +
      removedMinePins.length +
      routerPins.length +
      bribePins.length,
    genesisLiquidityTokens: contractConstants.gbx.genesisLiquidityTokens,
    slotCount: expected.slotCount,
  };
}
