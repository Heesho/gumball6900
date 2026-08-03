import {
  acquisitionStrategyAbi,
  allocationVoterAbi,
  assetRegistryAbi,
  buybackStrategyAbi,
  eligibilityModuleAbi,
  emergencyGuardianAbi,
  emissionControllerAbi,
  gbxAbi,
  genesisBootstrapAbi,
  genesisClaimsAbi,
  genesisLiquidityCalculatorAbi,
  gumBallLensAbi,
  gumBallRouterAbi,
  gumBallVaultAbi,
  holdUSDGStrategyAbi,
  launchGuardHookAbi,
  liquidityManagerAbi,
  managerRewardsAbi,
  miningClaimsAbi,
  miningPoolAbi,
  protocolTimelockAbi,
  revenueRouterAbi,
  stakedGbxAbi,
} from '@gumball-6900/sdk';
import { decodeErrorResult, isAddress, isHex, type Abi, type Address, type Hex } from 'viem';

import type { LiveRuntimeDeployment, RuntimeDeployment } from './runtime-types';

/** Finite target classifications backed by ABI exports generated from the shared Solidity artifacts. */
export const protocolErrorContractKinds = [
  'acquisition-strategy',
  'allocation-voter',
  'asset-registry',
  'buyback-strategy',
  'eligibility-module',
  'emergency-guardian',
  'emission-controller',
  'erc20',
  'gbx',
  'genesis-bootstrap',
  'genesis-claims',
  'genesis-liquidity-calculator',
  'gum-ball-lens',
  'gum-ball-router',
  'gum-ball-vault',
  'hold-usdg-strategy',
  'launch-guard-hook',
  'liquidity-manager',
  'manager-rewards',
  'mining-claims',
  'mining-pool',
  'protocol-timelock',
  'revenue-router',
  'staked-gbx',
] as const;
export type ProtocolErrorContractKind = (typeof protocolErrorContractKinds)[number];

const erc20ErrorAbi = gbxAbi.filter((entry) => entry.type === 'error' && entry.name.startsWith('ERC20')) as Abi;

const generatedProtocolErrorAbis = {
  'acquisition-strategy': acquisitionStrategyAbi,
  'allocation-voter': allocationVoterAbi,
  'asset-registry': assetRegistryAbi,
  'buyback-strategy': buybackStrategyAbi,
  'eligibility-module': eligibilityModuleAbi,
  'emergency-guardian': emergencyGuardianAbi,
  'emission-controller': emissionControllerAbi,
  erc20: erc20ErrorAbi,
  gbx: gbxAbi,
  'genesis-bootstrap': genesisBootstrapAbi,
  'genesis-claims': genesisClaimsAbi,
  'genesis-liquidity-calculator': genesisLiquidityCalculatorAbi,
  'gum-ball-lens': gumBallLensAbi,
  'gum-ball-router': gumBallRouterAbi,
  'gum-ball-vault': gumBallVaultAbi,
  'hold-usdg-strategy': holdUSDGStrategyAbi,
  'launch-guard-hook': launchGuardHookAbi,
  'liquidity-manager': liquidityManagerAbi,
  'manager-rewards': managerRewardsAbi,
  'mining-claims': miningClaimsAbi,
  'mining-pool': miningPoolAbi,
  'protocol-timelock': protocolTimelockAbi,
  'revenue-router': revenueRouterAbi,
  'staked-gbx': stakedGbxAbi,
} as const satisfies Readonly<Record<ProtocolErrorContractKind, Abi>>;

