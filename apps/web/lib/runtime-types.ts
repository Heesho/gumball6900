import type { ProtocolAddresses } from '@gumball-6900/sdk';
import type { Address } from 'viem';

export const strategySymbols = ['USDG', 'WETH', 'WBTC', 'QQQ', 'TSLA', 'SPCX', 'NVDA', 'AAPL', 'BURN'] as const;
export type StrategySymbol = (typeof strategySymbols)[number];

export const rewardSymbols = ['WETH', 'WBTC', 'QQQ', 'TSLA', 'SPCX', 'NVDA', 'AAPL'] as const;
export type RewardSymbol = (typeof rewardSymbols)[number];

export const assetSymbols = ['USDG', 'WETH', 'WBTC', 'QQQ', 'TSLA', 'SPCX', 'NVDA', 'AAPL', 'GBX'] as const;
export type AssetSymbol = (typeof assetSymbols)[number];

export const requiredExternalContractKeys = [
  'poolManager',
  'positionManager',
  'quoter',
  'stateView',
  'universalRouter',
  'permit2',
] as const;
export type RuntimeExternalContractKey = (typeof requiredExternalContractKeys)[number];

export interface ClientChainConfig {
  id: 4663 | 46630;
  environment: 'mainnet' | 'testnet';
  name: string;
  rpcUrl: string;
  /** Ordered, validated secondary endpoints supplied by the reviewed remote runtime. */
  fallbackRpcUrls: readonly string[];
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface RuntimeManifestSummary {
  version: string;
  gitCommit: string;
  status: 'release-approved' | 'testnet-candidate';
  complianceMode: 'noop-testnet' | 'permissioned-production' | 'unrestricted-production-approved';
  miningPoolDeploymentBlock: string;
  signatureCount: number;
  signatureThreshold: number;
}

export interface RuntimeAssetMetadata {
  symbol: AssetSymbol;
  address: Address;
  decimals: number;
  uid: `0x${string}` | null;
  registryStatus: 'ASSET_STATUS_ACTIVE' | 'NOT_APPLICABLE';
  acquisitionEnabled: boolean;
  redemptionEnabled: boolean;
}

export interface RuntimeExternalContract {
  address: Address;
  sourceUrl: string;
  verifiedAtBlock: string;
}

export type RuntimeExternalContracts = Readonly<Record<RuntimeExternalContractKey, RuntimeExternalContract>>;

export interface RuntimeAdminBoundary {
  emergencyGuardian: Address;
  protocolTimelock: Address;
  guardianOperator: Address;
  protocolTimelockProposer: Address;
}

export interface DemoRuntimeDeployment {
  mode: 'demo';
  fallbackReason:
    | 'explicit-demo'
    | 'invalid-live-configuration'
    | 'invalid-testnet-configuration'
    | 'missing-live-configuration';
  chain: ClientChainConfig;
  issues: readonly string[];
  addresses: null;
  assets: Readonly<Partial<Record<AssetSymbol, Address>>>;
  assetMetadata: Readonly<Partial<Record<AssetSymbol, RuntimeAssetMetadata>>>;
  strategies: Readonly<Partial<Record<StrategySymbol, Address>>>;
  rewards: Readonly<Partial<Record<RewardSymbol, Address>>>;
  externalContracts: null;
  admin: null;
  subgraphUrl: null;
  manifest: null;
}

export interface LiveRuntimeDeployment {
  mode: 'live';
  runtimeKind: 'production' | 'testnet-candidate' | 'local-rehearsal';
  fallbackReason: null;
  chain: ClientChainConfig;
  issues: readonly [];
  addresses: ProtocolAddresses;
  assets: Readonly<Record<AssetSymbol, Address>>;
  assetMetadata: Readonly<Record<AssetSymbol, RuntimeAssetMetadata>>;
  strategies: Readonly<Record<StrategySymbol, Address>>;
  rewards: Readonly<Record<RewardSymbol, Address>>;
  externalContracts: RuntimeExternalContracts;
  admin: RuntimeAdminBoundary;
  subgraphUrl: string;
  manifest: RuntimeManifestSummary;
}

export type RuntimeDeployment = DemoRuntimeDeployment | LiveRuntimeDeployment;

export function liveStrategyEntries(runtime: LiveRuntimeDeployment) {
  return strategySymbols.map((symbol) => ({ address: runtime.strategies[symbol], symbol }));
}

export function liveRewardEntries(runtime: LiveRuntimeDeployment) {
  return rewardSymbols.map((symbol) => ({ address: runtime.rewards[symbol], symbol }));
}

export function isLiveRuntime(runtime: RuntimeDeployment): runtime is LiveRuntimeDeployment {
  return runtime.mode === 'live';
}

export function isLocalRehearsal(runtime: RuntimeDeployment): runtime is LiveRuntimeDeployment {
  return runtime.mode === 'live' && runtime.runtimeKind === 'local-rehearsal';
}

export function isTestnetCandidate(runtime: RuntimeDeployment): runtime is LiveRuntimeDeployment {
  return runtime.mode === 'live' && runtime.runtimeKind === 'testnet-candidate';
}
