import { encodeFunctionData, getAddress, zeroAddress, type Address, type Hex } from 'viem';

import {
  bribeAbi,
  bribeRouterAbi,
  fundAbi,
  fundraiserAbi,
  gbxAbi,
  liquidityPositionAbi,
  signalGbxAbi,
  strategyAbi,
  resonanceAbi,
  resonanceRouterAbi,
} from './abis.js';
import { assertUint, positiveBigIntSchema, unsignedBigIntSchema } from './validation.js';

/** Wallet-ready contract call with no native-currency transfer. */
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

function uniqueAddresses(values: readonly Address[], name: string): Address[] {
  const normalized = values.map((value) => getAddress(value));
  if (normalized.some((value) => value === zeroAddress))
    throw new RangeError(`${name} cannot contain the zero address`);
  if (new Set(normalized).size !== normalized.length) throw new RangeError(`${name} cannot contain duplicates`);
  return normalized;
}

/** Encodes an ERC-20 allowance for staking, contribution, payment, or redemption. */
export function buildApproval(token: Address, spender: Address, amount: bigint): ContractTransaction {
  uint256(amount, 'amount');
  return transaction(
    token,
    encodeFunctionData({ abi: gbxAbi, functionName: 'approve', args: [getAddress(spender), amount] }),
  );
}

/** Burns GBX held by the caller. */
export function buildGBXBurn(gbx: Address, amount: bigint): ContractTransaction {
  positiveUint256(amount, 'amount');
  return transaction(gbx, encodeFunctionData({ abi: gbxAbi, functionName: 'burn', args: [amount] }));
}

/** Contributes USDG to the active Fundraiser epoch for a beneficiary. */
export function buildContribution(fundraiser: Address, beneficiary: Address, amount: bigint): ContractTransaction {
  positiveUint256(amount, 'amount');
  return transaction(
    fundraiser,
    encodeFunctionData({ abi: fundraiserAbi, functionName: 'contribute', args: [getAddress(beneficiary), amount] }),
  );
}

/** Claims one beneficiary's completed Fundraiser epoch. */
export function buildFundraiserClaim(fundraiser: Address, account: Address, epoch: bigint): ContractTransaction {
  uint256(epoch, 'epoch');
  return transaction(
    fundraiser,
    encodeFunctionData({ abi: fundraiserAbi, functionName: 'claim', args: [getAddress(account), epoch] }),
  );
}

/** Advances a bounded number of ended Fundraiser epochs through the sequential decay schedule. */
export function buildSettleFundraiserEpochs(fundraiser: Address, maximumEpochs: bigint): ContractTransaction {
  positiveUint256(maximumEpochs, 'maximumEpochs');
  return transaction(
    fundraiser,
    encodeFunctionData({ abi: fundraiserAbi, functionName: 'settleEpochs', args: [maximumEpochs] }),
  );
}

/**
 * Grows the canonical v4 position by its fixed requirement and pays the caller everything it had accrued.
 *
 * `amount0Max` and `amount1Max` are both the funding pulled from the caller and the slippage ceiling: unspent
 * funding is returned in the same call, so set them to what the increase may cost at an acceptable price.
 */
export function buildCompoundLiquidity(
  liquidityPosition: Address,
  amount0Max: bigint,
  amount1Max: bigint,
  deadline: bigint,
): ContractTransaction {
  return transaction(
    liquidityPosition,
    encodeFunctionData({
      abi: liquidityPositionAbi,
      functionName: 'compound',
      args: [amount0Max, amount1Max, deadline],
    }),
  );
}

/** Stakes GBX one-for-one for non-transferable SignalGBX. */
export function buildStake(signalGBX: Address, amount: bigint): ContractTransaction {
  positiveUint256(amount, 'amount');
  return transaction(signalGBX, encodeFunctionData({ abi: signalGbxAbi, functionName: 'stake', args: [amount] }));
}

/** Burns unallocated SignalGBX and immediately withdraws the same amount of underlying GBX. */
export function buildUnstake(signalGBX: Address, amount: bigint): ContractTransaction {
  positiveUint256(amount, 'amount');
  return transaction(signalGBX, encodeFunctionData({ abi: signalGbxAbi, functionName: 'unstake', args: [amount] }));
}

