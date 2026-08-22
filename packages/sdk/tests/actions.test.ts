import { decodeFunctionData, getAddress } from 'viem';
import { describe, expect, it } from 'vitest';

import {
  buildApproval,
  buildClaimBribeReward,
  buildClaimMiningPayment,
  buildClaimSelectedBribeRewards,
  buildDelegateSignalVotes,
  buildDistributeRevenue,
  buildFundBurn,
  buildHarvestLiquidityFees,
  buildMine,
  buildMoveSignal,
  buildNotifyRouterBribeReward,
  buildNotifyRevenue,
  buildPayBribeFundReward,
  buildPayRouterFundPayment,
  buildRedemption,
  buildRouteRevenue,
  buildSignal,
  buildSignalWithPermit,
  buildStrategyBuy,
  buildWithdrawSignal,
  bribeAbi,
  bribeRouterAbi,
  fundAbi,
  gbxAbi,
  liquidityPositionAbi,
  mineAbi,
  resonanceAbi,
  resonanceRouterAbi,
  signalGbxAbi,
  strategyAbi,
} from '../src/index.js';

const A = '0x0000000000000000000000000000000000000001';
const B = '0x0000000000000000000000000000000000000002';
const C = '0x0000000000000000000000000000000000000003';
const D = '0x0000000000000000000000000000000000000004';
const R = `0x${'11'.repeat(32)}` as const;
const S = `0x${'22'.repeat(32)}` as const;

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
          message: 'hello from the mine',
          mine: A,
          slotIndex: 2n,
        }).data,
      }),
    ).toMatchObject({
      args: [B, 2n, 7n, 1_000n, 50n, 'hello from the mine'],
      functionName: 'mine',
    });
  });

  it('rejects Mine messages above 280 UTF-8 bytes', () => {
    const parameters = {
      beneficiary: B,
      deadline: 1_000n,
      expectedEpochId: 7n,
      maximumPrice: 50n,
      mine: A,
      slotIndex: 2n,
    } as const;

    expect(() => buildMine({ ...parameters, message: 'a'.repeat(280) })).not.toThrow();
    expect(() => buildMine({ ...parameters, message: 'a'.repeat(281) })).toThrow(RangeError);
    expect(() => buildMine({ ...parameters, message: '🍬'.repeat(71) })).toThrow(RangeError);
  });

  it('targets SignalGBX for mandatory deposit-and-signal, permit, moves, atomic exits, and delegation', () => {
    expect(decodeFunctionData({ abi: signalGbxAbi, data: buildSignal(A, B, 3n).data })).toMatchObject({
      args: [getAddress(B), 3n],
      functionName: 'signal',
    });
    expect(
      decodeFunctionData({
        abi: signalGbxAbi,
        data: buildSignalWithPermit({
          amount: 6n,
          deadline: 1_000n,
          r: R,
          s: S,
          signalGBX: A,
          strategy: B,
          v: 27,
        }).data,
      }),
    ).toMatchObject({
      args: [getAddress(B), 6n, 1_000n, 27, R, S],
      functionName: 'signalWithPermit',
    });
    expect(decodeFunctionData({ abi: signalGbxAbi, data: buildMoveSignal(A, B, C, 2n).data })).toMatchObject({
      args: [getAddress(B), getAddress(C), 2n],
      functionName: 'moveSignal',
    });
    expect(decodeFunctionData({ abi: signalGbxAbi, data: buildWithdrawSignal(A, B, 2n).data })).toMatchObject({
      args: [getAddress(B), 2n],
      functionName: 'withdrawSignal',
    });
    expect(decodeFunctionData({ abi: signalGbxAbi, data: buildDelegateSignalVotes(A, D).data })).toMatchObject({
      args: [getAddress(D)],
      functionName: 'delegate',
    });
  });

  it('encodes Resonance routing, distribution, and notification', () => {
    expect(decodeFunctionData({ abi: resonanceRouterAbi, data: buildRouteRevenue(A).data }).functionName).toBe('route');
    expect(decodeFunctionData({ abi: resonanceAbi, data: buildDistributeRevenue(A, B).data })).toMatchObject({
      args: [getAddress(B)],
      functionName: 'distribute',
    });
    expect(decodeFunctionData({ abi: resonanceAbi, data: buildNotifyRevenue(A, 11n).data })).toMatchObject({
      args: [11n],
      functionName: 'notifyRevenue',
    });
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

  it('encodes liquidity maintenance without a mining checkpoint action', () => {
    expect(
      decodeFunctionData({ abi: liquidityPositionAbi, data: buildHarvestLiquidityFees(A).data }).functionName,
    ).toBe('harvestFees');
  });

  it('encodes selective Bribe claims and retryable fixed-liability settlement', () => {
    expect(decodeFunctionData({ abi: bribeAbi, data: buildClaimBribeReward(A, B, C).data })).toMatchObject({
      args: [B, C],
      functionName: 'claimReward',
    });
    expect(decodeFunctionData({ abi: bribeAbi, data: buildClaimSelectedBribeRewards(A, B, [C]).data })).toMatchObject({
      args: [B, [C]],
      functionName: 'claimRewards',
    });
    expect(decodeFunctionData({ abi: bribeRouterAbi, data: buildPayRouterFundPayment(A).data }).functionName).toBe(
      'payFundPayment',
    );
    expect(decodeFunctionData({ abi: bribeRouterAbi, data: buildNotifyRouterBribeReward(A).data }).functionName).toBe(
      'notifyBribeReward',
    );
    expect(decodeFunctionData({ abi: bribeAbi, data: buildPayBribeFundReward(A, C).data })).toMatchObject({
      args: [C],
      functionName: 'payFundReward',
    });
  });
});
