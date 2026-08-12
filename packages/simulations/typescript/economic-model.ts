/** Deterministic integer-only scenarios for the immutable multislot Mine design. */

const WAD = 10n ** 18n;
const BPS = 10_000n;
const HOUR = 3_600n;
const YEAR = 365n * 24n * HOUR;
const GENESIS_LP_GBX = 20_000_000n * WAD;

type JsonPrimitive = string | boolean | null;
export type DecimalJson = JsonPrimitive | DecimalJson[] | { [key: string]: DecimalJson };

function mulDiv(a: bigint, b: bigint, denominator: bigint): bigint {
  if (a < 0n || b < 0n || denominator <= 0n) throw new RangeError('invalid mulDiv input');
  return (a * b) / denominator;
}

function miningPrice(initialPrice: bigint, elapsed: bigint): bigint {
  return elapsed >= HOUR ? 0n : initialPrice - mulDiv(initialPrice, elapsed, HOUR);
}

function splitPayment(payment: bigint, hasPreviousMiner: boolean) {
  const previousMiner = hasPreviousMiner ? mulDiv(payment, 8_000n, BPS) : 0n;
  return { payment, previousMiner, resonance: payment - previousMiner };
}

function redemption(balance: bigint, burned: bigint, supply: bigint): bigint {
  return mulDiv(balance, burned, supply);
}

function rawSuite() {
  const incumbentRatePerHour = 100n * WAD;
  const capacity = 3n;
  const newSlotRatePerHour = incumbentRatePerHour / capacity;
  const legacyOneHour = incumbentRatePerHour;
  const newSlotOneHour = newSlotRatePerHour;

  const supplyBeforeCheckpoint = 100_000_000n * WAD;
  const pendingMining = 1_000_000n * WAD;
  const fundUSDG = 50_000_000n * 10n ** 6n;
  const redeemGBX = 1_000_000n * WAD;

  return {
    schemaVersion: 5,
    purpose: 'Deterministic protocol mechanics; not forecasts, valuations, or investment projections.',
    assumptions: {
      genesisLiquidityAllocationGBXRaw: GENESIS_LP_GBX,
      infiniteSupply: true,
      priceDecaySeconds: HOUR,
      previousMinerBps: 8_000n,
      resonanceRevenueBps: 2_000n,
      maximumCapacity: 16n,
      tenureRatesLocked: true,
      capacityOnlyIncreases: true,
      redemptionsCheckpointAllSlots: true,
    },
    mining: {
      priceCurve: [0n, 900n, 1_800n, 2_700n, 3_600n].map((elapsedSeconds) => ({
        elapsedSeconds,
        priceRaw: miningPrice(2_000_000n, elapsedSeconds),
      })),
      paymentSplits: [
        { id: 'empty-slot', ...splitPayment(1_000_000n, false) },
        { id: 'replacement', ...splitPayment(1_000_000n, true) },
      ],
      capacityExpansion: {
        capacityBefore: 1n,
        capacityAfter: capacity,
        incumbentRatePerHour,
        incumbentRateAfterExpansionPerHour: incumbentRatePerHour,
        newSlotRatePerHour,
        oneHourEmissions: [legacyOneHour, newSlotOneHour, newSlotOneHour],
        aggregateOneHourEmission: legacyOneHour + newSlotOneHour * 2n,
        undividedGlobalRatePerHour: incumbentRatePerHour,
        explanation:
          'Occupied slots keep their tenure rate. Only newly occupied or replaced slots divide the current global rate by current capacity.',
      },
      handoffHalving: {
        halvingAmount: 490_000_000n * WAD,
        globalRateBefore: 100n * WAD,
        globalRateAfter: 50n * WAD,
        incumbentRateAfterThreshold: 100n * WAD,
        nextReplacementRateAtCapacityThree: (50n * WAD) / 3n,
      },
      infiniteTail: {
        tailRatePerSecond: 10n ** 16n,
        annualTailEmission: 10n ** 16n * YEAR,
        years: [1n, 10n, 100n].map((years) => ({ years, emission: 10n ** 16n * YEAR * years })),
      },
    },
    redemption: {
      supplyBeforeCheckpoint,
      pendingMining,
      denominatorAfterCheckpoint: supplyBeforeCheckpoint + pendingMining,
      fundUSDGRaw: fundUSDG,
      redeemGBX,
      payoutWithoutCheckpointRaw: redemption(fundUSDG, redeemGBX, supplyBeforeCheckpoint),
      payoutWithCheckpointRaw: redemption(fundUSDG, redeemGBX, supplyBeforeCheckpoint + pendingMining),
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
      completePaymentIsFundLiability: true,
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
