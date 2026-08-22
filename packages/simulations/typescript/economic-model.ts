/** Deterministic integer-only scenarios for the immutable fixed-slot Mine design. */

const WAD = 10n ** 18n;
const BPS = 10_000n;
const DEFAULT_STRATEGY_BRIBE_BPS = 1_000n;
const MAX_STRATEGY_BRIBE_BPS = 2_000n;
const HOUR = 3_600n;
const YEAR = 365n * 24n * HOUR;
const GENESIS_LP_GBX = 20_000_000n * WAD;
const MINE_PRICE_MULTIPLIER = 2n;
const MINE_MINIMUM_INITIAL_PRICE = 1_000_000n;
const MINE_INITIAL_TPS = 64n * WAD;
const MINE_HALVING_PERIOD = 69n * 24n * HOUR;
const MINE_TAIL_TPS = WAD;

type JsonPrimitive = string | boolean | null;
export type DecimalJson = JsonPrimitive | DecimalJson[] | { [key: string]: DecimalJson };

function mulDiv(a: bigint, b: bigint, denominator: bigint): bigint {
  if (a < 0n || b < 0n || denominator <= 0n) throw new RangeError('invalid mulDiv input');
  return (a * b) / denominator;
}

function miningPrice(initialPrice: bigint, elapsed: bigint): bigint {
  return elapsed >= HOUR ? 0n : initialPrice - mulDiv(initialPrice, elapsed, HOUR);
}

function miningRateAt(elapsedSinceStart: bigint): bigint {
  const shifted = MINE_INITIAL_TPS >> (elapsedSinceStart / MINE_HALVING_PERIOD);
  return shifted < MINE_TAIL_TPS ? MINE_TAIL_TPS : shifted;
}

function firstTailBoundary(): bigint {
  for (let boundary = 0n; boundary < 256n; boundary += 1n) {
    if (MINE_INITIAL_TPS >> boundary <= MINE_TAIL_TPS) return boundary;
  }
  throw new RangeError('positive tail must be reached within uint256 shift bounds');
}

const MINE_TAIL_BOUNDARY_COUNT = firstTailBoundary();

function synchronizedMiningEmission(elapsedSinceStart: bigint): bigint {
  if (elapsedSinceStart < 0n) throw new RangeError('elapsed time must be non-negative');

  let emission = 0n;
  for (let era = 0n; era < MINE_TAIL_BOUNDARY_COUNT; era += 1n) {
    const eraStart = era * MINE_HALVING_PERIOD;
    if (elapsedSinceStart <= eraStart) break;
    const remaining = elapsedSinceStart - eraStart;
    const activeSeconds = remaining < MINE_HALVING_PERIOD ? remaining : MINE_HALVING_PERIOD;
    emission += miningRateAt(eraStart) * activeSeconds;
  }

  const tailStart = MINE_TAIL_BOUNDARY_COUNT * MINE_HALVING_PERIOD;
  if (elapsedSinceStart > tailStart) emission += MINE_TAIL_TPS * (elapsedSinceStart - tailStart);
  return emission;
}

function splitPayment(payment: bigint, hasPreviousMiner: boolean) {
  const previousMiner = hasPreviousMiner ? mulDiv(payment, 8_000n, BPS) : 0n;
  return { payment, previousMiner, resonance: payment - previousMiner };
}

function classifyStrategyPayments(
  payments: bigint[],
  bribeBasisPoints: bigint | bigint[] = DEFAULT_STRATEGY_BRIBE_BPS,
) {
  const rates = typeof bribeBasisPoints === 'bigint' ? payments.map(() => bribeBasisPoints) : bribeBasisPoints;
  if (rates.length !== payments.length) throw new RangeError('every Strategy payment needs one Bribe rate');
  if (payments.some((payment) => payment < 0n)) throw new RangeError('Strategy payments must be non-negative');
  if (rates.some((rate) => rate < 0n || rate > MAX_STRATEGY_BRIBE_BPS)) {
    throw new RangeError('Strategy Bribe rate outside protocol bounds');
  }

  let fundLiability = 0n;
  let bribeLiability = 0n;
  let splitRemainder = 0n;
  for (const [index, payment] of payments.entries()) {
    const rate = rates[index]!;
    const baseBribe = mulDiv(payment, rate, BPS);
    const accumulatedRemainder = splitRemainder + ((payment * rate) % BPS);
    const bribeAmount = baseBribe + accumulatedRemainder / BPS;
    splitRemainder = accumulatedRemainder % BPS;
    fundLiability += payment - bribeAmount;
    bribeLiability += bribeAmount;
  }
  return {
    payments,
    bribeBps: rates,
    totalPayment: payments.reduce((sum, payment) => sum + payment, 0n),
    fundLiability,
    bribeLiability,
    splitRemainder,
  };
}