const knownErrorCopy: Readonly<Record<string, string>> = {
  AcquisitionStrategy__AuctionExpired: 'This auction has expired. Refresh it before attempting another fill.',
  AcquisitionStrategy__DeadlineExpired: 'The auction transaction deadline expired. Request a fresh quote.',
  AcquisitionStrategy__FillsPaused: 'Auction fills are currently paused.',
  AcquisitionStrategy__InactiveStrategy: 'This acquisition strategy is no longer active.',
  AcquisitionStrategy__InsufficientBudget: 'The requested USDG exceeds the strategy’s available budget.',
  AcquisitionStrategy__MaxTargetExceeded: 'The required token payment exceeds the maximum you approved.',
  AcquisitionStrategy__StaleAuctionId: 'The auction changed after your quote. Refresh and review the new terms.',
  AcquisitionStrategy__UnderpaidTarget: 'The strategy received less target token than the fill requires.',
  BuybackBurnStrategy__AuctionExpired: 'This buyback auction has expired. Refresh it before attempting another fill.',
  BuybackBurnStrategy__DeadlineExpired: 'The buyback transaction deadline expired. Request a fresh quote.',
  BuybackBurnStrategy__FillsPaused: 'Buyback fills are currently paused.',
  BuybackBurnStrategy__InactiveStrategy: 'The buyback strategy is no longer active.',
  BuybackBurnStrategy__InsufficientBudget: 'The requested USDG exceeds the buyback’s available budget.',
  BuybackBurnStrategy__MaxGBXExceeded: 'The required GBX payment exceeds the maximum you approved.',
  BuybackBurnStrategy__StaleAuctionId: 'The buyback auction changed after your quote. Refresh the new terms.',
  BuybackBurnStrategy__UnderpaidGBX: 'The strategy received less GBX than the buyback requires.',
  ERC20InsufficientAllowance: 'The token allowance is no longer sufficient. Review and approve the exact amount.',
  ERC20InsufficientBalance: 'The wallet token balance is no longer sufficient for this action.',
  ERC20InvalidReceiver: 'The selected token rejected the receiving address.',
  ERC20InvalidSender: 'The selected token rejected the sending address.',
  GumBallVault__IneligibleReceiver:
    'The receiving wallet is not eligible to hold one or more assets in the redemption basket.',
  GumBallVault__NoSupply: 'Redemption is unavailable because the current GBX supply is zero.',
  GumBallVault__ObservedDebitMismatch:
    'A basket token did not debit the vault by the exact expected amount. No redemption was assumed.',
  GumBallVault__ObservedReceiptMismatch:
    'A basket token did not credit the receiver by the exact expected amount. No redemption was assumed.',
  GumBallVault__ZeroShares: 'Enter a positive GBX amount to redeem.',
  ManagerRewards__IneligibleReceiver:
    'The configured reward receiver is not eligible to hold this asset. Choose an eligible receiver and retry.',
  ManagerRewards__NoPendingTerminalDust:
    'This terminal-dust coordinate is no longer pending. Refresh the queue before retrying.',
  ManagerRewards__ObservedDebitMismatch:
    'The reward token did not debit the rewards contract by the exact expected amount.',
  ManagerRewards__ObservedReceiptMismatch: 'The reward token did not credit the receiver by the exact expected amount.',
  ManagerRewards__ZeroAmount: 'There are no manager rewards available for this action.',
  SafeERC20FailedOperation: 'A token transfer failed. Review balance, allowance, and receiver eligibility.',
};

function withCommonTokenErrors(abi: Abi): Abi {
  return [...abi, ...erc20ErrorAbi] as Abi;
}

function addressKindEntries(
  runtime: LiveRuntimeDeployment,
): readonly (readonly [Address, ProtocolErrorContractKind])[] {
  const entries: Array<readonly [Address, ProtocolErrorContractKind]> = [
    [runtime.addresses.gbx, 'gbx'],
    [runtime.addresses.protocolTimelock, 'protocol-timelock'],
    [runtime.addresses.emergencyGuardian, 'emergency-guardian'],
    [runtime.addresses.eligibilityModule, 'eligibility-module'],
    [runtime.addresses.genesisBootstrap, 'genesis-bootstrap'],
    [runtime.addresses.genesisClaims, 'genesis-claims'],
    [runtime.addresses.emissionController, 'emission-controller'],
    [runtime.addresses.miningPool, 'mining-pool'],
    [runtime.addresses.miningClaims, 'mining-claims'],
    [runtime.addresses.gumBallVault, 'gum-ball-vault'],
    [runtime.addresses.assetRegistry, 'asset-registry'],
    [runtime.addresses.stakedGBX, 'staked-gbx'],
    [runtime.addresses.allocationVoter, 'allocation-voter'],
    [runtime.addresses.revenueRouter, 'revenue-router'],
    [runtime.addresses.holdUSDGStrategy, 'hold-usdg-strategy'],
    [runtime.addresses.buybackBurnStrategy, 'buyback-strategy'],
    [runtime.addresses.liquidityManager, 'liquidity-manager'],
    [runtime.addresses.launchGuardHook, 'launch-guard-hook'],
    [runtime.addresses.genesisLiquidityCalculator, 'genesis-liquidity-calculator'],
    [runtime.addresses.gumBallLens, 'gum-ball-lens'],
    [runtime.addresses.gumBallRouter, 'gum-ball-router'],
  ];

  for (const [symbol, address] of Object.entries(runtime.strategies)) {
    entries.push([
      address,
      symbol === 'BURN' ? 'buyback-strategy' : symbol === 'USDG' ? 'hold-usdg-strategy' : 'acquisition-strategy',
    ]);
  }
  for (const address of Object.values(runtime.rewards)) entries.push([address, 'manager-rewards']);
  for (const address of Object.values(runtime.assets)) entries.push([address, 'erc20']);
  return entries;
}

