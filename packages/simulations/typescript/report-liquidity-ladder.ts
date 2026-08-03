import {
  createCanonicalLadderModel,
  liquidityLadderState,
  simulateLadderBuy,
  simulateLadderSellAfterBuy,
  type LadderOrdering,
  type LadderTradeResult,
} from './liquidity-ladder.js';

const GBX = 10n ** 18n;
const USDG = 10n ** 6n;

function stateJson(state: ReturnType<typeof liquidityLadderState>) {
  return {
    activeLiquidity: state.activeLiquidity.toString(),
    gbxPriceUSDGWad: state.gbxPriceUSDGWad.toString(),
    gbxRemainingRaw: state.gbxRemainingRaw.toString(),
    genesisPriceMultipleWad: state.genesisPriceMultipleWad.toString(),
    sqrtPriceX96: state.sqrtPriceX96.toString(),
    tick: state.tick,
    usdGInventoryRaw: state.usdGInventoryRaw.toString(),
  };
}

function tradeJson(result: LadderTradeResult) {
  return {
    after: stateJson(result.after),
    direction: result.direction,
    executionOutputRaw: result.executionOutputRaw.toString(),
    inputRaw: result.inputRaw.toString(),
    midPriceOutputRaw: result.midPriceOutputRaw.toString(),
    priceImpactBps: result.priceImpactBps.toString(),
  };
}

async function orderingReport(ordering: LadderOrdering) {
  const model = createCanonicalLadderModel(ordering);
  const buySizes = [100_000n * USDG, 1_000_000n * USDG, 5_000_000n * USDG];
  const buys = await Promise.all(buySizes.map((amount) => simulateLadderBuy(amount, ordering)));
  const sellSizes = [100_000n * GBX, 1_000_000n * GBX];
  const sells = await Promise.all(
    sellSizes.map(async (amount) => (await simulateLadderSellAfterBuy(5_000_000n * USDG, amount, ordering)).sell),
  );
  return {
    buys: buys.map(tradeJson),
    genesis: {
      ...stateJson(liquidityLadderState(model)),
      genesisPrincipalGBXRaw: model.genesisPrincipalGBXRaw.toString(),
      genesisResidualGBXRaw: model.genesisResidualGBXRaw.toString(),
      positions: model.positions.map((position) => ({
        allocationBps: position.allocationBps,
        allocationCapGBXRaw: position.allocationCapGBXRaw.toString(),
        genesisPrincipalGBXRaw: position.genesisPrincipalGBXRaw.toString(),
        liquidity: position.liquidity.toString(),
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
      })),
    },
    ordering,
    sellsAfterFiveMillionUSDGBuy: sells.map(tradeJson),
  };
}

// Top-level await keeps the report command deterministic without hiding asynchronous v4 tick traversal.
const orderings = await Promise.all(
  (['gbx-token0', 'gbx-token1'] as const).map((ordering) => orderingReport(ordering)),
);
const report = {
  disclaimer: 'Deterministic official-Uniswap-SDK mechanics; not a forecast, NAV, or promised execution price.',
  feeHundredthsOfBasisPoint: 3_000,
  orderings,
};
if (!process.argv.includes('--check')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