function redemption(balance: bigint, burned: bigint, supply: bigint): bigint {
  return mulDiv(balance, burned, supply);
}

function rawSuite() {
  const globalTpsPerHour = miningRateAt(0n) * HOUR;
  const incumbentRatePerHour = globalTpsPerHour / 16n;
  const newTenureRatePerHour = (miningRateAt(MINE_HALVING_PERIOD) * HOUR) / 16n;
  const allSlotRates = Array<bigint>(16).fill(incumbentRatePerHour);
  const timeBasedSchedule = [
    MINE_HALVING_PERIOD - 1n,
    MINE_HALVING_PERIOD,
    2n * MINE_HALVING_PERIOD - 1n,
    2n * MINE_HALVING_PERIOD,
    MINE_TAIL_BOUNDARY_COUNT * MINE_HALVING_PERIOD - 1n,
    MINE_TAIL_BOUNDARY_COUNT * MINE_HALVING_PERIOD,
    1_000n * MINE_HALVING_PERIOD,
  ].map((elapsedSinceStart) => ({ elapsedSinceStart, globalTps: miningRateAt(elapsedSinceStart) }));
  const boundaryRates = Array.from({ length: Number(MINE_TAIL_BOUNDARY_COUNT) + 1 }, (_, boundaryIndex) => {
    const elapsedSinceStart = BigInt(boundaryIndex) * MINE_HALVING_PERIOD;
    return { boundaryIndex: BigInt(boundaryIndex), elapsedSinceStart, globalTps: miningRateAt(elapsedSinceStart) };
  });
  const synchronizedBoundarySupply = boundaryRates.map(({ boundaryIndex, elapsedSinceStart, globalTps }) => {
    const miningEmission = synchronizedMiningEmission(elapsedSinceStart);
    return {
      boundaryIndex,
      elapsedSinceStart,
      globalTps,
      miningEmission,
      grossSupply: GENESIS_LP_GBX + miningEmission,
    };
  });
  const synchronizedHorizonSupply = [1n, 3n, 5n, 10n, 40n].map((years) => {
    const elapsedSinceStart = years * YEAR;
    const miningEmission = synchronizedMiningEmission(elapsedSinceStart);
    return { years, elapsedSinceStart, miningEmission, grossSupply: GENESIS_LP_GBX + miningEmission };
  });
  const tailStartsAtSeconds = MINE_TAIL_BOUNDARY_COUNT * MINE_HALVING_PERIOD;
  const synchronizedTailRelativeHorizonSupply = [1n, 2n, 5n, 10n].map((yearsAfterTail) => {
    const elapsedSinceTail = yearsAfterTail * YEAR;
    const elapsedSinceStart = tailStartsAtSeconds + elapsedSinceTail;
    const miningEmission = synchronizedMiningEmission(elapsedSinceStart);
    const grossSupply = GENESIS_LP_GBX + miningEmission;
    return {
      yearsAfterTail,
      elapsedSinceTail,
      elapsedSinceStart,
      miningEmission,
      grossSupply,
      annualTailInflationPpm: mulDiv(MINE_TAIL_TPS * YEAR, 1_000_000n, grossSupply),
    };
  });
  const miningEmissionAtTail = synchronizedMiningEmission(tailStartsAtSeconds);

  const mintedSupplyBefore = 100_000_000n * WAD;
  const pendingMining = 1_000_000n * WAD;
  const fundUSDG = 50_000_000n * 10n ** 6n;
  const redeemGBX = 1_000_000n * WAD;

  return {
    schemaVersion: 13,
    purpose: 'Deterministic protocol mechanics; not forecasts, valuations, or investment projections.',
    assumptions: {
      genesisLiquidityAllocationGBXRaw: GENESIS_LP_GBX,
      infiniteSupply: true,
      priceDecaySeconds: HOUR,
      previousMinerBps: 8_000n,
      resonanceRevenueBps: 2_000n,
      fixedSlotCount: 16n,
      minePriceMultiplier: MINE_PRICE_MULTIPLIER,
      mineMinimumInitialPrice: MINE_MINIMUM_INITIAL_PRICE,
      mineInitialTps: MINE_INITIAL_TPS,
      mineHalvingPeriodSeconds: MINE_HALVING_PERIOD,
      mineTailTps: MINE_TAIL_TPS,
      mineTailBoundaryCount: MINE_TAIL_BOUNDARY_COUNT,
      tenureRatesLocked: true,
      redemptionsUseConstantTimeEffectiveSupply: true,
      checkpointAllExists: false,
      defaultStrategyBribeBps: DEFAULT_STRATEGY_BRIBE_BPS,
      maximumStrategyBribeBps: MAX_STRATEGY_BRIBE_BPS,
      minimumStrategyBribeBps: 0n,
      strategyFundBpsIsDerived: true,
    },
    mining: {
      timeBasedSchedule: {
        points: timeBasedSchedule,
        boundaryRates,
        emptyMarketAtFirstBoundary: {
          elapsedSinceStart: MINE_HALVING_PERIOD,
          totalMined: 0n,
          pendingEmission: 0n,
          globalTps: miningRateAt(MINE_HALVING_PERIOD),
        },
        explanation:
          'The prospective rate depends only on elapsed deployment time; empty occupancy and zero mining do not pause it.',
      },
      synchronizedSupply: {
        referenceCase: 'synchronized-full-refresh-no-burn',
        modelAssumption:
          'Synchronized full-refresh, no-burn reference: all sixteen slots are occupied from deployment, all sixteen refresh to the prospective rate at every boundary, and all accrued emission is settled. Actual tenure-locked issuance depends on slot occupancy and turnover; this is neither a supply cap nor a forecast.',
        boundaryPoints: synchronizedBoundarySupply,
        horizonPoints: synchronizedHorizonSupply,
        tailRelativeHorizonPoints: synchronizedTailRelativeHorizonSupply,
        tailBoundaryCount: MINE_TAIL_BOUNDARY_COUNT,
        tailStartsAtSeconds,
        miningEmissionAtTail,
        grossSupplyAtTail: GENESIS_LP_GBX + miningEmissionAtTail,
        minedBpsOfGrossSupplyAtTail: mulDiv(miningEmissionAtTail, BPS, GENESIS_LP_GBX + miningEmissionAtTail),
        annualTailInflationPpmAtTail: mulDiv(MINE_TAIL_TPS * YEAR, 1_000_000n, GENESIS_LP_GBX + miningEmissionAtTail),
      },
      priceCurve: [0n, 900n, 1_800n, 2_700n, 3_600n].map((elapsedSeconds) => ({
        elapsedSeconds,
        priceRaw: miningPrice(2_000_000n, elapsedSeconds),
      })),
      paymentSplits: [
        { id: 'empty-slot', ...splitPayment(1_000_000n, false) },
        { id: 'replacement', ...splitPayment(1_000_000n, true) },
      ],
      staggeredFixedSlots: {
        incumbentRatePerHour,
        incumbentRateAfterHalvingPerHour: incumbentRatePerHour,
        newTenureRatePerHour,
        oneHourEmissions: [incumbentRatePerHour, newTenureRatePerHour, newTenureRatePerHour],
        aggregateOneHourEmission: incumbentRatePerHour + newTenureRatePerHour * 2n,
        explanation:
          'All slots divide the global TPS by sixteen. A halving affects only newly occupied or replaced tenures.',
      },
      allSlotsBeforeHalving: {
        slotCount: 16n,
        assignedRatesPerHour: allSlotRates,
        aggregateOneHourEmission: allSlotRates.reduce((sum, rate) => sum + rate, 0n),
        globalRatePerHour: globalTpsPerHour,
        aggregateBpsOfGlobalRate: mulDiv(
          allSlotRates.reduce((sum, rate) => sum + rate, 0n),
          BPS,
          globalTpsPerHour,
        ),
        explanation: 'Sixteen occupied slots at the same generation exactly reproduce the global rate.',
      },
      handoffHalving: {
        halvingPeriodSeconds: MINE_HALVING_PERIOD,
        globalRateBeforePerHour: globalTpsPerHour,
        globalRateAfterPerHour: miningRateAt(MINE_HALVING_PERIOD) * HOUR,
        incumbentSlotRateAfterBoundaryPerHour: incumbentRatePerHour,
        nextReplacementSlotRatePerHour: newTenureRatePerHour,
        aggregateLockedSixteenSlotsPerHour: allSlotRates.reduce((sum, rate) => sum + rate, 0n),
      },
      infiniteTail: {
        tailRatePerSecond: MINE_TAIL_TPS,
        annualTailEmission: MINE_TAIL_TPS * YEAR,
        years: [1n, 10n, 100n].map((years) => ({ years, emission: MINE_TAIL_TPS * YEAR * years })),
      },
    },
    redemption: {
      mintedSupplyBefore,
      pendingMining,
      effectiveSupplyBeforeBurn: mintedSupplyBefore + pendingMining,
      fundUSDGRaw: fundUSDG,
      redeemGBX,
      payoutIgnoringPendingRaw: redemption(fundUSDG, redeemGBX, mintedSupplyBefore),
      payoutWithEffectiveSupplyRaw: redemption(fundUSDG, redeemGBX, mintedSupplyBefore + pendingMining),
    },
    genesisLiquidity: {
      publicBootstrap: false,
      genesisLiquidityAllocationGBXRaw: GENESIS_LP_GBX,
      oneSidedPositionBudgetGBXRaw: GENESIS_LP_GBX,
      positionPrincipalRemainsFixed: true,
    },
    strategyAuction: {
      durationSeconds: 86_400n,
      curve: [0n, 21_600n, 43_200n, 64_800n, 86_400n].map((elapsedSeconds) => ({
        elapsedSeconds,
        paymentAmount: elapsedSeconds >= 86_400n ? 0n : 100n * WAD - mulDiv(100n * WAD, elapsedSeconds, 86_400n),
      })),
      cumulativeSplitIsFrequencyIndependent: true,
      tenOneUnitPayments: classifyStrategyPayments(Array<bigint>(10).fill(1n)),
      oneCombinedPayment: classifyStrategyPayments([10n]),
      rateChangeSequence: classifyStrategyPayments([7n, 13n, 19n, 23n], [1_000n, 0n, 500n, 2_000n]),
      zeroPercentPayments: classifyStrategyPayments([1n, 7n, 1_000_000n], 0n),
      directRouterDonationSurplus: 7n,
    },
    supply: {
      identity: 'totalSupply = lifetimeMinted - lifetimeBurned',
      lifetimeMinted: 125_000_000n * WAD,
      lifetimeBurned: 5_000_000n * WAD,
      totalSupply: 120_000_000n * WAD,
      maximumSupply: null,
    },
  };
}

function decimal(value: unknown): DecimalJson {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string' || typeof value === 'boolean' || value === null) return value;
  if (typeof value === 'number') return value.toString();
  if (Array.isArray(value)) return value.map(decimal);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, decimal(entry)]),
    );
  }
  throw new TypeError(`unsupported fixture value: ${String(value)}`);
}

export function computeEconomicSuite(): DecimalJson {
  return decimal(rawSuite());
}

if (process.argv[1]?.endsWith('economic-model.ts') || process.argv[1]?.endsWith('economic-model.js')) {
  process.stdout.write(`${JSON.stringify(computeEconomicSuite(), null, 2)}\n`);
}
