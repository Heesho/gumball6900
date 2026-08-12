import { decodeFunctionData, getAddress } from 'viem';
import { describe, expect, it } from 'vitest';

import {
  buildApproval,
  buildAddSignal,
  buildAddSignalMany,
  buildCheckpointMining,
  buildClaimMiningPayment,
  buildHarvestLiquidityFees,
  buildClaimBribeReward,
  buildClaimSelectedBribeRewards,
  buildFundBurn,
  buildIncreaseMiningCapacity,
  buildIndexPendingRevenue,
  buildPayBribeFundReward,
  buildPayFundRevenue,
  buildPayRouterFundPayment,
  buildRedemption,
  buildRemoveSignal,
  buildRemoveSignalMany,
  buildMine,
  buildStrategyBuy,
  buildSyncRevenue,
  bribeAbi,
  bribeRouterAbi,
  fundAbi,
  gbxAbi,
  liquidityPositionAbi,
  mineAbi,
  strategyAbi,
  resonanceAbi,
} from '../src/index.js';

const A = '0x0000000000000000000000000000000000000001';
const B = '0x0000000000000000000000000000000000000002';
const C = '0x0000000000000000000000000000000000000003';

describe('minimal typed transaction builders', () => {
  it('encodes a standard approval and protected Mine handoff', () => {
    expect(decodeFunctionData({ abi: gbxAbi, data: buildApproval(A, B, 50n).data })).toMatchObject({
      args: [B, 50n],
      functionName: 'approve',
    });
    expect(
      decodeFunctionData({
        abi: mineAbi,
        data: buildMine({
          beneficiary: B,
          deadline: 1_000n,
          expectedEpochId: 7n,
          maximumPrice: 50n,
          mine: A,
          slotIndex: 2n,
        }).data,
      }),
    ).toMatchObject({
      args: [B, 2n, 7n, 1_000n, 50n],
      functionName: 'mine',
    });
  });

  it('encodes absolute scalar and caller-bounded batch signal deltas', () => {
    expect(decodeFunctionData({ abi: resonanceAbi, data: buildAddSignal(A, B, 3n).data })).toMatchObject({
      args: [getAddress(B), 3n],
      functionName: 'addSignal',
    });
    expect(decodeFunctionData({ abi: resonanceAbi, data: buildRemoveSignal(A, B, 2n).data })).toMatchObject({
      args: [getAddress(B), 2n],
      functionName: 'removeSignal',
    });

    const added = decodeFunctionData({ abi: resonanceAbi, data: buildAddSignalMany(A, [B, C], [3n, 7n]).data });
    expect(added.functionName).toBe('addSignalMany');
    expect(added.args).toEqual([
      [getAddress(B), getAddress(C)],
      [3n, 7n],
    ]);

    const removed = decodeFunctionData({ abi: resonanceAbi, data: buildRemoveSignalMany(A, [B, B], [1n, 2n]).data });
    expect(removed.functionName).toBe('removeSignalMany');
    expect(removed.args).toEqual([
      [getAddress(B), getAddress(B)],
      [1n, 2n],
    ]);
  });

  it('encodes caller-selected Fund redemption and accumulated GBX burning', () => {
    const decoded = decodeFunctionData({ abi: fundAbi, data: buildRedemption(A, 50n, B, [C]).data });
    expect(decoded).toMatchObject({ args: [50n, B, [C]], functionName: 'redeem' });
    expect(decodeFunctionData({ abi: fundAbi, data: buildFundBurn(A, 10n).data })).toMatchObject({
      args: [10n],
      functionName: 'burnGBX',
    });
  });

  it('encodes a bounded Strategy purchase', () => {
    const parameters = {
      deadline: 1_000n,
      expectedEpochId: 7n,
      maximumPayment: 11n,
      revenueReceiver: B,
      strategy: A,
    } as const;
    expect(decodeFunctionData({ abi: strategyAbi, data: buildStrategyBuy(parameters).data })).toMatchObject({
      args: [B, 7n, 1_000n, 11n],
      functionName: 'buy',
    });
  });

  it('encodes permissionless mining claims for the fixed beneficiary', () => {
    expect(decodeFunctionData({ abi: mineAbi, data: buildClaimMiningPayment(A, B).data })).toMatchObject({
      args: [B],
      functionName: 'claim',
    });
  });

  it('encodes mining checkpoint, bounded capacity governance, and liquidity maintenance', () => {
    expect(decodeFunctionData({ abi: mineAbi, data: buildCheckpointMining(A).data })).toMatchObject({
      functionName: 'checkpointAll',
    });
    expect(decodeFunctionData({ abi: mineAbi, data: buildIncreaseMiningCapacity(A, 3n).data })).toMatchObject({
      args: [3n],
      functionName: 'increaseCapacity',
    });
    expect(
      decodeFunctionData({ abi: liquidityPositionAbi, data: buildHarvestLiquidityFees(A).data }).functionName,
    ).toBe('harvestFees');
  });

  it('encodes selective reward claims and retryable fixed-liability settlement', () => {
    expect(decodeFunctionData({ abi: bribeAbi, data: buildClaimBribeReward(A, B, C).data })).toMatchObject({
      args: [B, C],
      functionName: 'claimReward',
    });
    expect(decodeFunctionData({ abi: bribeAbi, data: buildClaimSelectedBribeRewards(A, B, [C]).data })).toMatchObject({
      args: [B, [C]],
      functionName: 'claimRewards',
    });
    expect(decodeFunctionData({ abi: resonanceAbi, data: buildSyncRevenue(A).data }).functionName).toBe('syncRevenue');
    expect(decodeFunctionData({ abi: resonanceAbi, data: buildIndexPendingRevenue(A).data }).functionName).toBe(
      'indexPendingRevenue',
    );
    expect(decodeFunctionData({ abi: resonanceAbi, data: buildPayFundRevenue(A).data }).functionName).toBe(
      'payFundRevenue',
    );
    expect(decodeFunctionData({ abi: bribeRouterAbi, data: buildPayRouterFundPayment(A).data }).functionName).toBe(
      'payFundPayment',
    );
    expect(decodeFunctionData({ abi: bribeAbi, data: buildPayBribeFundReward(A, C).data })).toMatchObject({
      args: [C],
      functionName: 'payFundReward',
    });
  });
});
