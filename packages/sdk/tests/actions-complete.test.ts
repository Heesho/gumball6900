import { decodeFunctionData, type Abi } from 'viem';
import { describe, expect, it } from 'vitest';

import {
  acquisitionStrategyAbi,
  allocationVoterAbi,
  buildAcquisitionFill,
  buildApproval,
  buildBuybackFill,
  buildCancelPendingSignals,
  buildCheckpointUser,
  buildCloseGenesisContributions,
  buildGenesisClaim,
  buildGenesisClaimBatch,
  buildGenesisContribution,
  buildGenesisRefund,
  buildGenesisSponsorFunding,
  buildLiquidityMigration,
  buildManagerRewardClaim,
  buildManagerRewardReceiver,
  buildManagerRewardTerminalDustSweep,
  buildMiningClaim,
  buildMiningClaimBatch,
  buildMiningContribution,
  buildMiningRefund,
  buildOpenGenesisContributions,
  buildRedemption,
  buildResetSignals,
  buildRestartAcquisitionAuction,
  buildRestartBuybackAuction,
  buildRouterRedemption,
  buildRouterRedemptionWithPermit,
  buildRouterStake,
  buildRouterStakeWithPermit,
  buildSettleCurrentMiningEpoch,
  buildSettleGenesis,
  buildSignal,
  buildStake,
  buildUnstake,
  buybackStrategyAbi,
  gbxAbi,
  genesisBootstrapAbi,
  genesisClaimsAbi,
  gumBallRouterAbi,
  gumBallVaultAbi,
  liquidityManagerAbi,
  managerRewardsAbi,
  miningClaimsAbi,
  miningPoolAbi,
  stakedGbxAbi,
  type ContractTransaction,
} from '../src/index.js';

const A = '0x0000000000000000000000000000000000000001';
const B = '0x0000000000000000000000000000000000000002';
const C = '0x0000000000000000000000000000000000000003';
const D = '0x0000000000000000000000000000000000000004';
const R = `0x${'11'.repeat(32)}` as const;
const S = `0x${'22'.repeat(32)}` as const;
const SIGNATURE = `${R}${S.slice(2)}1b` as const;

const migrationPlan = {
  deadline: 1_000n,
  destinationPoolKey: { currency0: B, currency1: C, fee: 3_000, tickSpacing: 60, hooks: D },
  removals: [{ positionId: 7n, amount0Min: 10n, amount1Min: 20n }],
  replacements: [{ tickLower: -120, tickUpper: 120, liquidity: 30n, amount0Max: 40n, amount1Max: 50n }],
} as const;

interface EncodingCase {
  readonly abi: Abi;
  readonly args: readonly unknown[];
  readonly build: () => ContractTransaction;
  readonly functionName: string;
  readonly name: string;
  readonly to: string;
}

