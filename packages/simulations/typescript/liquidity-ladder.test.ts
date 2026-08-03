import { describe, expect, it } from 'vitest';

import {
  createCanonicalLadderModel,
  GENESIS_LIQUIDITY_GBX_RAW,
  liquidityLadderState,
  simulateLadderBuy,
  simulateLadderSellAfterBuy,
  type LadderOrdering,
} from './liquidity-ladder.js';

const GBX = 10n ** 18n;
const USDG = 10n ** 6n;

describe.each<LadderOrdering>(['gbx-token0', 'gbx-token1'])('official v4 genesis ladder (%s)', (ordering) => {
  it('is tick-aligned, one-sided, fee-configured, and conserves the 20M GBX allocation', () => {
    const model = createCanonicalLadderModel(ordering);
    const state = liquidityLadderState(model);

    expect(model.pool.fee).toBe(3_000);
    expect(model.pool.tickSpacing).toBe(60);
    expect(state.usdGInventoryRaw).toBe(0n);
    expect(state.gbxRemainingRaw).toBe(model.genesisPrincipalGBXRaw);
    expect(model.genesisPrincipalGBXRaw + model.genesisResidualGBXRaw).toBe(GENESIS_LIQUIDITY_GBX_RAW);
    expect(model.genesisResidualGBXRaw).toBeLessThan(1_000_000n);
    expect(model.positions.map((position) => position.allocationBps)).toEqual([5_000, 3_000, 1_500, 500]);
    for (const position of model.positions) {
      expect(Math.abs(position.tickLower % 60)).toBe(0);
      expect(Math.abs(position.tickUpper % 60)).toBe(0);
      expect(position.tickLower).toBeLessThan(position.tickUpper);
      expect(position.genesisPrincipalGBXRaw).toBeLessThanOrEqual(position.allocationCapGBXRaw);
      expect(position.liquidity).toBeGreaterThan(0n);
    }
  });

  it('executes fee-aware buys with explicit price impact and converts GBX into USDG', async () => {
    const result = await simulateLadderBuy(5_000_000n * USDG, ordering);

    expect(result.direction).toBe('USDG_TO_GBX');
    expect(result.executionOutputRaw).toBeGreaterThan(0n);
    expect(result.executionOutputRaw).toBeLessThan(result.midPriceOutputRaw);
    expect(result.priceImpactBps).toBeGreaterThan(30n);
    expect(result.after.gbxPriceUSDGWad).toBeGreaterThan(result.before.gbxPriceUSDGWad);
    expect(result.after.gbxRemainingRaw).toBeLessThan(result.before.gbxRemainingRaw);
    expect(result.after.usdGInventoryRaw).toBeGreaterThan(0n);
    expect(result.after.tick).not.toBe(result.before.tick);
  });

  it('supports a subsequent sell only after buys have accumulated USDG', async () => {
    const { buy, sell } = await simulateLadderSellAfterBuy(5_000_000n * USDG, 1_000_000n * GBX, ordering);

    expect(sell.direction).toBe('GBX_TO_USDG');
    expect(sell.executionOutputRaw).toBeGreaterThan(0n);
    expect(sell.executionOutputRaw).toBeLessThan(sell.midPriceOutputRaw);
    expect(sell.after.gbxPriceUSDGWad).toBeLessThan(buy.after.gbxPriceUSDGWad);
    expect(sell.after.gbxRemainingRaw).toBeGreaterThan(buy.after.gbxRemainingRaw);
    expect(sell.after.usdGInventoryRaw).toBeLessThan(buy.after.usdGInventoryRaw);
  });
});

it('rejects zero-size trades before invoking the SDK swap engine', async () => {
  await expect(simulateLadderBuy(0n)).rejects.toThrow('positive');
});
