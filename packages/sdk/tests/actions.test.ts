import { decodeFunctionData, getAddress } from 'viem';
import { describe, expect, it } from 'vitest';

import {
  buildApproval,
  buildAddSignal,
  buildAddSignalMany,
  buildContribution,
  buildCompoundLiquidity,
  buildFundBurn,
  buildFundraiserClaim,
  buildRedemption,
  buildRemoveSignal,
  buildRemoveSignalMany,
  buildSettleFundraiserEpochs,
  buildStrategyBuy,
  fundAbi,
  fundraiserAbi,
  gbxAbi,
  liquidityPositionAbi,
  strategyAbi,
  resonanceAbi,
} from '../src/index.js';

const A = '0x0000000000000000000000000000000000000001';
const B = '0x0000000000000000000000000000000000000002';
const C = '0x0000000000000000000000000000000000000003';

describe('minimal typed transaction builders', () => {
  it('encodes a standard approval and Fundraiser contribution', () => {
    expect(decodeFunctionData({ abi: gbxAbi, data: buildApproval(A, B, 50n).data })).toMatchObject({
      args: [B, 50n],
      functionName: 'approve',
    });
    expect(decodeFunctionData({ abi: fundraiserAbi, data: buildContribution(A, B, 50n).data })).toMatchObject({
      args: [B, 50n],
      functionName: 'contribute',
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

  it('encodes Fundraiser claims for any beneficiary', () => {
    expect(decodeFunctionData({ abi: fundraiserAbi, data: buildFundraiserClaim(A, B, 7n).data })).toMatchObject({
      args: [B, 7n],
      functionName: 'claim',
    });
  });

  it('encodes permissionless Fundraiser settlement and liquidity maintenance', () => {
    expect(decodeFunctionData({ abi: fundraiserAbi, data: buildSettleFundraiserEpochs(A, 30n).data })).toMatchObject({
      args: [30n],
      functionName: 'settleEpochs',
    });
    expect(
      decodeFunctionData({ abi: liquidityPositionAbi, data: buildCompoundLiquidity(A, 1n, 2n, 3n).data }).functionName,
    ).toBe('compound');
  });
});