function generatedProtocolErrorAbi(kind: ProtocolErrorContractKind): Abi {
  const abi = generatedProtocolErrorAbis[kind];
  return kind === 'erc20' ? abi : withCommonTokenErrors(abi);
}

/**
 * Selects a generated ABI from either a manifest-pinned address or an explicit kind supplied by a caller that already
 * validated a dynamic target against the pinned Lens/registry snapshot. The kind changes error presentation only; it
 * cannot change transaction destination or calldata.
 */
export function protocolErrorAbiForTarget(
  runtime: RuntimeDeployment,
  target: Address,
  validatedContractKind?: ProtocolErrorContractKind,
): Abi | null {
  if (runtime.mode !== 'live' || !isAddress(target, { strict: true })) return null;
  const targetKey = target.toLowerCase();
  const pinnedKind = addressKindEntries(runtime).find(([address]) => address.toLowerCase() === targetKey)?.[1];
  if (validatedContractKind === undefined) {
    return pinnedKind === undefined ? null : generatedProtocolErrorAbi(pinnedKind);
  }
  if (pinnedKind !== undefined && pinnedKind !== validatedContractKind) {
    const isRuntimeAsset = Object.values(runtime.assets).some((address) => address.toLowerCase() === targetKey);
    const isValidatedToken = pinnedKind === 'gbx' || isRuntimeAsset;
    if (!(validatedContractKind === 'erc20' && isValidatedToken)) return null;
  }
  return generatedProtocolErrorAbi(validatedContractKind);
}

const nestedErrorKeys = ['cause', 'data', 'error', 'originalError', 'raw'] as const;
const MAX_ERROR_DEPTH = 6;
const MAX_ERROR_NODES = 24;

/** Extracts only structured revert-data fields, with depth/node bounds and cycle protection. */
export function nestedRevertData(error: unknown): readonly Hex[] {
  const candidates: Hex[] = [];
  const queue: Array<{ depth: number; value: unknown }> = [{ depth: 0, value: error }];
  const seen = new Set<object>();
  let visited = 0;

  while (queue.length > 0 && visited < MAX_ERROR_NODES) {
    const current = queue.shift();
    if (current === undefined) break;
    visited += 1;
    if (typeof current.value === 'string') {
      if (isHex(current.value) && current.value.length >= 10) candidates.push(current.value);
      continue;
    }
    if (typeof current.value !== 'object' || current.value === null || current.depth >= MAX_ERROR_DEPTH) continue;
    if (seen.has(current.value)) continue;
    seen.add(current.value);
    const record = current.value as Record<string, unknown>;
    for (const key of nestedErrorKeys) {
      if (key in record) queue.push({ depth: current.depth + 1, value: record[key] });
    }
  }
  return [...new Set(candidates)];
}

export function decodeProtocolErrorCopy(
  error: unknown,
  context: Readonly<{
    runtime: RuntimeDeployment;
    target: Address;
    validatedContractKind?: ProtocolErrorContractKind;
  }>,
): string | null {
  const abi = protocolErrorAbiForTarget(context.runtime, context.target, context.validatedContractKind);
  if (abi === null) return null;
  for (const data of nestedRevertData(error)) {
    try {
      const decoded = decodeErrorResult({ abi, data });
      const copy = knownErrorCopy[decoded.errorName];
      return copy ?? generatedCustomErrorCopy(decoded.errorName);
    } catch {
      // A selector absent from the bounded target ABI is intentionally ignored.
    }
  }
  return null;
}

function identifierWords(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/gu, '$1 $2')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase()
    .replace(/\berc20\b/gu, 'ERC-20')
    .replace(/\bgbx\b/gu, 'GBX')
    .replace(/\busdg\b/gu, 'USDG');
}

function sentenceCase(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
}

/** Produces bounded, argument-free copy for any custom error present in a synchronized generated ABI. */
export function generatedCustomErrorCopy(errorName: string): string {
  const separator = errorName.indexOf('__');
  if (separator === -1) {
    return `The protocol rejected this transaction: ${identifierWords(errorName)}. Refresh the latest state and review the action.`;
  }
  const scope = sentenceCase(identifierWords(errorName.slice(0, separator)));
  const reason = identifierWords(errorName.slice(separator + 2));
  return `${scope} rejected the transaction: ${reason}. Refresh the latest state and review the action.`;
}
