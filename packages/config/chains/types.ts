export type HexAddress = `0x${string}`;

export type RobinhoodChainId = 4663 | 46630;

export type RobinhoodEnvironment = 'mainnet' | 'testnet';

export interface NativeCurrencyConfig {
  readonly name: string;
  readonly symbol: string;
  readonly decimals: 18;
}

export interface BlockExplorerConfig {
  readonly name: string;
  readonly url: `https://${string}`;
}

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
