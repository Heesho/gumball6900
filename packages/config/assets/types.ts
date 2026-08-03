import type { HexAddress, RobinhoodChainId } from '../chains/types.js';

export type ManifestStatus = 'provisional' | 'unresolved' | 'verified';

export type CanonicalTokenKey = 'USDG' | 'WETH';

export type DeploymentResolvedAssetKey = 'WRAPPED_BTC' | 'QQQ' | 'TSLA' | 'SPCX' | 'NVDA' | 'AAPL';

export type RobinhoodStockTokenKey = Exclude<DeploymentResolvedAssetKey, 'WRAPPED_BTC'>;

export interface CanonicalTokenRecord {
  readonly key: CanonicalTokenKey;
  readonly address: HexAddress;
  readonly expectedSymbol: CanonicalTokenKey;
  readonly expectedDecimals: number;
  readonly role: 'quote-token' | 'wrapped-native';
}

export interface ProvisionalStockTokenCandidate {
  readonly address: HexAddress;
  readonly uid: `0x${string}`;
  readonly registryStatus: 'ASSET_STATUS_ACTIVE';
  readonly currentMultiplier: `${number}.${number}`;
  readonly observedOn: `${number}-${number}-${number}`;
}

export interface ProvisionalWrappedBtcBridgeCandidate {
  readonly address: HexAddress;
  readonly candidatePath: `packages/config/deployments/robinhood-mainnet-wrapped-btc.${number}-${number}-${number}.candidate.json`;
  readonly expectedDecimals: 8;
  readonly expectedSymbol: 'WBTC';
  readonly l1Token: HexAddress;
  readonly l2Gateway: HexAddress;
  readonly l2GatewayImplementation: HexAddress;
  readonly l2GatewayRouter: HexAddress;
  readonly l2GatewayRouterImplementation: HexAddress;
  readonly observedBlock: `${number}`;
  readonly observedOn: `${number}-${number}-${number}`;
  readonly proxyAdmin: HexAddress;
  readonly proxyAdminOwner: HexAddress;
  readonly proxyAdminOwnerImplementation: HexAddress;
  readonly rawSha256: `${string}`;
}

export type DeploymentResolvedAssetRequirement =
  | {
      readonly key: 'WRAPPED_BTC';
      readonly resolutionAuthority: 'official-bridge-and-token-registry';
      readonly expectedSymbol?: never;
      readonly expectedDecimals?: never;
      readonly provisionalRegistryCandidate?: never;
      readonly provisionalBridgeCandidate?: ProvisionalWrappedBtcBridgeCandidate;
    }
  | {
      [Key in RobinhoodStockTokenKey]: {
        readonly key: Key;
        readonly expectedSymbol: Key;
        readonly expectedDecimals: 18;
        readonly resolutionAuthority: 'official-stock-token-registry';
        readonly provisionalRegistryCandidate?: ProvisionalStockTokenCandidate;
      };
    }[RobinhoodStockTokenKey];

export interface CanonicalAssetManifest {
  readonly schemaVersion: 1;
  readonly chainId: RobinhoodChainId;
  readonly status: ManifestStatus;
  readonly specificationAsOf: `${number}-${number}-${number}`;
  readonly sourceUrl: `https://${string}`;
  readonly liveRegistryUrl: `https://${string}`;
  readonly canonicalTokens: readonly CanonicalTokenRecord[];
  readonly deploymentResolvedAssets: readonly DeploymentResolvedAssetRequirement[];
  readonly deploymentChecks: readonly string[];
  readonly notes: readonly string[];
}
