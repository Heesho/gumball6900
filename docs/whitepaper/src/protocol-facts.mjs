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
  editionVersion: 'v0.7',
  editionDate: '21 August 2026',
  contractsCommit: '4938773f8fd9540a5486c23cfd4098dee6d75bfa',
  contractsCommitShort: '4938773',
  auditCandidateCommit: 'none for the current architecture',
  auditCandidateCommitShort: 'none',
  deployment: 'Not deployed and not authorized for user funds',
  externalAudit: 'Independent external audit not completed',
  licensing: 'Farplace, give.fun, Liquid Signal, and transitive lineage remain unresolved release blockers',
  architectureImplementation:
    'ADRs 0031 and 0034-0037 implemented in the development tree; external governance owner unselected and review pending',
};

export function verifyProtocolFacts() {
  const fixturePath = resolve(repoRoot, 'packages/simulations/fixtures/economic-scenarios.json');
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const expected = contractConstants.mine;
  const resonanceSource = readFileSync(resolve(repoRoot, contractConstants.resonance.source), 'utf8');
  const routerSource = readFileSync(resolve(repoRoot, contractConstants.bribeRouter.source), 'utf8');
  const bribeSource = readFileSync(resolve(repoRoot, contractConstants.bribe.source), 'utf8');
  const checks = [
    ['genesis allocation', BigInt(fixture.assumptions.genesisLiquidityAllocationGBXRaw), 20_000_000n * 10n ** 18n],
    ['price decay', BigInt(fixture.assumptions.priceDecaySeconds), BigInt(expected.priceDecaySeconds)],
    ['previous miner bps', BigInt(fixture.assumptions.previousMinerBps), BigInt(expected.previousMinerBps)],
    ['resonance bps', BigInt(fixture.assumptions.resonanceRevenueBps), BigInt(expected.resonanceBps)],
    ['fixed slot count', BigInt(fixture.assumptions.fixedSlotCount), BigInt(expected.slotCount)],
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
    checks: checks.length + 5 + resonancePins.length + routerPins.length + bribePins.length,
    genesisLiquidityTokens: contractConstants.gbx.genesisLiquidityTokens,
    slotCount: expected.slotCount,
  };
}