const encodingCases: readonly EncodingCase[] = [
  {
    name: 'approval',
    abi: gbxAbi,
    build: () => buildApproval(A, B, 50n),
    functionName: 'approve',
    args: [B, 50n],
    to: A,
  },
  {
    name: 'genesis contribution',
    abi: genesisBootstrapAbi,
    build: () => buildGenesisContribution(A, B, 50n),
    functionName: 'contribute',
    args: [B, 50n],
    to: A,
  },
  {
    name: 'genesis sponsor funding',
    abi: genesisBootstrapAbi,
    build: () => buildGenesisSponsorFunding(A, 50n),
    functionName: 'fundSponsor',
    args: [50n],
    to: A,
  },
  {
    name: 'open genesis contributions',
    abi: genesisBootstrapAbi,
    build: () => buildOpenGenesisContributions(A),
    functionName: 'openContributions',
    args: [],
    to: A,
  },
  {
    name: 'close genesis contributions',
    abi: genesisBootstrapAbi,
    build: () => buildCloseGenesisContributions(A),
    functionName: 'close',
    args: [],
    to: A,
  },
  {
    name: 'settle genesis',
    abi: genesisBootstrapAbi,
    build: () => buildSettleGenesis(A, 1n << 96n),
    functionName: 'settle',
    args: [1n << 96n],
    to: A,
  },
  {
    name: 'genesis refund',
    abi: genesisBootstrapAbi,
    build: () => buildGenesisRefund(A, B),
    functionName: 'refund',
    args: [B],
    to: A,
  },
  {
    name: 'genesis claim',
    abi: genesisClaimsAbi,
    build: () => buildGenesisClaim(A, B),
    functionName: 'claim',
    args: [B],
    to: A,
  },
  {
    name: 'genesis claim batch',
    abi: genesisClaimsAbi,
    build: () => buildGenesisClaimBatch(A, [B, C]),
    functionName: 'claimBatch',
    args: [[B, C]],
    to: A,
  },
  {
    name: 'mining contribution',
    abi: miningPoolAbi,
    build: () => buildMiningContribution(A, B, 50n),
    functionName: 'contribute',
    args: [B, 50n],
    to: A,
  },
  {
    name: 'mining claim batch',
    abi: miningClaimsAbi,
    build: () => buildMiningClaimBatch(A, B, [1n, 4n, 9n]),
    functionName: 'claimBatch',
    args: [B, [1n, 4n, 9n]],
    to: A,
  },
  {
    name: 'mining claim',
    abi: miningClaimsAbi,
    build: () => buildMiningClaim(A, B, 7n),
    functionName: 'claim',
    args: [B, 7n],
    to: A,
  },
  {
    name: 'mining refund',
    abi: miningPoolAbi,
    build: () => buildMiningRefund(A, B, 7n),
    functionName: 'refund',
    args: [B, 7n],
    to: A,
  },
  {
    name: 'settle current mining epoch',
    abi: miningPoolAbi,
    build: () => buildSettleCurrentMiningEpoch(A),
    functionName: 'settleCurrentEpoch',
    args: [],
    to: A,
  },
  { name: 'stake', abi: stakedGbxAbi, build: () => buildStake(A, 50n), functionName: 'stake', args: [50n], to: A },
  {
    name: 'router stake',
    abi: gumBallRouterAbi,
    build: () => buildRouterStake(A, 50n),
    functionName: 'stake',
    args: [50n],
    to: A,
  },
  {
    name: 'router stake with permit',
    abi: gumBallRouterAbi,
    build: () => buildRouterStakeWithPermit(A, 50n, 1_000n, SIGNATURE),
    functionName: 'stakeWithPermit',
    args: [50n, 1_000n, 27, R, S],
    to: A,
  },
  {
    name: 'unstake',
    abi: stakedGbxAbi,
    build: () => buildUnstake(A, 50n),
    functionName: 'unstake',
    args: [50n],
    to: A,
  },
  {
    name: 'signal',
    abi: allocationVoterAbi,
    build: () => buildSignal(A, [B, C], [3n, 7n]),
    functionName: 'signal',
    args: [
      [B, C],
      [3n, 7n],
    ],
    to: A,
  },
  {
    name: 'reset signals',
    abi: allocationVoterAbi,
    build: () => buildResetSignals(A),
    functionName: 'resetSignals',
    args: [],
    to: A,
  },
  {
    name: 'cancel pending signals',
    abi: allocationVoterAbi,
    build: () => buildCancelPendingSignals(A),
    functionName: 'cancelPendingSignals',
    args: [],
    to: A,
  },
  {
    name: 'checkpoint user',
    abi: allocationVoterAbi,
    build: () => buildCheckpointUser(A, B),
    functionName: 'checkpointUser',
    args: [B],
    to: A,
  },
  {
    name: 'manager reward claim',
    abi: managerRewardsAbi,
    build: () => buildManagerRewardClaim(A, B),
    functionName: 'claim',
    args: [B],
    to: A,
  },
  {
    name: 'manager reward receiver',
    abi: managerRewardsAbi,
    build: () => buildManagerRewardReceiver(A, B),
    functionName: 'setRewardReceiver',
    args: [B],
    to: A,
  },
  {
    name: 'manager reward terminal dust sweep',
    abi: managerRewardsAbi,
    build: () => buildManagerRewardTerminalDustSweep(A, 2n, 3n),
    functionName: 'sweepTerminalDust',
    args: [2n, 3n],
    to: A,
  },
  {
    name: 'redemption',
    abi: gumBallVaultAbi,
    build: () => buildRedemption(A, 50n, B),
    functionName: 'redeem',
    args: [50n, B],
    to: A,
  },
  {
    name: 'router redemption',
    abi: gumBallRouterAbi,
    build: () => buildRouterRedemption(A, 50n, B),
    functionName: 'redeem',
    args: [50n, B],
    to: A,
  },
  {
    name: 'router redemption with permit',
    abi: gumBallRouterAbi,
    build: () => buildRouterRedemptionWithPermit(A, 50n, B, 1_000n, SIGNATURE),
    functionName: 'redeemWithPermit',
    args: [50n, B, 1_000n, 27, R, S],
    to: A,
  },
  {
    name: 'acquisition fill',
    abi: acquisitionStrategyAbi,
    build: () =>
      buildAcquisitionFill({
        deadline: 1_000n,
        expectedAuctionId: 7n,
        maximumTargetAmountRaw: 42n,
        strategy: A,
        usdGAmountRaw: 50n,
        usdGReceiver: B,
      }),
    functionName: 'fill',
    args: [7n, 50n, 42n, B, 1_000n],
    to: A,
  },
  {
    name: 'buyback fill',
    abi: buybackStrategyAbi,
    build: () =>
      buildBuybackFill({
        deadline: 1_000n,
        expectedAuctionId: 7n,
        maximumTargetAmountRaw: 42n,
        strategy: A,
        usdGAmountRaw: 50n,
        usdGReceiver: B,
      }),
    functionName: 'fill',
    args: [7n, 50n, 42n, B, 1_000n],
    to: A,
  },
  {
    name: 'restart acquisition auction',
    abi: acquisitionStrategyAbi,
    build: () => buildRestartAcquisitionAuction(A),
    functionName: 'restartExpiredAuction',
    args: [],
    to: A,
  },
  {
    name: 'restart buyback auction',
    abi: buybackStrategyAbi,
    build: () => buildRestartBuybackAuction(A),
    functionName: 'restartExpiredAuction',
    args: [],
    to: A,
  },
  {
    name: 'liquidity migration',
    abi: liquidityManagerAbi,
    build: () => buildLiquidityMigration(A, migrationPlan),
    functionName: 'migrateLiquidity',
    args: [migrationPlan],
    to: A,
  },
];

