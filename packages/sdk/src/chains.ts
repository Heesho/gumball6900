import {
  getRobinhoodChain as getConfiguredRobinhoodChain,
  robinhoodChains as configuredRobinhoodChains,
  robinhoodMainnet as configuredRobinhoodMainnet,
  robinhoodTestnet as configuredRobinhoodTestnet,
} from '@gumball-6900/config/chains';

/** Supported Robinhood Chain network identifiers. */
export type RobinhoodChainId = 4663 | 46630;

/** Supported Robinhood Chain deployment environments. */
export type RobinhoodEnvironment = 'mainnet' | 'testnet';

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

/** Specification-date Robinhood mainnet metadata. */
export const robinhoodMainnet: RobinhoodChainConfig = configuredRobinhoodMainnet;

/** Specification-date Robinhood testnet metadata. */
export const robinhoodTestnet: RobinhoodChainConfig = configuredRobinhoodTestnet;

/** Chain metadata indexed by supported network identifier. */
export const robinhoodChains: Readonly<Record<RobinhoodChainId, RobinhoodChainConfig>> = configuredRobinhoodChains;

/** Returns metadata for one supported Robinhood Chain identifier. */
export function getRobinhoodChain(chainId: RobinhoodChainId): RobinhoodChainConfig {
  return getConfiguredRobinhoodChain(chainId);
}
