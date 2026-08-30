import { encodeFunctionData, getAddress, zeroAddress, type Address, type Hex } from 'viem';

import {
  bribeAbi,
  bribeRouterAbi,
  fundAbi,
  gbxAbi,
  gbxLauncherAbi,
  mineAbi,
  signalGbxAbi,
  strategyAbi,
  resonanceAbi,
  resonanceRouterAbi,
} from './abis.js';
import { MINE_MAX_MESSAGE_BYTES } from './math/constants.js';
import { normalizeSignalAllocations, type SignalAllocation } from './signal-allocations.js';
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

function nonzeroAddress(value: Address, name: string): Address {
  const normalized = getAddress(value);
  if (normalized === zeroAddress) throw new RangeError(`${name} cannot be the zero address`);
  return normalized;
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

/**
 * Encodes a one-shot GBX launcher call.
 * A successful launch nominates `finalOwner` on Mine and Resonance; that account must accept both transfers later.
 * Release tooling must independently bind both addresses to the reviewed deployment manifest.
 */
export function buildGBXLaunch(launcher: Address, finalOwner: Address): ContractTransaction {
  return transaction(
    nonzeroAddress(launcher, 'launcher'),
    encodeFunctionData({
      abi: gbxLauncherAbi,
      functionName: 'launch',
      args: [nonzeroAddress(finalOwner, 'finalOwner')],
    }),
  );
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

/** Claims an outgoing tenure miner's complete accumulated USDG payment to that same account. */
export function buildClaimMiningPayment(mine: Address, account: Address): ContractTransaction {
  return transaction(
    mine,
    encodeFunctionData({ abi: mineAbi, functionName: 'claimMinerPayment', args: [getAddress(account)] }),
  );
}

/** Redirects only later Mine protocol revenue to a contract-validated replacement ResonanceRouter. */
export function buildSetMineResonanceRouter(mine: Address, newRouter: Address): ContractTransaction {
  return transaction(
    nonzeroAddress(mine, 'mine'),
    encodeFunctionData({
      abi: mineAbi,
      functionName: 'setResonanceRouter',
      args: [nonzeroAddress(newRouter, 'newRouter')],
    }),
  );
}

/** Begins a two-step Mine or Resonance ownership transfer; the nominated owner must accept separately. */
export function buildBeginOwnershipTransfer(contract: Address, newOwner: Address): ContractTransaction {
  return transaction(
    nonzeroAddress(contract, 'contract'),
    encodeFunctionData({
      abi: mineAbi,
      functionName: 'transferOwnership',
      args: [nonzeroAddress(newOwner, 'newOwner')],
    }),
  );
}

/** Cancels a pending two-step Mine or Resonance ownership transfer without changing the current owner. */
export function buildCancelOwnershipTransfer(contract: Address): ContractTransaction {
  return transaction(
    nonzeroAddress(contract, 'contract'),
    encodeFunctionData({ abi: mineAbi, functionName: 'transferOwnership', args: [zeroAddress] }),
  );
}

/** Accepts a pending two-step ownership transfer on Mine or Resonance. */
export function buildAcceptOwnership(contract: Address): ContractTransaction {
  return transaction(
    nonzeroAddress(contract, 'contract'),
    encodeFunctionData({ abi: mineAbi, functionName: 'acceptOwnership' }),
  );
}

/** Atomically deposits GBX, mints non-transferable sGBX, and adds the same signal to one live Strategy. */
export function buildAddSignal(signalGBX: Address, strategy: Address, amount: bigint): ContractTransaction {
  positiveUint256(amount, 'amount');
  return transaction(
    signalGBX,
    encodeFunctionData({
      abi: signalGbxAbi,
      functionName: 'addSignal',
      args: [nonzeroAddress(strategy, 'strategy'), amount],
    }),
  );
}

/** Coalesces duplicate Strategies and encodes one aggregate-custody addition across multiple live Strategies. */
export function buildAddSignalMany(signalGBX: Address, allocations: readonly SignalAllocation[]): ContractTransaction {
  const normalized = normalizeSignalAllocations(allocations);
  return transaction(
    signalGBX,
    encodeFunctionData({
      abi: signalGbxAbi,
      functionName: 'addSignalMany',
      args: [normalized.allocations],
    }),
  );
}

/** Atomically removes signal from one Strategy, burns the same sGBX amount, and returns underlying GBX. */
export function buildRemoveSignal(signalGBX: Address, strategy: Address, amount: bigint): ContractTransaction {
  positiveUint256(amount, 'amount');
  return transaction(
    signalGBX,
    encodeFunctionData({
      abi: signalGbxAbi,
      functionName: 'removeSignal',
      args: [nonzeroAddress(strategy, 'strategy'), amount],
    }),
  );
}

/** Coalesces duplicate Strategies and encodes one aggregate burn and withdrawal across multiple positions. */
export function buildRemoveSignalMany(
  signalGBX: Address,
  allocations: readonly SignalAllocation[],
): ContractTransaction {
  const normalized = normalizeSignalAllocations(allocations);
  return transaction(
    signalGBX,
    encodeFunctionData({
      abi: signalGbxAbi,
      functionName: 'removeSignalMany',
      args: [normalized.allocations],
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

/**
 * Claims one registered Bribe token without touching any other reward token.
 * For a direct Bribe call, `account` must be the submitting wallet; only canonical Resonance may relay a claim.
 */
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

/**
 * Claims every registered token from one Bribe.
 * For a direct Bribe call, `account` must be the submitting wallet; only canonical Resonance may relay a claim.
 */
export function buildClaimAllBribeRewards(bribe: Address, account: Address): ContractTransaction {
  return transaction(
    bribe,
    encodeFunctionData({ abi: bribeAbi, functionName: 'claimRewards', args: [getAddress(account)] }),
  );
}

/** Claims every registered reward from each selected Strategy's canonical Bribe for the submitting wallet. */
export function buildClaimBribeRewards(resonance: Address, strategies: readonly Address[]): ContractTransaction {
  if (strategies.length === 0) throw new RangeError('strategies cannot be empty');
  const normalized = strategies.map((strategy) => nonzeroAddress(strategy, 'strategy'));
  return transaction(
    resonance,
    encodeFunctionData({ abi: resonanceAbi, functionName: 'claimBribeRewards', args: [normalized] }),
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
    encodeFunctionData({ abi: resonanceAbi, functionName: 'distributeRevenue', args: [getAddress(strategy)] }),
  );
}

/** Attempts to notify a paired Bribe with the Router's complete buffered payment-token balance. */
export function buildRouteBribeRewards(bribeRouter: Address): ContractTransaction {
  return transaction(bribeRouter, encodeFunctionData({ abi: bribeRouterAbi, functionName: 'route' }));
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
