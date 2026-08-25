import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

export const contractConstants = {
  gbx: {
    source: 'packages/contracts/src/core/GBX.sol',
    initialSupplyTokens: 0,
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
    maxRewardTokens: 16,
    rewardPrecision: 10n ** 36n,
  },
  strategy: {
    source: 'packages/contracts/src/core/Strategy.sol',
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
    buffersBribeShareOnly: true,
  },
};

export const status = {
  editionVersion: 'v0.9',
  editionDate: '25 August 2026',
  contractsCommit: '3ae171b997254b56602298d873b3918d1575b3c7',
  contractsCommitShort: '3ae171b',
  auditCandidateCommit: '3ae171b997254b56602298d873b3918d1575b3c7',
  auditCandidateCommitShort: '3ae171b',
  deployment: 'Not deployed and not authorized for user funds',
  externalAudit: 'V12 export received; complete assurance and release closure pending',
  licensing: 'donut-miner, give.fun, Liquid Signal, and transitive lineage remain unresolved release blockers',
  architectureImplementation:
    'ADRs 0031 and 0033-0050 implemented at the V12 source target; the confirmed findings, provisional Mine emission schedule, and external governance owner remain under review',
};

export function verifyProtocolFacts() {
  const fixturePath = resolve(repoRoot, 'packages/simulations/fixtures/economic-scenarios.json');
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const expected = contractConstants.mine;
  const mineSource = readFileSync(resolve(repoRoot, contractConstants.mine.source), 'utf8');
  const resonanceSource = readFileSync(resolve(repoRoot, contractConstants.resonance.source), 'utf8');
  const strategySource = readFileSync(resolve(repoRoot, contractConstants.strategy.source), 'utf8');
  const routerSource = readFileSync(resolve(repoRoot, contractConstants.bribeRouter.source), 'utf8');
  const bribeSource = readFileSync(resolve(repoRoot, contractConstants.bribe.source), 'utf8');
  const checks = [
    ['initial supply', BigInt(fixture.assumptions.initialSupplyGBXRaw), 0n],
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
    !fixture.assumptions.externalLpUsesOrdinaryStrategySettlement ||
    fixture.assumptions.liquiditySpecificCoreLogic ||
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
    ['Mine minimum initial price source', /uint256 public constant MIN_INITIAL_PRICE = 1e6;/],
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
      /event RevenueDeposited\(uint256 indexed slotIndex, uint256 indexed epochId, uint256 amount\);/,
    ],
    ['Mine nominal Router transfer', /usdg\.safeTransfer\(resonanceRouter, revenueAmount\);/],
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
      /event RevenueRouted\(uint256 indexed slotIndex, uint256 indexed epochId, uint256 amount\);/,
    ],
  ];
  for (const [name, pattern] of removedMinePins) {
    if (pattern.test(mineSource)) failures.push([name, true, false]);
  }
  const strategyPins = [
    ['Strategy bps', /uint256 public constant BPS = 10_000;/],
    ['Strategy rate snapshot', /uint256 appliedBribeBps = configuredResonance\.bribeBps\(\);/],
    ['Strategy Bribe amount', /Math\.mulDiv\(paymentAmount, appliedBribeBps, BPS\)/],
    ['Strategy exhaustive Fund complement', /uint256 fundAmount = paymentAmount - bribeAmount;/],
    ['Strategy direct Fund payment', /paymentToken\.safeTransfer\(fund, fundAmount\);/],
    ['Strategy Bribe buffer payment', /paymentToken\.safeTransfer\(router, bribeAmount\);/],
  ];
  for (const [name, pattern] of strategyPins) {
    if (!pattern.test(strategySource)) failures.push([name, false, true]);
  }
  const routerPins = [
    ['Router complete-balance notification', /bribe\.notifyReward\(address\(paymentToken\), amount\);/],
    ['Router minimum duration gate', /amount < bribe\.REWARD_DURATION\(\)/],
    ['Router active-remaining gate', /amount < bribe\.remainingReward\(address\(paymentToken\)\)/],
  ];
  for (const [name, pattern] of routerPins) {
    if (!pattern.test(routerSource)) failures.push([name, false, true]);
  }
  const bribePins = [
    ['Bribe reward precision', /uint256 public constant REWARD_PRECISION = 1e36;/],
    ['Bribe reward-token limit', /uint256 public constant MAX_REWARD_TOKENS = 16;/],
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
      strategyPins.length +
      routerPins.length +
      bribePins.length,
    initialSupplyTokens: contractConstants.gbx.initialSupplyTokens,
    slotCount: expected.slotCount,
  };
}