/** Adds an absolute amount to the caller's existing signal for one Strategy. The amount is a delta, not a target. */
export function buildAddSignal(resonance: Address, strategy: Address, amount: bigint): ContractTransaction {
  positiveUint256(amount, 'amount');
  return transaction(
    resonance,
    encodeFunctionData({
      abi: resonanceAbi,
      functionName: 'addSignal',
      args: [getAddress(strategy), amount],
    }),
  );
}

/** Removes an absolute amount from the caller's existing signal for one Strategy. */
export function buildRemoveSignal(resonance: Address, strategy: Address, amount: bigint): ContractTransaction {
  positiveUint256(amount, 'amount');
  return transaction(
    resonance,
    encodeFunctionData({
      abi: resonanceAbi,
      functionName: 'removeSignal',
      args: [getAddress(strategy), amount],
    }),
  );
}

/** Adds absolute deltas to the caller's existing signals for a caller-bounded Strategy batch. */
export function buildAddSignalMany(
  resonance: Address,
  strategies: readonly Address[],
  amounts: readonly bigint[],
): ContractTransaction {
  if (strategies.length === 0 || strategies.length !== amounts.length) {
    throw new RangeError('strategies and amounts must have the same non-zero length');
  }
  const normalizedStrategies = strategies.map((strategy) => getAddress(strategy));
  if (normalizedStrategies.some((strategy) => strategy === zeroAddress)) {
    throw new RangeError('strategies cannot contain the zero address');
  }
  for (const amount of amounts) positiveUint256(amount, 'amount');
  return transaction(
    resonance,
    encodeFunctionData({
      abi: resonanceAbi,
      functionName: 'addSignalMany',
      args: [normalizedStrategies, [...amounts]],
    }),
  );
}

/** Removes absolute deltas from the caller's existing signals for a caller-bounded Strategy batch. */
export function buildRemoveSignalMany(
  resonance: Address,
  strategies: readonly Address[],
  amounts: readonly bigint[],
): ContractTransaction {
  if (strategies.length === 0 || strategies.length !== amounts.length) {
    throw new RangeError('strategies and amounts must have the same non-zero length');
  }
  const normalizedStrategies = strategies.map((strategy) => getAddress(strategy));
  if (normalizedStrategies.some((strategy) => strategy === zeroAddress)) {
    throw new RangeError('strategies cannot contain the zero address');
  }
  for (const amount of amounts) positiveUint256(amount, 'amount');
  return transaction(
    resonance,
    encodeFunctionData({
      abi: resonanceAbi,
      functionName: 'removeSignalMany',
      args: [normalizedStrategies, [...amounts]],
    }),
  );
}

/** Claims the caller's rewards from the selected Strategies' Bribes. */
export function buildClaimRewards(resonance: Address, strategies: readonly Address[]): ContractTransaction {
  if (strategies.length === 0) throw new RangeError('strategies cannot be empty');
  return transaction(
    resonance,
    encodeFunctionData({
      abi: resonanceAbi,
      functionName: 'claimRewards',
      args: [uniqueAddresses(strategies, 'strategies')],
    }),
  );
}

/** Claims one registered Bribe token for a fixed entitled account without touching any other reward token. */
export function buildClaimBribeReward(bribe: Address, account: Address, rewardToken: Address): ContractTransaction {
  return transaction(
    bribe,
    encodeFunctionData({
      abi: bribeAbi,
      functionName: 'claimReward',
      args: [getAddress(account), getAddress(rewardToken)],
    }),
  );
}

/** Claims a unique caller-selected set of registered Bribe tokens for a fixed entitled account. */
export function buildClaimSelectedBribeRewards(
  bribe: Address,
  account: Address,
  rewardTokens: readonly Address[],
): ContractTransaction {
  if (rewardTokens.length === 0) throw new RangeError('rewardTokens cannot be empty');
  return transaction(
    bribe,
    encodeFunctionData({
      abi: bribeAbi,
      functionName: 'claimRewards',
      args: [getAddress(account), uniqueAddresses(rewardTokens, 'rewardTokens')],
    }),
  );
}

