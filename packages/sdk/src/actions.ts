import { encodeFunctionData, getAddress, zeroAddress, type Address, type Hex } from 'viem';

import {
  bribeAbi,
  bribeRouterAbi,
  fundAbi,
  gbxAbi,
  liquidityPositionAbi,
  mineAbi,
  signalGbxAbi,
  strategyAbi,
  resonanceAbi,
  resonanceRouterAbi,
} from './abis.js';
import { MINE_MAX_MESSAGE_BYTES } from './math/constants.js';
import { assertUint, bytes32Schema, positiveBigIntSchema, unsignedBigIntSchema } from './validation.js';

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

/** Encodes an ERC-20 allowance for signaling, mining, Strategy payment, or redemption. */
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

export interface MineParameters {
  readonly mine: Address;
  readonly beneficiary: Address;
  readonly slotIndex: bigint;
  readonly expectedEpochId: bigint;
  readonly deadline: bigint;
  readonly maximumPrice: bigint;
  readonly message: string;
}

/**
 * Replaces one Mine slot with caller-bounded epoch, deadline, USDG price, and event-only message protection.
 * Set `deadline` before the next halving boundary when the quoted prospective TPS must remain valid.
 */
export function buildMine(parameters: MineParameters): ContractTransaction {
  uint256(parameters.slotIndex, 'slotIndex');
  uint256(parameters.expectedEpochId, 'expectedEpochId');
  uint256(parameters.deadline, 'deadline');
  uint256(parameters.maximumPrice, 'maximumPrice');
  const messageLength = new TextEncoder().encode(parameters.message).length;
  if (messageLength > MINE_MAX_MESSAGE_BYTES) {
    throw new RangeError(`message cannot exceed ${MINE_MAX_MESSAGE_BYTES} UTF-8 bytes`);
  }
  return transaction(
    parameters.mine,
    encodeFunctionData({
      abi: mineAbi,
      functionName: 'mine',
      args: [
        getAddress(parameters.beneficiary),
        parameters.slotIndex,
        parameters.expectedEpochId,
        parameters.deadline,
        parameters.maximumPrice,
        parameters.message,
      ],
    }),
  );
}

/** Claims a displaced miner's complete accumulated USDG payment to that same account. */
export function buildClaimMiningPayment(mine: Address, account: Address): ContractTransaction {
  return transaction(mine, encodeFunctionData({ abi: mineAbi, functionName: 'claim', args: [getAddress(account)] }));
}

/** Collects canonical LP fees, routes USDG through ResonanceRouter, and burns GBX through Fund. */
export function buildHarvestLiquidityFees(liquidityPosition: Address): ContractTransaction {
  return transaction(
    liquidityPosition,
    encodeFunctionData({
      abi: liquidityPositionAbi,
      functionName: 'harvestFees',
    }),
  );
}

/** Atomically deposits GBX, mints non-transferable sGBX, and signals the same amount to one live Strategy. */
export function buildSignal(signalGBX: Address, strategy: Address, amount: bigint): ContractTransaction {
  positiveUint256(amount, 'amount');
  return transaction(
    signalGBX,
    encodeFunctionData({
      abi: signalGbxAbi,
      functionName: 'signal',
      args: [getAddress(strategy), amount],
    }),
  );
}

export interface SignalWithPermitParameters {
  readonly signalGBX: Address;
  readonly strategy: Address;
  readonly amount: bigint;
  readonly deadline: bigint;
  readonly v: number;
  readonly r: Hex;
  readonly s: Hex;
}

/** Uses an underlying GBX permit, then atomically deposits, mints, and signals. */
export function buildSignalWithPermit(parameters: SignalWithPermitParameters): ContractTransaction {
  positiveUint256(parameters.amount, 'amount');
  uint256(parameters.deadline, 'deadline');
  if (!Number.isInteger(parameters.v) || parameters.v < 0 || parameters.v > 255) {
    throw new RangeError('v must fit uint8');
  }
  const r = bytes32Schema.parse(parameters.r) as Hex;
  const s = bytes32Schema.parse(parameters.s) as Hex;
  return transaction(
    parameters.signalGBX,
    encodeFunctionData({
      abi: signalGbxAbi,
      functionName: 'signalWithPermit',
      args: [getAddress(parameters.strategy), parameters.amount, parameters.deadline, parameters.v, r, s],
    }),
  );
}

/** Moves an absolute signal amount between Strategies without changing GBX custody or sGBX supply. */
export function buildMoveSignal(
  signalGBX: Address,
  fromStrategy: Address,
  toStrategy: Address,
  amount: bigint,
): ContractTransaction {
  positiveUint256(amount, 'amount');
  return transaction(
    signalGBX,
    encodeFunctionData({
      abi: signalGbxAbi,
      functionName: 'moveSignal',
      args: [getAddress(fromStrategy), getAddress(toStrategy), amount],
    }),
  );
}

/** Atomically removes signal, burns the same sGBX amount, and returns underlying GBX. */
export function buildWithdrawSignal(signalGBX: Address, strategy: Address, amount: bigint): ContractTransaction {
  positiveUint256(amount, 'amount');
  return transaction(
    signalGBX,
    encodeFunctionData({
      abi: signalGbxAbi,
      functionName: 'withdrawSignal',
      args: [getAddress(strategy), amount],
    }),
  );
}

/** Delegates the caller's SignalGBX voting power. */
export function buildDelegateSignalVotes(signalGBX: Address, delegatee: Address): ContractTransaction {
  return transaction(
    signalGBX,
    encodeFunctionData({ abi: signalGbxAbi, functionName: 'delegate', args: [getAddress(delegatee)] }),
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

/** Claims every registered Bribe token for a fixed entitled account. */
export function buildClaimAllBribeRewards(bribe: Address, account: Address): ContractTransaction {
  return transaction(
    bribe,
    encodeFunctionData({ abi: bribeAbi, functionName: 'claimRewards', args: [getAddress(account)] }),
  );
}

/** Attempts to route all USDG held by ResonanceRouter; insufficient balances remain held without reverting. */
export function buildRouteRevenue(resonanceRouter: Address): ContractTransaction {
  return transaction(resonanceRouter, encodeFunctionData({ abi: resonanceRouterAbi, functionName: 'route' }));
}

/** Checkpoints elapsed stream revenue and sends one Strategy its currently released USDG allocation. */
export function buildDistributeRevenue(resonance: Address, strategy: Address): ContractTransaction {
  return transaction(
    resonance,
    encodeFunctionData({ abi: resonanceAbi, functionName: 'distribute', args: [getAddress(strategy)] }),
  );
}

/** Encodes the Router-only notification that restarts Resonance with ordinary Synthetix leftover rollover. */
export function buildNotifyRevenue(resonance: Address, reward: bigint): ContractTransaction {
  positiveUint256(reward, 'reward');
  return transaction(
    resonance,
    encodeFunctionData({ abi: resonanceAbi, functionName: 'notifyRevenue', args: [reward] }),
  );
}

/** Attempts to notify a paired Bribe with the Router's complete buffered payment-token balance. */
export function buildDistributeBribeRewards(bribeRouter: Address): ContractTransaction {
  return transaction(bribeRouter, encodeFunctionData({ abi: bribeRouterAbi, functionName: 'distribute' }));
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
