import { expect } from 'chai';

import {
  assertLaunchActivePauseFlags,
  type ObservedLaunchPauseFlags,
} from '../../../script/hardhat/launch-active-verification';

function activeFlags(): ObservedLaunchPauseFlags {
  return {
    acquisitionStrategyFillsPaused: [false, false],
    buybackFillsPaused: false,
    liquidityMigrationsPaused: false,
    miningContributionsPaused: false,
    signalActivationsPaused: false,
  };
}

describe('Launch-active verification', function () {
  it('accepts a fully active launch surface', function () {
    expect(() => assertLaunchActivePauseFlags(activeFlags())).not.to.throw();
  });

  it('rejects paused signal activations', function () {
    expect(() => assertLaunchActivePauseFlags({ ...activeFlags(), signalActivationsPaused: true })).to.throw(
      'allocation voter signal activations are paused',
    );
  });

  it('rejects paused mining contributions', function () {
    expect(() => assertLaunchActivePauseFlags({ ...activeFlags(), miningContributionsPaused: true })).to.throw(
      'mining contributions are paused',
    );
  });

  it('rejects every paused acquisition strategy by index', function () {
    expect(() =>
      assertLaunchActivePauseFlags({ ...activeFlags(), acquisitionStrategyFillsPaused: [false, true] }),
    ).to.throw('acquisition strategy 1 fills are paused');
  });

  it('rejects paused buyback fills', function () {
    expect(() => assertLaunchActivePauseFlags({ ...activeFlags(), buybackFillsPaused: true })).to.throw(
      'buyback fills are paused',
    );
  });

  it('rejects paused liquidity migrations', function () {
    expect(() => assertLaunchActivePauseFlags({ ...activeFlags(), liquidityMigrationsPaused: true })).to.throw(
      'liquidity migrations are paused',
    );
  });
});
