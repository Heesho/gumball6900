export interface ObservedLaunchPauseFlags {
  acquisitionStrategyFillsPaused: boolean[];
  buybackFillsPaused: boolean;
  liquidityMigrationsPaused: boolean;
  miningContributionsPaused: boolean;
  signalActivationsPaused: boolean;
}

/** Requires every guardian-controlled launch path to be active at the verified block. */
export function assertLaunchActivePauseFlags(actual: ObservedLaunchPauseFlags): void {
  if (actual.signalActivationsPaused) {
    throw new Error('allocation voter signal activations are paused in the launch manifest');
  }
  if (actual.miningContributionsPaused) {
    throw new Error('mining contributions are paused in the launch manifest');
  }
  for (let index = 0; index < actual.acquisitionStrategyFillsPaused.length; index += 1) {
    if (actual.acquisitionStrategyFillsPaused[index]) {
      throw new Error(`acquisition strategy ${index} fills are paused in the launch manifest`);
    }
  }
  if (actual.buybackFillsPaused) {
    throw new Error('buyback fills are paused in the launch manifest');
  }
  if (actual.liquidityMigrationsPaused) {
    throw new Error('liquidity migrations are paused in the launch manifest');
  }
}
