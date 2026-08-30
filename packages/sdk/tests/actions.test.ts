import { decodeFunctionData, getAddress } from 'viem';
import { describe, expect, it } from 'vitest';

import {
  buildAcceptOwnership,
  buildAddSignal,
  buildAddSignalMany,
  buildApproval,
  buildBeginOwnershipTransfer,
  buildCancelOwnershipTransfer,
  buildClaimAllBribeRewards,
  buildClaimBribeReward,
  buildClaimBribeRewards,
  buildClaimMiningPayment,
  buildDelegateSignalVotes,
  buildDistributeRevenue,
  buildFundBurn,
  buildGBXLaunch,
  buildMine,
  buildRemoveSignal,
  buildRemoveSignalMany,
  buildRedemption,
  buildRouteBribeRewards,
  buildRouteRevenue,
  buildSetMineResonanceRouter,
  buildStrategyBuy,
  bribeAbi,
  bribeRouterAbi,
  fundAbi,
  gbxAbi,
  gbxLauncherAbi,
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

  it('encodes the one-shot GBX launch with a nonzero final owner', () => {
    expect(decodeFunctionData({ abi: gbxLauncherAbi, data: buildGBXLaunch(A, B).data })).toMatchObject({
      args: [B],
      functionName: 'launch',
    });
    expect(() => buildGBXLaunch('0x0000000000000000000000000000000000000000', B)).toThrow(RangeError);
    expect(() => buildGBXLaunch(A, '0x0000000000000000000000000000000000000000')).toThrow(RangeError);
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

  it('targets SignalGBX for scalar and batched additions, removals, and delegation', () => {
    expect(decodeFunctionData({ abi: signalGbxAbi, data: buildAddSignal(A, B, 3n).data })).toMatchObject({
      args: [getAddress(B), 3n],
      functionName: 'addSignal',
    });
    expect(
      decodeFunctionData({
        abi: signalGbxAbi,
        data: buildAddSignalMany(A, [
          { strategy: B, amount: 2n },
          { strategy: C, amount: 4n },
          { strategy: B, amount: 3n },
        ]).data,
      }),
    ).toMatchObject({
      args: [
        [
          { strategy: getAddress(B), amount: 5n },
          { strategy: getAddress(C), amount: 4n },
        ],
      ],
      functionName: 'addSignalMany',
    });
    expect(decodeFunctionData({ abi: signalGbxAbi, data: buildRemoveSignal(A, B, 2n).data })).toMatchObject({
      args: [getAddress(B), 2n],
      functionName: 'removeSignal',
    });
    expect(
      decodeFunctionData({
        abi: signalGbxAbi,
        data: buildRemoveSignalMany(A, [
          { strategy: B, amount: 1n },
          { strategy: C, amount: 2n },
        ]).data,
      }),
    ).toMatchObject({
      args: [
        [
          { strategy: getAddress(B), amount: 1n },
          { strategy: getAddress(C), amount: 2n },
        ],
      ],
      functionName: 'removeSignalMany',
    });
    expect(decodeFunctionData({ abi: signalGbxAbi, data: buildDelegateSignalVotes(A, D).data })).toMatchObject({
      args: [getAddress(D)],
      functionName: 'delegate',
    });
  });

  it('rejects empty, zero, and zero-Strategy batches before wallet submission', () => {
    expect(() => buildAddSignal(A, '0x0000000000000000000000000000000000000000', 1n)).toThrow(RangeError);
    expect(() => buildRemoveSignal(A, '0x0000000000000000000000000000000000000000', 1n)).toThrow(RangeError);
    expect(() => buildAddSignalMany(A, [])).toThrow(RangeError);
    expect(() => buildAddSignalMany(A, [{ strategy: B, amount: 0n }])).toThrow(RangeError);
    expect(() =>
      buildRemoveSignalMany(A, [{ strategy: '0x0000000000000000000000000000000000000000', amount: 1n }]),
    ).toThrow(RangeError);
    expect(() => buildClaimBribeRewards(A, [])).toThrow(RangeError);
    expect(() => buildClaimBribeRewards(A, ['0x0000000000000000000000000000000000000000'])).toThrow(RangeError);
  });

  it('encodes Resonance routing and distribution', () => {
    expect(decodeFunctionData({ abi: resonanceRouterAbi, data: buildRouteRevenue(A).data }).functionName).toBe('route');
    expect(decodeFunctionData({ abi: resonanceAbi, data: buildDistributeRevenue(A, B).data })).toMatchObject({
      args: [getAddress(B)],
      functionName: 'distributeRevenue',
    });
    expect(decodeFunctionData({ abi: resonanceAbi, data: buildClaimBribeRewards(A, [B, C, B]).data })).toMatchObject({
      args: [[getAddress(B), getAddress(C), getAddress(B)]],
      functionName: 'claimBribeRewards',
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
      functionName: 'claimMinerPayment',
    });
  });

  it('encodes governed Mine revenue migration and two-step Mine or Resonance ownership', () => {
    expect(decodeFunctionData({ abi: mineAbi, data: buildSetMineResonanceRouter(A, B).data })).toMatchObject({
      args: [B],
      functionName: 'setResonanceRouter',
    });
    expect(decodeFunctionData({ abi: resonanceAbi, data: buildBeginOwnershipTransfer(A, C).data })).toMatchObject({
      args: [C],
      functionName: 'transferOwnership',
    });
    expect(decodeFunctionData({ abi: resonanceAbi, data: buildCancelOwnershipTransfer(A).data })).toMatchObject({
      args: ['0x0000000000000000000000000000000000000000'],
      functionName: 'transferOwnership',
    });
    expect(decodeFunctionData({ abi: resonanceAbi, data: buildAcceptOwnership(A).data })).toMatchObject({
      functionName: 'acceptOwnership',
    });

    const zero = '0x0000000000000000000000000000000000000000';
    expect(() => buildSetMineResonanceRouter(A, zero)).toThrow(RangeError);
    expect(() => buildBeginOwnershipTransfer(A, zero)).toThrow(RangeError);
    expect(() => buildCancelOwnershipTransfer(zero)).toThrow(RangeError);
    expect(() => buildAcceptOwnership(zero)).toThrow(RangeError);
  });

  it('encodes scalar and all-token Bribe claims plus buffered reward distribution', () => {
    expect(decodeFunctionData({ abi: bribeAbi, data: buildClaimBribeReward(A, B, C).data })).toMatchObject({
      args: [B, C],
      functionName: 'claimReward',
    });
    expect(decodeFunctionData({ abi: bribeAbi, data: buildClaimAllBribeRewards(A, B).data })).toMatchObject({
      args: [B],
      functionName: 'claimRewards',
    });
    expect(decodeFunctionData({ abi: bribeRouterAbi, data: buildRouteBribeRewards(A).data }).functionName).toBe(
      'route',
    );
  });
});
