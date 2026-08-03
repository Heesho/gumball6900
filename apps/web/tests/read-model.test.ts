import { describe, expect, it } from 'vitest';

import { navigationItems } from '../lib/navigation';
import { protocolSnapshot, redemptionPreview, signalAllocations, strategyFills, vaultAssets } from '../lib/read-model';

describe('typed protocol read model', () => {
  it('preserves the supply identity', () => {
    expect(protocolSnapshot.totalSupply).toBe(protocolSnapshot.cumulativeMinted - protocolSnapshot.cumulativeBurned);
  });

  it('accounts for the complete display basket and signal allocation', () => {
    expect(vaultAssets.reduce((total, asset) => total + asset.displayShareBps, 0n)).toBe(10_000n);
    expect(signalAllocations.reduce((total, signal) => total + signal.activeBps, 0n)).toBe(10_000n);
  });

  it('derives every raw redemption amount from supplyBefore', () => {
    for (const asset of redemptionPreview.assets) {
      const vaultAsset = vaultAssets.find((candidate) => candidate.symbol === asset.symbol);
      expect(vaultAsset).toBeDefined();
      expect(asset.rawAmount).toBe(
        (vaultAsset!.rawBalance * redemptionPreview.shares) / redemptionPreview.supplyBefore,
      );
    }
  });

  it('preserves the immutable 98/2 target-asset split on every acquisition fill', () => {
    for (const fill of strategyFills) {
      expect(fill.vaultReceived + fill.managerReceived).toBe(fill.targetReceived);
      expect(fill.vaultReceived).toBe((fill.targetReceived * 9_800n) / 10_000n);
      expect(fill.managerReceived).toBe((fill.targetReceived * 200n) / 10_000n);
    }
  });

  it('declares every required application route exactly once', () => {
    expect(navigationItems.map(({ href }) => href)).toEqual([
      '/',
      '/mine',
      '/manage',
      '/vault',
      '/redeem',
      '/trade',
      '/liquidity',
      '/activity',
      '/admin',
    ]);
    expect(new Set(navigationItems.map(({ href }) => href)).size).toBe(navigationItems.length);
  });
});
