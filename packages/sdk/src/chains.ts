import {
  getRobinhoodChain as getConfiguredRobinhoodChain,
  robinhoodChains as configuredRobinhoodChains,
  robinhoodMainnet as configuredRobinhoodMainnet,
  robinhoodTestnet as configuredRobinhoodTestnet,
} from '@gumball-6900/config/chains';
import {
  robinhoodMainnetUniswapV4Manifest as configuredRobinhoodMainnetUniswapV4Manifest,
  robinhoodTestnetUniswapV4Manifest as configuredRobinhoodTestnetUniswapV4Manifest,
} from '@gumball-6900/config/uniswap-v4';

/** Hex-encoded EVM address. */
export type HexAddress = `0x${string}`;

/** Supported Robinhood Chain network identifiers. */
export type RobinhoodChainId = 4663 | 46630;

/** Supported Robinhood Chain deployment environments. */
export type RobinhoodEnvironment = 'mainnet' | 'testnet';

/** Freshness and deployment-authorization status for external-address inputs. */
export type ManifestStatus = 'provisional' | 'unresolved' | 'verified';

/** Native-currency fields required by wallet clients. */
export interface NativeCurrencyConfig {
  readonly name: string;
  readonly symbol: string;
  readonly decimals: 18;
}

/** Canonical explorer metadata. */
export interface BlockExplorerConfig {
  readonly name: string;
  readonly url: `https://${string}`;
}

/** SDK-safe Robinhood Chain metadata without a private workspace runtime dependency. */
export interface RobinhoodChainConfig {
  readonly id: RobinhoodChainId;
  readonly environment: RobinhoodEnvironment;
  readonly name: string;
  readonly nativeCurrency: NativeCurrencyConfig;
  readonly publicRpcUrls: readonly [`https://${string}`, ...Array<`https://${string}`>];
  readonly explorer: BlockExplorerConfig;
  readonly archiveRpcRequiredForProduction: true;
  readonly sourceUrl: `https://${string}`;
}

/** Canonical external contracts used by the GBX/USDG Uniswap v4 integration. */
export type UniswapV4ContractKey =
  | 'poolManager'
  | 'positionDescriptor'
  | 'positionManager'
  | 'quoter'
  | 'stateView'
  | 'reservesLens'
  | 'universalRouter'
  | 'permit2';

/** Complete address record for one canonical Uniswap v4 deployment. */
export type UniswapV4Addresses = Readonly<Record<UniswapV4ContractKey, HexAddress>>;

/** Fail-closed Uniswap v4 deployment input and its verification requirements. */
export interface UniswapV4Manifest {
  readonly schemaVersion: 1;
  readonly chainId: RobinhoodChainId;
  readonly status: ManifestStatus;
  readonly specificationAsOf: `${number}-${number}-${number}`;
  readonly sourceUrl: `https://${string}`;
  readonly addresses: Partial<UniswapV4Addresses>;
  readonly deploymentChecks: readonly string[];
  readonly notes: readonly string[];
}

/** Specification-date Robinhood mainnet metadata. */
export const robinhoodMainnet: RobinhoodChainConfig = configuredRobinhoodMainnet;

/** Specification-date Robinhood testnet metadata. */
export const robinhoodTestnet: RobinhoodChainConfig = configuredRobinhoodTestnet;

/** Chain metadata indexed by supported network identifier. */
export const robinhoodChains: Readonly<Record<RobinhoodChainId, RobinhoodChainConfig>> = configuredRobinhoodChains;

/** Provisional mainnet v4 inputs that still require release-manifest verification. */
export const robinhoodMainnetUniswapV4Manifest: UniswapV4Manifest = configuredRobinhoodMainnetUniswapV4Manifest;

/** Partially discovered testnet v4 inputs that remain unresolved and intentionally fail deployment authorization. */
export const robinhoodTestnetUniswapV4Manifest: UniswapV4Manifest = configuredRobinhoodTestnetUniswapV4Manifest;

/** Returns metadata for one supported Robinhood Chain identifier. */
export function getRobinhoodChain(chainId: RobinhoodChainId): RobinhoodChainConfig {
  return getConfiguredRobinhoodChain(chainId);
}
