import type { HexAddress, RobinhoodChainId } from '../chains/types.js';
import type { ManifestStatus } from '../assets/types.js';

export type UniswapV4ContractKey =
  | 'poolManager'
  | 'positionDescriptor'
  | 'positionManager'
  | 'quoter'
  | 'stateView'
  | 'reservesLens'
  | 'universalRouter'
  | 'permit2';

export type UniswapV4Addresses = Readonly<Record<UniswapV4ContractKey, HexAddress>>;

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
