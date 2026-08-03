import { decodeFunctionData, getAddress } from 'viem';
import { describe, expect, it } from 'vitest';

import {
  acquisitionStrategyAbi,
  allocationVoterAbi,
  buildAcquisitionFill,
  buildApproval,
  buildBuybackFill,
  buildCollectLiquidityFees,
  buildMiningClaim,
  buildRedemption,
  buildSignal,
  buildStrategyRewardClaim,
  buybackStrategyAbi,
  gbxAbi,
  gumBallVaultAbi,
  liquidityCustodianAbi,
  miningClaimsAbi,
  strategyRewardsAbi,
} from '../src/index.js';

const A = '0x0000000000000000000000000000000000000001';
const B = '0x0000000000000000000000000000000000000002';
const C = '0x0000000000000000000000000000000000000003';

describe('minimal typed transaction builders', () => {
  it('encodes standard approval and one mining claim', () => {
    expect(decodeFunctionData({ abi: gbxAbi, data: buildApproval(A, B, 50n).data })).toMatchObject({
      args: [B, 50n],
      functionName: 'approve',
    });
    expect(decodeFunctionData({ abi: miningClaimsAbi, data: buildMiningClaim(A, B, 7n).data })).toMatchObject({
      args: [B, 7n],
      functionName: 'claim',
    });
  });

  it('encodes immediate absolute signal weights and rejects duplicates', () => {
    expect(() => buildSignal(A, [B, B], [1n, 1n])).toThrow('duplicate strategy');
    const transaction = buildSignal(A, [B, C], [3n, 7n]);
    const decoded = decodeFunctionData({ abi: allocationVoterAbi, data: transaction.data });
    expect(decoded.functionName).toBe('signal');
    expect(decoded.args).toEqual([
      [getAddress(B), getAddress(C)],
      [3n, 7n],
    ]);
  });

  it('encodes raw-basket redemption directly through the vault', () => {
    const decoded = decodeFunctionData({ abi: gumBallVaultAbi, data: buildRedemption(A, 50n, B).data });
    expect(decoded).toMatchObject({ args: [50n, B], functionName: 'redeem' });
  });

  it('encodes source-faithful three-argument auction fills including a zero maximum', () => {
    const parameters = { deadline: 1_000n, expectedEpochId: 7n, maxPaymentAmount: 0n, strategy: A } as const;
    expect(
      decodeFunctionData({ abi: acquisitionStrategyAbi, data: buildAcquisitionFill(parameters).data }),
    ).toMatchObject({ args: [7n, 1_000n, 0n], functionName: 'fill' });
    expect(decodeFunctionData({ abi: buybackStrategyAbi, data: buildBuybackFill(parameters).data })).toMatchObject({
      args: [7n, 1_000n, 0n],
      functionName: 'fill',
    });
  });

  it('encodes permissionless reward claim and liquidity fee collection', () => {
    expect(decodeFunctionData({ abi: strategyRewardsAbi, data: buildStrategyRewardClaim(A, B).data })).toMatchObject({
      args: [B],
      functionName: 'claim',
    });
    expect(decodeFunctionData({ abi: liquidityCustodianAbi, data: buildCollectLiquidityFees(A).data })).toMatchObject({
      functionName: 'collectFees',
    });
  });
});
