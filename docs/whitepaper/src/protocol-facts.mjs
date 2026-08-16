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
    maxCapacity: 16,
    tenureRatesLocked: true,
  },
  bribe: { source: 'packages/contracts/src/core/Bribe.sol', maxRewardTokens: 8 },
  bribeRouter: {
    source: 'packages/contracts/src/core/BribeRouter.sol',
    bps: 10_000,
    fundBps: 9_000,
    bribeBps: 1_000,
    cumulativeSplit: true,
  },
};

export const status = {
  editionVersion: 'v0.6',
  editionDate: '16 August 2026',
  contractsCommit: 'working tree — not release pinned',
  contractsCommitShort: 'uncommitted',
  auditCandidateCommit: 'none for the Mine redesign',
  auditCandidateCommitShort: 'none',
  deployment: 'Not deployed and not authorized for user funds',
  externalAudit: 'Independent external audit not completed',
  licensing: 'Farplace, give.fun, Liquid Signal, and transitive lineage remain unresolved release blockers',
  architectureImplementation: 'ADR 0031 and ADR 0032 implemented in the development tree; review pending',
};

export function verifyProtocolFacts() {
  const fixturePath = resolve(repoRoot, 'packages/simulations/fixtures/economic-scenarios.json');
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const expected = contractConstants.mine;
  const routerSource = readFileSync(resolve(repoRoot, contractConstants.bribeRouter.source), 'utf8');
  const checks = [
    ['genesis allocation', BigInt(fixture.assumptions.genesisLiquidityAllocationGBXRaw), 20_000_000n * 10n ** 18n],
    ['price decay', BigInt(fixture.assumptions.priceDecaySeconds), BigInt(expected.priceDecaySeconds)],
    ['previous miner bps', BigInt(fixture.assumptions.previousMinerBps), BigInt(expected.previousMinerBps)],
    ['resonance bps', BigInt(fixture.assumptions.resonanceRevenueBps), BigInt(expected.resonanceBps)],
    ['capacity cap', BigInt(fixture.assumptions.maximumCapacity), BigInt(expected.maxCapacity)],
    [
      'incumbent rate lock',
      fixture.mining.capacityExpansion.incumbentRateAfterExpansionPerHour,
      fixture.mining.capacityExpansion.incumbentRatePerHour,
    ],
  ];
  const failures = checks.filter(([, actual, wanted]) => actual !== wanted);
  if (
    !fixture.assumptions.infiniteSupply ||
    !fixture.assumptions.tenureRatesLocked ||
    !fixture.assumptions.capacityOnlyIncreases ||
    !fixture.assumptions.redemptionsCheckpointAllSlots
  ) {
    failures.push(['boolean protocol assumptions', false, true]);
  }
  const routerPins = [
    ['router bps', /uint256 public constant BPS = 10_000;/],
    ['router Fund bps', /uint256 public constant FUND_BPS = 9_000;/],
    ['router Bribe bps', /uint256 public constant BRIBE_BPS = 1_000;/],
    ['router Fund liability', /fundPaymentLiability \+= fundAmount;/],
    ['router Bribe liability', /bribePaymentLiability \+= bribeAmount;/],
    ['router cumulative remainder', /splitRemainder = accumulatedRemainder % BPS;/],
  ];
  for (const [name, pattern] of routerPins) {
    if (!pattern.test(routerSource)) failures.push([name, false, true]);
  }
  if (failures.length)
    throw new Error(
      `Protocol fact check failed:\n${failures.map(([name, a, e]) => `  ${name}: ${a} != ${e}`).join('\n')}`,
    );
  return {
    checks: checks.length + 4 + routerPins.length,
    genesisLiquidityTokens: contractConstants.gbx.genesisLiquidityTokens,
    maxCapacity: expected.maxCapacity,
  };
}