/** Routes all USDG currently held by ResonanceRouter into Resonance. */
export function buildRouteRevenue(resonanceRouter: Address): ContractTransaction {
  return transaction(resonanceRouter, encodeFunctionData({ abi: resonanceRouterAbi, functionName: 'route' }));
}

/** Sends one Strategy its currently indexed USDG allocation. */
export function buildDistributeRevenue(resonance: Address, strategy: Address): ContractTransaction {
  return transaction(
    resonance,
    encodeFunctionData({ abi: resonanceAbi, functionName: 'distribute', args: [getAddress(strategy)] }),
  );
}

/** Synchronizes direct USDG donations already held by Resonance into explicit accounting. */
export function buildSyncRevenue(resonance: Address): ContractTransaction {
  return transaction(resonance, encodeFunctionData({ abi: resonanceAbi, functionName: 'syncRevenue' }));
}

/** Attempts to advance Resonance's sub-index carry without requiring another notification. */
export function buildIndexPendingRevenue(resonance: Address): ContractTransaction {
  return transaction(resonance, encodeFunctionData({ abi: resonanceAbi, functionName: 'indexPendingRevenue' }));
}

/** Pays Resonance's complete fixed Fund revenue liability to the immutable Fund. */
export function buildPayFundRevenue(resonance: Address): ContractTransaction {
  return transaction(resonance, encodeFunctionData({ abi: resonanceAbi, functionName: 'payFundRevenue' }));
}

/** Pays a BribeRouter's complete fixed Fund payment-token liability. */
export function buildPayRouterFundPayment(bribeRouter: Address): ContractTransaction {
  return transaction(bribeRouter, encodeFunctionData({ abi: bribeRouterAbi, functionName: 'payFundPayment' }));
}

/** Retries one Bribe token's complete fixed Fund rounding liability. */
export function buildPayBribeFundReward(bribe: Address, rewardToken: Address): ContractTransaction {
  return transaction(
    bribe,
    encodeFunctionData({ abi: bribeAbi, functionName: 'payFundReward', args: [getAddress(rewardToken)] }),
  );
}

/** Parameters required to fill a Strategy at a caller-defined price and time bound. */
export interface StrategyBuyParameters {
  readonly strategy: Address;
  readonly revenueReceiver: Address;
  readonly expectedEpochId: bigint;
  readonly deadline: bigint;
  readonly maximumPayment: bigint;
}

/** Purchases a Strategy's complete USDG balance. */
export function buildStrategyBuy(parameters: StrategyBuyParameters): ContractTransaction {
  uint256(parameters.expectedEpochId, 'expectedEpochId');
  uint256(parameters.deadline, 'deadline');
  uint256(parameters.maximumPayment, 'maximumPayment');
  return transaction(
    parameters.strategy,
    encodeFunctionData({
      abi: strategyAbi,
      functionName: 'buy',
      args: [
        getAddress(parameters.revenueReceiver),
        parameters.expectedEpochId,
        parameters.deadline,
        parameters.maximumPayment,
      ],
    }),
  );
}

/** Burns GBX and redeems a caller-selected, registry-free Fund basket. */
export function buildRedemption(
  fund: Address,
  gbxAmount: bigint,
  receiver: Address,
  tokens: readonly Address[],
): ContractTransaction {
  positiveUint256(gbxAmount, 'gbxAmount');
  if (tokens.length === 0) throw new RangeError('tokens cannot be empty');
  return transaction(
    fund,
    encodeFunctionData({
      abi: fundAbi,
      functionName: 'redeem',
      args: [gbxAmount, getAddress(receiver), uniqueAddresses(tokens, 'tokens')],
    }),
  );
}

/** Burns GBX that has accumulated inside Fund. */
export function buildFundBurn(fund: Address, amount: bigint): ContractTransaction {
  positiveUint256(amount, 'amount');
  return transaction(fund, encodeFunctionData({ abi: fundAbi, functionName: 'burnGBX', args: [amount] }));
}
