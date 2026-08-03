import {
  readCanonicalV4Snapshot,
  type CanonicalV4ActivePositionIndex,
  type CanonicalV4Snapshot,
} from '@gumball-6900/sdk';
import type { PublicClient } from 'viem';

import type { LiveRuntimeDeployment } from './runtime-types';

/** Reads the signed runtime's canonical v4 graph through the SDK's single-block validator. */
export function readLiveLiquidity(
  client: PublicClient,
  runtime: LiveRuntimeDeployment,
  activePositions?: CanonicalV4ActivePositionIndex,
): Promise<CanonicalV4Snapshot> {
  return readCanonicalV4Snapshot(client, {
    ...(activePositions === undefined ? {} : { activePositions }),
    expected: {
      chainId: runtime.chain.id,
      gbx: runtime.assets.GBX,
      gbxDecimals: runtime.assetMetadata.GBX.decimals,
      launchGuardHook: runtime.addresses.launchGuardHook,
      liquidityManager: runtime.addresses.liquidityManager,
      permit2: runtime.externalContracts.permit2.address,
      poolManager: runtime.externalContracts.poolManager.address,
      positionManager: runtime.externalContracts.positionManager.address,
      stateView: runtime.externalContracts.stateView.address,
      usdG: runtime.assets.USDG,
      usdGDecimals: runtime.assetMetadata.USDG.decimals,
    },
  });
}