describe('complete public action-builder encoding', () => {
  it.each(encodingCases)('encodes $name', ({ abi, args, build, functionName, to }) => {
    const transaction = build();
    const decoded = decodeFunctionData({ abi, data: transaction.data });
    expect(transaction).toMatchObject({ to, value: 0n });
    expect(decoded.functionName).toBe(functionName);
    expect(decoded.args ?? []).toEqual(args);
  });

  it('allows a zero approval reset but rejects invalid uint256 approvals', () => {
    const decoded = decodeFunctionData({ abi: gbxAbi, data: buildApproval(A, B, 0n).data });
    expect(decoded.args).toEqual([B, 0n]);
    expect(() => buildApproval(A, B, -1n)).toThrow();
    expect(() => buildApproval(A, B, 1n << 256n)).toThrow('uint256');
  });

  it('bounds terminal-dust sweep identifiers to their uint64 ABI types', () => {
    expect(() => buildManagerRewardTerminalDustSweep(A, -1n, 0n)).toThrow();
    expect(() => buildManagerRewardTerminalDustSweep(A, 0n, 1n << 64n)).toThrow('uint64');
  });

  it('requires a positive uint160 official-SDK genesis price witness', () => {
    expect(() => buildSettleGenesis(A, 0n)).toThrow();
    expect(() => buildSettleGenesis(A, 1n << 160n)).toThrow('uint160');
  });

  it.each([
    ['genesis contribution', () => buildGenesisContribution(A, B, 0n)],
    ['genesis sponsor funding', () => buildGenesisSponsorFunding(A, 0n)],
    ['mining contribution', () => buildMiningContribution(A, B, 0n)],
    ['stake', () => buildStake(A, 0n)],
    ['router stake', () => buildRouterStake(A, 0n)],
    ['router permit stake amount', () => buildRouterStakeWithPermit(A, 0n, 1_000n, SIGNATURE)],
    ['router permit stake deadline', () => buildRouterStakeWithPermit(A, 1n, 0n, SIGNATURE)],
    ['unstake', () => buildUnstake(A, 0n)],
    ['redemption', () => buildRedemption(A, 0n, B)],
    ['router redemption', () => buildRouterRedemption(A, 0n, B)],
    ['router permit redemption amount', () => buildRouterRedemptionWithPermit(A, 0n, B, 1_000n, SIGNATURE)],
    ['router permit redemption deadline', () => buildRouterRedemptionWithPermit(A, 1n, B, 0n, SIGNATURE)],
    [
      'acquisition fill USDG amount',
      () =>
        buildAcquisitionFill({
          deadline: 1n,
          expectedAuctionId: 1n,
          maximumTargetAmountRaw: 1n,
          strategy: A,
          usdGAmountRaw: 0n,
          usdGReceiver: B,
        }),
    ],
    [
      'acquisition fill target amount',
      () =>
        buildAcquisitionFill({
          deadline: 1n,
          expectedAuctionId: 1n,
          maximumTargetAmountRaw: 0n,
          strategy: A,
          usdGAmountRaw: 1n,
          usdGReceiver: B,
        }),
    ],
    [
      'buyback fill deadline',
      () =>
        buildBuybackFill({
          deadline: 0n,
          expectedAuctionId: 1n,
          maximumTargetAmountRaw: 1n,
          strategy: A,
          usdGAmountRaw: 1n,
          usdGReceiver: B,
        }),
    ],
  ] as const)('rejects non-positive %s', (_name, build) => {
    expect(build).toThrow('must be positive');
  });

  it('rejects malformed permit signatures in both bounded router flows', () => {
    expect(() => buildRouterStakeWithPermit(A, 1n, 1n, '0x12')).toThrow('65-byte');
    expect(() => buildRouterRedemptionWithPermit(A, 1n, B, 1n, '0x12')).toThrow('65-byte');
  });

  it('enforces claim-batch and epoch identifier bounds', () => {
    expect(() => buildGenesisClaimBatch(A, [])).toThrow('between 1 and 64');
    expect(() =>
      buildGenesisClaimBatch(
        A,
        Array.from({ length: 65 }, () => B),
      ),
    ).toThrow('between 1 and 64');
    expect(() => buildGenesisClaimBatch(A, [B, B])).toThrow('duplicate beneficiary');
    expect(() => buildMiningClaimBatch(A, B, [])).toThrow('between 1 and 64');
    expect(() =>
      buildMiningClaimBatch(
        A,
        B,
        Array.from({ length: 65 }, (_, index) => BigInt(index)),
      ),
    ).toThrow('between 1 and 64');
    expect(() => buildMiningClaimBatch(A, B, [1n, 1n])).toThrow('duplicate epochId');
    expect(() => buildMiningClaimBatch(A, B, [1n << 256n])).toThrow('uint256');
    expect(() => buildMiningClaim(A, B, -1n)).toThrow();
    expect(() => buildMiningRefund(A, B, 1n << 256n)).toThrow('uint256');
  });

  it('enforces signal cardinality, uniqueness, positivity, and uint256 totals', () => {
    expect(() => buildSignal(A, [], [])).toThrow('between 1 and 16');
    expect(() => buildSignal(A, [B], [1n, 2n])).toThrow('matching lengths');
    expect(() =>
      buildSignal(
        A,
        Array.from({ length: 17 }, () => B),
        Array.from({ length: 17 }, () => 1n),
      ),
    ).toThrow('between 1 and 16');
    expect(() => buildSignal(A, [B, B], [1n, 1n])).toThrow('duplicate strategy');
    expect(() => buildSignal(A, [B], [0n])).toThrow('must be positive');
    expect(() => buildSignal(A, [B, C], [(1n << 256n) - 1n, 1n])).toThrow('totalRelativeWeight');
  });

  it('enforces uint64 auction IDs and every bounded migration dimension', () => {
    expect(() =>
      buildAcquisitionFill({
        deadline: 1n,
        expectedAuctionId: 1n << 64n,
        maximumTargetAmountRaw: 1n,
        strategy: A,
        usdGAmountRaw: 1n,
        usdGReceiver: B,
      }),
    ).toThrow('uint64');
    expect(() => buildLiquidityMigration(A, { ...migrationPlan, removals: [] })).toThrow('removals length');
    expect(() => buildLiquidityMigration(A, { ...migrationPlan, replacements: [] })).toThrow('replacements length');
    expect(() =>
      buildLiquidityMigration(A, {
        ...migrationPlan,
        removals: [migrationPlan.removals[0], migrationPlan.removals[0]],
      }),
    ).toThrow('duplicate migration positionId');
    expect(() =>
      buildLiquidityMigration(A, {
        ...migrationPlan,
        destinationPoolKey: { ...migrationPlan.destinationPoolKey, fee: 1 << 24 },
      }),
    ).toThrow('uint24');
    expect(() =>
      buildLiquidityMigration(A, {
        ...migrationPlan,
        destinationPoolKey: { ...migrationPlan.destinationPoolKey, currency0: C, currency1: B },
      }),
    ).toThrow('address-sorted');
    expect(() =>
      buildLiquidityMigration(A, {
        ...migrationPlan,
        replacements: [{ ...migrationPlan.replacements[0], tickLower: 120, tickUpper: 120 }],
      }),
    ).toThrow('tickLower');
    expect(() =>
      buildLiquidityMigration(A, {
        ...migrationPlan,
        replacements: [{ ...migrationPlan.replacements[0], liquidity: 0n }],
      }),
    ).toThrow('must be positive');
    expect(() =>
      buildLiquidityMigration(A, {
        ...migrationPlan,
        removals: [{ ...migrationPlan.removals[0], amount0Min: 1n << 128n }],
      }),
    ).toThrow('uint128');
    expect(() => buildLiquidityMigration(A, { ...migrationPlan, deadline: 0n })).toThrow('must be positive');
  });
});
