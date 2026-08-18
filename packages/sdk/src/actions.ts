import { encodeFunctionData, getAddress, isHex, keccak256, toBytes, zeroAddress, type Address, type Hex } from 'viem';

import {
  bribeAbi,
  bribeRouterAbi,
  fundAbi,
  gbxAbi,
  liquidityPositionAbi,
  mineAbi,
  protocolGovernorAbi,
  signalGbxAbi,
  strategyAbi,
  resonanceAbi,
  resonanceRouterAbi,
} from './abis.js';
import { assertUint, bytes32Schema, positiveBigIntSchema, unsignedBigIntSchema } from './validation.js';

/** Wallet-ready contract call with no native-currency transfer. */
export interface ContractTransaction {
  readonly to: Address;
  readonly data: Hex;
  readonly value: 0n;
}

/** One zero-value call that can be composed into a selector-bounded ProtocolGovernor proposal. */
export interface ProtocolProposalCall {
  readonly target: Address;
  readonly value: 0n;
  readonly calldata: Hex;
}

/** OpenZeppelin GovernorCountingSimple vote choices. */
export type ProtocolVoteSupport = 0 | 1 | 2;

function transaction(to: Address, data: Hex): ContractTransaction {
  return { to: getAddress(to), data, value: 0n };
}

function proposalCall(target: Address, calldata: Hex): ProtocolProposalCall {
  return { target: getAddress(target), value: 0n, calldata };
}

function proposalArguments(calls: readonly ProtocolProposalCall[]): {
  targets: Address[];
  values: bigint[];
  calldatas: Hex[];
} {
  if (calls.length === 0) throw new RangeError('calls cannot be empty');
  const targets: Address[] = [];
  const values: bigint[] = [];
  const calldatas: Hex[] = [];
  for (const [index, call] of calls.entries()) {
    if (call.value !== 0n) throw new RangeError(`calls[${index}].value must be zero`);
    if (!isHex(call.calldata, { strict: true }) || call.calldata.length < 10) {
      throw new RangeError(`calls[${index}].calldata must contain a function selector`);
    }
    targets.push(getAddress(call.target));
    values.push(0n);
    calldatas.push(call.calldata);
  }
  return { targets, values, calldatas };
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
}

