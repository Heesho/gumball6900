import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

export const contractConstants = {
  gbx: { source: 'packages/contracts/src/core/GBX.sol', genesisLiquidityTokens: 20_000_000, unlimitedSupply: true },
  mine: {
    source: 'packages/contracts/src/core/Mine.sol',
    priceDecaySeconds: 3_600,
    previousMinerBps: 8_000,
    resonanceBps: 2_000,
    maxCapacity: 16,
    tenureRatesLocked: true,
  },
  bribe: { source: 'packages/contracts/src/core/Bribe.sol', maxRewardTokens: 8 },
};

export const status = {
  editionVersion: 'v0.4',
  editionDate: '12 August 2026',
  contractsCommit: 'working tree — not release pinned',
  contractsCommitShort: 'uncommitted',
  auditCandidateCommit: 'none for the Mine redesign',
  auditCandidateCommitShort: 'none',
  deployment: 'Not deployed and not authorized for user funds',
  externalAudit: 'Independent external audit not completed',
  licensing: 'Farplace, give.fun, Liquid Signal, and transitive lineage remain unresolved release blockers',
};

export function verifyProtocolFacts() {
  const fixturePath = resolve(repoRoot, 'packages/simulations/fixtures/economic-scenarios.json');
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const expected = contractConstants.mine;
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
  if (failures.length)
    throw new Error(
      `Protocol fact check failed:\n${failures.map(([name, a, e]) => `  ${name}: ${a} != ${e}`).join('\n')}`,
    );
  return {
    checks: checks.length + 4,
    genesisLiquidityTokens: contractConstants.gbx.genesisLiquidityTokens,
    maxCapacity: expected.maxCapacity,
  };
}
