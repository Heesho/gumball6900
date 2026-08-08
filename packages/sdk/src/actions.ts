import { encodeFunctionData, getAddress, zeroAddress, type Address, type Hex } from 'viem';

import {
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

/** Collects canonical v4 position fees, burns GBX, and routes USDG through ResonanceRouter. */
export function buildCollectLiquidityFees(liquidityPosition: Address): ContractTransaction {
  return transaction(liquidityPosition, encodeFunctionData({ abi: liquidityPositionAbi, functionName: 'collectFees' }));
}

/** Executes the canonical position's migration after governance binds a compatible successor. */
export function buildMigrateLiquidityPosition(liquidityPosition: Address): ContractTransaction {
  return transaction(
    liquidityPosition,
    encodeFunctionData({ abi: liquidityPositionAbi, functionName: 'migratePosition' }),
  );
}

/** Stakes GBX one-for-one for non-transferable SignalGBX. */
export function buildStake(signalGBX: Address, amount: bigint): ContractTransaction {
  positiveUint256(amount, 'amount');
  return transaction(signalGBX, encodeFunctionData({ abi: signalGbxAbi, functionName: 'stake', args: [amount] }));
}

/** Burns SignalGBX and immediately withdraws the underlying GBX after signals are reset. */
export function buildUnstake(signalGBX: Address, amount: bigint): ContractTransaction {
  positiveUint256(amount, 'amount');
  return transaction(signalGBX, encodeFunctionData({ abi: signalGbxAbi, functionName: 'unstake', args: [amount] }));
}

/** Replaces the caller's complete unrestricted Strategy allocation. */
export function buildSignal(
  resonance: Address,
  strategies: readonly Address[],
  relativeWeights: readonly bigint[],
): ContractTransaction {
  if (strategies.length === 0 || strategies.length !== relativeWeights.length) {
    throw new RangeError('strategies and relativeWeights must have the same non-zero length');
  }
  const normalizedStrategies = uniqueAddresses(strategies, 'strategies');
  for (const weight of relativeWeights) positiveUint256(weight, 'relativeWeight');
  return transaction(
    resonance,
    encodeFunctionData({
      abi: resonanceAbi,
      functionName: 'signal',
      args: [normalizedStrategies, [...relativeWeights]],
    }),
  );
}

/** Clears every Strategy allocation for the caller. */
export function buildResetSignals(resonance: Address): ContractTransaction {
  return transaction(resonance, encodeFunctionData({ abi: resonanceAbi, functionName: 'reset' }));
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