/** Replaces one Mine slot with caller-bounded epoch, deadline, and USDG price protection. */
export function buildMine(parameters: MineParameters): ContractTransaction {
  uint256(parameters.slotIndex, 'slotIndex');
  uint256(parameters.expectedEpochId, 'expectedEpochId');
  uint256(parameters.deadline, 'deadline');
  uint256(parameters.maximumPrice, 'maximumPrice');
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

/** Encodes the Router-only notification that restarts Resonance with `reward + left`. */
export function buildNotifyRevenue(resonance: Address, reward: bigint): ContractTransaction {
  positiveUint256(reward, 'reward');
  return transaction(
    resonance,
    encodeFunctionData({ abi: resonanceAbi, functionName: 'notifyRevenue', args: [reward] }),
  );
}

export interface ResonanceStrategyConfig {
  readonly initialPrice: bigint;
  readonly epochDuration: bigint;
  readonly priceMultiplier: bigint;
  readonly minimumPrice: bigint;
}

/** Encodes Governor-controlled deployment of a Strategy and its bound Bribe graph as a proposal call. */
export function buildAddStrategyProposalCall(
  resonance: Address,
  paymentToken: Address,
  config: ResonanceStrategyConfig,
): ProtocolProposalCall {
  positiveUint256(config.initialPrice, 'initialPrice');
  positiveUint256(config.epochDuration, 'epochDuration');
  positiveUint256(config.priceMultiplier, 'priceMultiplier');
  positiveUint256(config.minimumPrice, 'minimumPrice');
  return proposalCall(
    resonance,
    encodeFunctionData({
      abi: resonanceAbi,
      functionName: 'addStrategy',
      args: [getAddress(paymentToken), config],
    }),
  );
}

/** Encodes irreversible Governor-controlled removal of a Strategy from live weight as a proposal call. */
export function buildKillStrategyProposalCall(resonance: Address, strategy: Address): ProtocolProposalCall {
  return proposalCall(
    resonance,
    encodeFunctionData({ abi: resonanceAbi, functionName: 'killStrategy', args: [getAddress(strategy)] }),
  );
}

/** Encodes Governor-controlled registration of one Bribe reward token as a proposal call. */
export function buildAddBribeRewardProposalCall(
  resonance: Address,
  strategy: Address,
  rewardToken: Address,
): ProtocolProposalCall {
  return proposalCall(
    resonance,
    encodeFunctionData({
      abi: resonanceAbi,
      functionName: 'addBribeReward',
      args: [getAddress(strategy), getAddress(rewardToken)],
    }),
  );
}

/** Returns the bytes32 description hash used by Governor queue, execute, and cancel calls. */
export function hashProtocolProposalDescription(description: string): Hex {
  return keccak256(toBytes(description));
}

/** Submits one or more bounded protocol calls to ProtocolGovernor. */
export function buildProtocolProposal(
  protocolGovernor: Address,
  calls: readonly ProtocolProposalCall[],
  description: string,
): ContractTransaction {
  const { targets, values, calldatas } = proposalArguments(calls);
  return transaction(
    protocolGovernor,
    encodeFunctionData({
      abi: protocolGovernorAbi,
      functionName: 'propose',
      args: [targets, values, calldatas, description],
    }),
  );
}

/** Casts a For (1), Against (0), or Abstain (2) vote on an active proposal. */
export function buildCastProtocolVote(
  protocolGovernor: Address,
  proposalId: bigint,
  support: ProtocolVoteSupport,
): ContractTransaction {
  uint256(proposalId, 'proposalId');
  if (support !== 0 && support !== 1 && support !== 2) throw new RangeError('support must be 0, 1, or 2');
  return transaction(
    protocolGovernor,
    encodeFunctionData({ abi: protocolGovernorAbi, functionName: 'castVote', args: [proposalId, support] }),
  );
}

/** Queues a succeeded proposal in the immutable Timelock. */
export function buildQueueProtocolProposal(
  protocolGovernor: Address,
  calls: readonly ProtocolProposalCall[],
  descriptionHash: Hex,
): ContractTransaction {
  const { targets, values, calldatas } = proposalArguments(calls);
  const parsedDescriptionHash = bytes32Schema.parse(descriptionHash) as Hex;
  return transaction(
    protocolGovernor,
    encodeFunctionData({
      abi: protocolGovernorAbi,
      functionName: 'queue',
      args: [targets, values, calldatas, parsedDescriptionHash],
    }),
  );
}

/** Executes a queued proposal after the immutable Timelock delay. */
export function buildExecuteProtocolProposal(
  protocolGovernor: Address,
  calls: readonly ProtocolProposalCall[],
  descriptionHash: Hex,
): ContractTransaction {
  const { targets, values, calldatas } = proposalArguments(calls);
  const parsedDescriptionHash = bytes32Schema.parse(descriptionHash) as Hex;
  return transaction(
    protocolGovernor,
    encodeFunctionData({
      abi: protocolGovernorAbi,
      functionName: 'execute',
      args: [targets, values, calldatas, parsedDescriptionHash],
    }),
  );
}

/** Cancels the proposer's own proposal while it is Pending; queued cancellation is intentionally unavailable. */
export function buildCancelPendingProtocolProposal(
  protocolGovernor: Address,
  calls: readonly ProtocolProposalCall[],
  descriptionHash: Hex,
): ContractTransaction {
  const { targets, values, calldatas } = proposalArguments(calls);
  const parsedDescriptionHash = bytes32Schema.parse(descriptionHash) as Hex;
  return transaction(
    protocolGovernor,
    encodeFunctionData({
      abi: protocolGovernorAbi,
      functionName: 'cancel',
      args: [targets, values, calldatas, parsedDescriptionHash],
    }),
  );
}

/** Pays a BribeRouter's complete fixed Fund payment-token liability. */
export function buildPayRouterFundPayment(bribeRouter: Address): ContractTransaction {
  return transaction(bribeRouter, encodeFunctionData({ abi: bribeRouterAbi, functionName: 'payFundPayment' }));
}

/** Notifies a BribeRouter's complete fixed paired-Bribe payment-token liability. */
export function buildNotifyRouterBribeReward(bribeRouter: Address): ContractTransaction {
  return transaction(bribeRouter, encodeFunctionData({ abi: bribeRouterAbi, functionName: 'notifyBribeReward' }));
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
