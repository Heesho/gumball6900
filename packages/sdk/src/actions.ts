import { encodeFunctionData, getAddress, type Address, type Hex } from 'viem';

import {
  acquisitionStrategyAbi,
  allocationVoterAbi,
  buybackStrategyAbi,
  gbxAbi,
  gumBallVaultAbi,
  liquidityCustodianAbi,
  miningClaimsAbi,
  miningPoolAbi,
  stakedGbxAbi,
  strategyRewardsAbi,
} from './abis.js';
import { assertUint, positiveBigIntSchema, unsignedBigIntSchema } from './validation.js';

/** Wallet-ready call with no native-currency transfer. */
export interface ContractTransaction {
  readonly to: Address;
  readonly data: Hex;
  readonly value: 0n;
}

function transaction(to: Address, data: Hex): ContractTransaction {
  return { to: getAddress(to), data, value: 0n };
}

function uint256(value: bigint, name: string): void {
  unsignedBigIntSchema.parse(value);
  assertUint(value, 256, name);
}

function positiveUint256(value: bigint, name: string): void {
  try {
    positiveBigIntSchema.parse(value);
  } catch {
    throw new RangeError(`${name} must be positive`);
  }
  assertUint(value, 256, name);
}

/** Encodes the allowance required before staking, redemption, mining, or auction payment. */
export function buildApproval(token: Address, spender: Address, amount: bigint): ContractTransaction {
  uint256(amount, 'amount');
  return transaction(
    token,
    encodeFunctionData({ abi: gbxAbi, functionName: 'approve', args: [getAddress(spender), amount] }),
  );
}

export function buildGBXBurn(gbx: Address, amount: bigint): ContractTransaction {
  positiveUint256(amount, 'amount');
  return transaction(gbx, encodeFunctionData({ abi: gbxAbi, functionName: 'burn', args: [amount] }));
}

export function buildMiningContribution(
  miningPool: Address,
  beneficiary: Address,
  requestedAmount: bigint,
): ContractTransaction {
  positiveUint256(requestedAmount, 'requestedAmount');
  return transaction(
    miningPool,
    encodeFunctionData({
      abi: miningPoolAbi,
      functionName: 'contribute',
      args: [getAddress(beneficiary), requestedAmount],
    }),
  );
}

export function buildSettleCurrentMiningEpoch(miningPool: Address): ContractTransaction {
  return transaction(miningPool, encodeFunctionData({ abi: miningPoolAbi, functionName: 'settleCurrentEpoch' }));
}

export function buildMiningClaim(miningClaims: Address, beneficiary: Address, epochId: bigint): ContractTransaction {
  uint256(epochId, 'epochId');
  return transaction(
    miningClaims,
    encodeFunctionData({ abi: miningClaimsAbi, functionName: 'claim', args: [getAddress(beneficiary), epochId] }),
  );
}

export function buildStake(stakedGBX: Address, amount: bigint): ContractTransaction {
  positiveUint256(amount, 'amount');
  return transaction(stakedGBX, encodeFunctionData({ abi: stakedGbxAbi, functionName: 'stake', args: [amount] }));
}

export function buildUnstake(stakedGBX: Address, amount: bigint): ContractTransaction {
  positiveUint256(amount, 'amount');
  return transaction(stakedGBX, encodeFunctionData({ abi: stakedGbxAbi, functionName: 'unstake', args: [amount] }));
}

/** Replaces the caller's complete immediate absolute strategy allocation. */
export function buildSignal(
  allocationVoter: Address,
  strategies: readonly Address[],
  weights: readonly bigint[],
): ContractTransaction {
  if (strategies.length === 0 || strategies.length > 16 || strategies.length !== weights.length) {
    throw new RangeError('strategies and weights must have matching lengths between 1 and 16');
  }
  const normalizedStrategies = strategies.map((strategy) => getAddress(strategy));
  if (new Set(normalizedStrategies).size !== normalizedStrategies.length) throw new RangeError('duplicate strategy');
  for (const weight of weights) positiveUint256(weight, 'weight');
  uint256(
    weights.reduce((total, weight) => total + weight, 0n),
    'totalWeight',
  );
  return transaction(
    allocationVoter,
    encodeFunctionData({
      abi: allocationVoterAbi,
      functionName: 'signal',
      args: [normalizedStrategies, [...weights]],
    }),
  );
}

export function buildResetSignals(allocationVoter: Address): ContractTransaction {
  return transaction(allocationVoter, encodeFunctionData({ abi: allocationVoterAbi, functionName: 'resetSignals' }));
}

export function buildRedemption(vault: Address, shares: bigint, receiver: Address): ContractTransaction {
  positiveUint256(shares, 'shares');
  return transaction(
    vault,
    encodeFunctionData({ abi: gumBallVaultAbi, functionName: 'redeem', args: [shares, getAddress(receiver)] }),
  );
}

export interface AuctionFillParameters {
  readonly strategy: Address;
  readonly expectedEpochId: bigint;
  readonly deadline: bigint;
  /** Raw target-token amount for acquisition, or raw GBX amount for buyback. Zero is valid at an expired auction price. */
  readonly maxPaymentAmount: bigint;
}

function validateAuctionFill(parameters: AuctionFillParameters): void {
  uint256(parameters.expectedEpochId, 'expectedEpochId');
  uint256(parameters.deadline, 'deadline');
  uint256(parameters.maxPaymentAmount, 'maxPaymentAmount');
}

export function buildAcquisitionFill(parameters: AuctionFillParameters): ContractTransaction {
  validateAuctionFill(parameters);
  return transaction(
    parameters.strategy,
    encodeFunctionData({
      abi: acquisitionStrategyAbi,
      functionName: 'fill',
      args: [parameters.expectedEpochId, parameters.deadline, parameters.maxPaymentAmount],
    }),
  );
}

export function buildBuybackFill(parameters: AuctionFillParameters): ContractTransaction {
  validateAuctionFill(parameters);
  return transaction(
    parameters.strategy,
    encodeFunctionData({
      abi: buybackStrategyAbi,
      functionName: 'fill',
      args: [parameters.expectedEpochId, parameters.deadline, parameters.maxPaymentAmount],
    }),
  );
}

/** Claims one acquisition strategy's target-token reward directly to the beneficiary. */
export function buildStrategyRewardClaim(rewards: Address, beneficiary: Address): ContractTransaction {
  return transaction(
    rewards,
    encodeFunctionData({ abi: strategyRewardsAbi, functionName: 'claim', args: [getAddress(beneficiary)] }),
  );
}

export function buildCollectLiquidityFees(liquidityCustodian: Address): ContractTransaction {
  return transaction(
    liquidityCustodian,
    encodeFunctionData({ abi: liquidityCustodianAbi, functionName: 'collectFees' }),
  );
}
