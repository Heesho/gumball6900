/**
 * Deterministic, integer-only economic scenario model for master-spec section 33.
 *
 * All token and price arithmetic uses bigint. The returned public fixture converts
 * every integer to a decimal string so no consumer can silently lose precision.
 */

const WAD = 10n ** 18n;
const BPS = 10_000n;
const DAY = 86_400n;
const USDG_DECIMALS = 6;
const USDG_UNIT = 10n ** BigInt(USDG_DECIMALS);
const USDG_NORMALIZATION_SCALE = WAD / USDG_UNIT;
// Strategy rates are human-normalized target tokens per USDG, scaled by WAD.
const UNIT_TARGET_PER_USDG_RATE = WAD;

// Launch value of the signal-reward share. Settable through timelocked governance, capped
// at MAX_MANAGER_REWARD_BPS. Declared here rather than imported so this model stays an
// independent implementation that can disagree with the SDK and be caught doing so.
const MANAGER_REWARD_BPS = 1_000n;
const MAX_MANAGER_REWARD_BPS = 5_000n;

const MAX_CUMULATIVE_MINT = 1_000_000_000n * WAD;
const GENESIS_LP_GBX = 20_000_000n * WAD;
const GENESIS_SUPPLY = GENESIS_LP_GBX;
const MINING_EMISSION_ALLOCATION = MAX_CUMULATIVE_MINT - GENESIS_SUPPLY;
const HALF_LIFE_DECAY_COMPLEMENT_X54 = 474_645_662_939_839_603_777_555_401_729_090_269_549_790_568_890_158n;
const HALF_LIFE_DERIVATION_PRECISION = 10n ** 54n;
const INITIAL_DAILY_EMISSION =
  (MINING_EMISSION_ALLOCATION * HALF_LIFE_DECAY_COMPLEMENT_X54) / HALF_LIFE_DERIVATION_PRECISION;
const DAILY_DECAY_WAD = 999_525_354_337_060_160n;

const HORIZON_DAYS = [365, 1_460, 2_920, 5_840, 11_680] as const;
const EMISSION_BURN_BPS = [0n, 5_000n, 10_000n, 12_500n, 15_000n] as const;

type ParticipationPattern = 'all-nonempty-large' | 'all-nonempty-one-atom' | 'sporadic-nonempty' | 'long-empty-period';

type JsonPrimitive = string | boolean | null;
export type DecimalJson = JsonPrimitive | DecimalJson[] | { [key: string]: DecimalJson };

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

function max(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

function mulDiv(a: bigint, b: bigint, denominator: bigint): bigint {
  if (a < 0n || b < 0n || denominator <= 0n)
    throw new RangeError('mulDiv requires non-negative values and a positive denominator');
  return (a * b) / denominator;
}

function mulDivUp(a: bigint, b: bigint, denominator: bigint): bigint {
  if (a < 0n || b < 0n || denominator <= 0n) {
    throw new RangeError('mulDivUp requires non-negative values and a positive denominator');
  }
  if (a === 0n || b === 0n) return 0n;
  return (a * b + denominator - 1n) / denominator;
}

function tokens(amount: bigint): bigint {
  return amount * WAD;
}

function usdG(amount: bigint): bigint {
  return amount * USDG_UNIT;
}

function normalizeUSDG(rawAmount: bigint): bigint {
  return rawAmount * USDG_NORMALIZATION_SCALE;
}

function usdGPriceWad(rawUSDG: bigint, gbxAmount: bigint): bigint {
  return mulDiv(normalizeUSDG(rawUSDG), WAD, gbxAmount);
}

function contributionForEpoch(pattern: ParticipationPattern, dayIndex: number): bigint {
  switch (pattern) {
    case 'all-nonempty-large':
      return usdG(1_000n);
    case 'all-nonempty-one-atom':
      return 1n;
    case 'sporadic-nonempty': {
      const weekly = [1n, 0n, usdG(100n), 0n, usdG(1_000n), 1n, 0n] as const;
      return weekly[dayIndex % weekly.length] ?? 0n;
    }
    case 'long-empty-period':
      if (dayIndex < 365) return 1n;
      if (dayIndex < 2_365) return 0n;
      return dayIndex % 3 === 0 ? 1n : 0n;
  }
}

interface EmissionCheckpointRaw {
  days: number;
  recurringMinted: bigint;
  totalCumulativeMinted: bigint;
  totalUSDGAcceptedRaw: bigint;
  nextScheduledEmission: bigint;
  forfeitedScheduled: bigint;
  nonEmptyEpochs: number;
  emptyEpochs: number;
}

function simulateParticipationPattern(pattern: ParticipationPattern): {
  id: ParticipationPattern;
  checkpoints: EmissionCheckpointRaw[];
} {
  let scheduled = INITIAL_DAILY_EMISSION;
  let cumulativeMinted = GENESIS_SUPPLY;
  let totalUSDGAcceptedRaw = 0n;
  let forfeitedScheduled = 0n;
  let nonEmptyEpochs = 0;
  let emptyEpochs = 0;
  const checkpoints: EmissionCheckpointRaw[] = [];

  for (let dayIndex = 0; dayIndex < HORIZON_DAYS.at(-1)!; dayIndex += 1) {
    const mintCapacity = MAX_CUMULATIVE_MINT - cumulativeMinted;
    const epochScheduled = min(scheduled, mintCapacity);
    const contributedUSDGRaw = contributionForEpoch(pattern, dayIndex);
    const actualEmission = contributedUSDGRaw === 0n ? 0n : epochScheduled;

    cumulativeMinted += actualEmission;
    totalUSDGAcceptedRaw += contributedUSDGRaw;
    if (contributedUSDGRaw === 0n) {
      emptyEpochs += 1;
      forfeitedScheduled += scheduled;
    } else {
      nonEmptyEpochs += 1;
    }

    scheduled = mulDiv(scheduled, DAILY_DECAY_WAD, WAD);

    const elapsedDays = dayIndex + 1;
    if ((HORIZON_DAYS as readonly number[]).includes(elapsedDays)) {
      checkpoints.push({
        days: elapsedDays,
        recurringMinted: cumulativeMinted - GENESIS_SUPPLY,
        totalCumulativeMinted: cumulativeMinted,
        totalUSDGAcceptedRaw,
        nextScheduledEmission: scheduled,
        forfeitedScheduled,
        nonEmptyEpochs,
        emptyEpochs,
      });
    }
  }

  return { id: pattern, checkpoints };
}

function emissionScheduleLifetime() {
  let emission = INITIAL_DAILY_EMISSION;
  let scheduledTotal = 0n;
  let positiveEpochs = 0;
  while (emission !== 0n) {
    scheduledTotal += emission;
    emission = mulDiv(emission, DAILY_DECAY_WAD, WAD);
    positiveEpochs += 1;
  }
  return {
    positiveEpochs,
    sequentialScheduledTotal: scheduledTotal,
    nominalAllocationResidual: MINING_EMISSION_ALLOCATION - scheduledTotal,
  };
}

function auctionPrice(initPrice: bigint, elapsedSeconds: bigint, epochPeriod = DAY): bigint {
  if (initPrice <= 0n || elapsedSeconds < 0n || epochPeriod <= 0n) throw new RangeError('invalid auction input');
  if (elapsedSeconds > epochPeriod) return 0n;
  return initPrice - mulDiv(initPrice, elapsedSeconds, epochPeriod);
}

function nextAuctionInitPrice(paymentAmount: bigint, priceMultiplier: bigint, minInitPrice: bigint): bigint {
  const absoluteMaximum = (1n << 192n) - 1n;
  return min(max(mulDiv(paymentAmount, priceMultiplier, WAD), minInitPrice), absoluteMaximum);
}

function acquisitionDestinations(acquired: bigint, hasActiveWeight: boolean) {
  const nominalManagerReward = mulDiv(acquired, MANAGER_REWARD_BPS, BPS);
  return {
    acquired,
    managerReward: hasActiveWeight ? nominalManagerReward : 0n,
    vaultGrowth: acquired - (hasActiveWeight ? nominalManagerReward : 0n),
    redirectedToVault: hasActiveWeight ? 0n : nominalManagerReward,
  };
}

function budgetAccumulationTrace() {
  let budget = 0n;
  const dailyRevenue = usdG(60_000n);
  const strategyShareBps = 4_000n;
  const lot = usdG(50_000n);
  return Array.from({ length: 10 }, (_, index) => {
    const day = index + 1;
    const allocated = mulDiv(dailyRevenue, strategyShareBps, BPS);
    budget += allocated;
    const makerAvailable = day >= 4;
    const tradingHalted = day === 6;
    const filled = makerAvailable && !tradingHalted && budget >= lot;
    if (filled) budget -= lot;
    return {
      day,
      allocatedUSDGRaw: allocated,
      makerAvailable,
      tradingHalted,
      filled,
      lotSpentUSDGRaw: filled ? lot : 0n,
      closingBudgetUSDGRaw: budget,
    };
  });
}

function rewardConcentration() {
  const reward = tokens(20n);
  const weightsBps = [7_000n, 2_000n, 1_000n] as const;
  let distributed = 0n;
  const managers = weightsBps.map((weightBps, index) => {
    const amount = index === weightsBps.length - 1 ? reward - distributed : mulDiv(reward, weightBps, BPS);
    distributed += amount;
    return { manager: `manager-${index + 1}`, weightBps, reward: amount };
  });
  const hhiBps = weightsBps.reduce((sum, weight) => sum + mulDiv(weight, weight, BPS), 0n);
  return { totalReward: reward, hhiBps, managers };
}

function buybackScenario(id: string, marketPrice: bigint) {
  const supplyBefore = tokens(100_000_000n);
  const vaultValueBefore = usdG(100_000_000n);
  const usdGSpent = usdG(10_000_000n);
  const gbxBurned = mulDiv(normalizeUSDG(usdGSpent), WAD, marketPrice);
  const supplyAfter = supplyBefore - gbxBurned;
  const vaultValueAfter = vaultValueBefore - usdGSpent;
  return {
    id,
    marketPrice,
    backingPerGBXBefore: usdGPriceWad(vaultValueBefore, supplyBefore),
    usdGSpentRaw: usdGSpent,
    gbxBurned,
    vaultValueAfterUSDGRaw: vaultValueAfter,
    supplyAfter,
    backingPerGBXAfter: usdGPriceWad(vaultValueAfter, supplyAfter),
  };
}

function revenueFundedBuyback(id: 'mining-revenue' | 'lp-fee-revenue') {
  const startingSupply = tokens(100_000_000n);
  const startingVaultValue = usdG(100_000_000n);
  const revenue = id === 'mining-revenue' ? usdG(10_000_000n) : usdG(1_000_000n);
  const emission = id === 'mining-revenue' ? tokens(10_000_000n) : 0n;
  const buybackSpend = usdG(1_000_000n);
  const marketPrice = 8n * 10n ** 17n;
  const gbxBurned = mulDiv(normalizeUSDG(buybackSpend), WAD, marketPrice);
  const supplyAfter = startingSupply + emission - gbxBurned;
  const vaultValueAfter = startingVaultValue + revenue - buybackSpend;
  return {
    id,
    startingSupply,
    startingVaultValueUSDGRaw: startingVaultValue,
    revenueUSDGRaw: revenue,
    emission,
    buybackSpendUSDGRaw: buybackSpend,
    marketPrice,
    gbxBurned,
    supplyAfter,
    vaultValueAfterUSDGRaw: vaultValueAfter,
    backingPerGBXAfter: usdGPriceWad(vaultValueAfter, supplyAfter),
  };
}

function sequentialRedemptions() {
  let supply = tokens(100_000_000n);
  let balances = {
    USDG: usdG(100_000_000n),
    ASSET_A: tokens(200_000n),
    ASSET_B: tokens(50_000n),
  };
  const shareAmounts = [tokens(20_000_000n), tokens(30_000_000n), tokens(25_000_000n)] as const;
  return shareAmounts.map((shares, index) => {
    const supplyBefore = supply;
    const balancesBefore = balances;
    const output = {
      USDG: mulDiv(balancesBefore.USDG, shares, supplyBefore),
      ASSET_A: mulDiv(balancesBefore.ASSET_A, shares, supplyBefore),
      ASSET_B: mulDiv(balancesBefore.ASSET_B, shares, supplyBefore),
    };
    supply -= shares;
    balances = {
      USDG: balancesBefore.USDG - output.USDG,
      ASSET_A: balancesBefore.ASSET_A - output.ASSET_A,
      ASSET_B: balancesBefore.ASSET_B - output.ASSET_B,
    };
    return { sequence: index + 1, shares, supplyBefore, output, supplyAfter: supply, balancesAfter: balances };
  });
}

function rewardIndexExample(rewardAmount: bigint, totalWeight: bigint, precision = 10n ** 27n) {
  const rewardPerWeightIncrement = mulDiv(rewardAmount, precision, totalWeight);
  const indexedReward = mulDiv(rewardPerWeightIncrement, totalWeight, precision);
  return { rewardAmount, totalWeight, rewardPerWeightIncrement, indexedReward, residue: rewardAmount - indexedReward };
}

function computeEconomicSuiteRaw() {
  const participationScenarios = (
    ['all-nonempty-large', 'all-nonempty-one-atom', 'sporadic-nonempty', 'long-empty-period'] as const
  ).map(simulateParticipationPattern);
  const allNonEmpty = participationScenarios[0];
  if (allNonEmpty === undefined) throw new Error('all-nonempty scenario missing');

  const burnSweep = allNonEmpty.checkpoints.flatMap((checkpoint) =>
    EMISSION_BURN_BPS.map((burnRateBps) => {
      const requestedBurn = mulDiv(checkpoint.recurringMinted, burnRateBps, BPS);
      const actualBurn = min(requestedBurn, checkpoint.totalCumulativeMinted);
      return {
        days: checkpoint.days,
        burnRateBps,
        recurringMinted: checkpoint.recurringMinted,
        requestedBurn,
        actualBurn,
        currentSupply: checkpoint.totalCumulativeMinted - actualBurn,
      };
    }),
  );

  const auctionInitPrice = tokens(100_000n);
  const auctionMultiplier = 2n * WAD;
  const auctionMinInitPrice = 1_000_000n;

  return {
    schemaVersion: 3,
    purpose: 'Deterministic protocol-mechanics scenarios; not forecasts, valuations, or investment projections.',
    assumptions: {
      arithmetic:
        'Unsigned integer arithmetic with explicit floor/ceiling semantics; GBX and modeled targets use 18 decimals, canonical USDG uses raw 6-decimal units.',
      wad: WAD,
      usdGDecimals: USDG_DECIMALS,
      usdGAtomicUnit: USDG_UNIT,
      usdGNormalizationScale: USDG_NORMALIZATION_SCALE,
      targetTokenDecimals: 18,
      unitTargetPerUSDGRate: UNIT_TARGET_PER_USDG_RATE,
      bpsDenominator: BPS,
      horizonDays: HORIZON_DAYS,
      cumulativeMintCap: MAX_CUMULATIVE_MINT,
      genesisSupply: GENESIS_SUPPLY,
      miningEmissionAllocation: MINING_EMISSION_ALLOCATION,
      initialDailyScheduledEmission: INITIAL_DAILY_EMISSION,
      dailyDecayWad: DAILY_DECAY_WAD,
      auctionDurationSeconds: DAY,
      managerRewardBps: MANAGER_REWARD_BPS,
      maxManagerRewardBps: MAX_MANAGER_REWARD_BPS,
      noOnchainNavOracle: true,
    },
    emissions: {
      participationScenarios,
      scheduleLifetime: emissionScheduleLifetime(),
      roundingRegressions: {
        nextScheduledEmission: mulDiv(INITIAL_DAILY_EMISSION, DAILY_DECAY_WAD, WAD),
        oneAtomContributionEmission: INITIAL_DAILY_EMISSION,
        largeContributionEmission: INITIAL_DAILY_EMISSION,
        emptyContributionEmission: 0n,
      },
      burnSweep,
    },
    genesisLiquidity: {
      publicBootstrap: false,
      constructorMintGBXRaw: GENESIS_LP_GBX,
      oneSidedPositionBudgetGBXRaw: GENESIS_LP_GBX,
      unusedResidualPolicy: 'burn',
      sixDecimalRegression: {
        oneUSDGRaw: USDG_UNIT,
        normalizedOneUSDG: normalizeUSDG(USDG_UNIT),
        oneTargetPerUSDGRate: UNIT_TARGET_PER_USDG_RATE,
        targetRequiredForOneUSDG: mulDivUp(normalizeUSDG(USDG_UNIT), UNIT_TARGET_PER_USDG_RATE, WAD),
      },
    },
    auctions: {
      bounds: {
        minEpochPeriod: 3_600n,
        maxEpochPeriod: 365n * DAY,
        minPriceMultiplier: 1_100_000_000_000_000_000n,
        maxPriceMultiplier: 3n * WAD,
        absoluteMinInitPrice: 1_000_000n,
        absoluteMaxInitPrice: (1n << 192n) - 1n,
      },
      curve: [0n, 21_600n, 43_200n, 64_800n, DAY - 1n, DAY, DAY + 1n].map((elapsedSeconds) => ({
        elapsedSeconds,
        paymentAmount: auctionPrice(auctionInitPrice, elapsedSeconds),
      })),
      transitions: [0n, DAY / 2n, DAY, DAY + 1n].map((elapsedSeconds) => {
        const paymentAmount = auctionPrice(auctionInitPrice, elapsedSeconds);
        return {
          elapsedSeconds,
          quotedPaymentAmount: paymentAmount,
          nextInitPrice: nextAuctionInitPrice(paymentAmount, auctionMultiplier, auctionMinInitPrice),
        };
      }),
      budgetAccumulation: budgetAccumulationTrace(),
    },
    managerRewards: {
      rewardYieldByStrategy: [
        { id: 'strategy-a', activeWeight: tokens(1_000_000n), ...acquisitionDestinations(tokens(1_000n), true) },
        { id: 'strategy-b', activeWeight: tokens(2_000_000n), ...acquisitionDestinations(tokens(5_000n), true) },
        { id: 'strategy-without-live-weight', activeWeight: 0n, ...acquisitionDestinations(tokens(5_000n), false) },
      ].map((strategy) => ({
        ...strategy,
        rewardPerActiveGBX:
          strategy.activeWeight === 0n ? 0n : mulDiv(strategy.managerReward, WAD, strategy.activeWeight),
      })),
      voteConcentration: rewardConcentration(),
      rewardIndexExamples: [
        { id: 'production-scale', ...rewardIndexExample(840_000_000_000_000_000n, tokens(200n)) },
        { id: 'independent-floor-residue', ...rewardIndexExample(10n, 3n, 10n) },
      ],
      rewardLeakageVsVaultGrowth: [
        {
          id: 'one-hundred-fills-with-live-weight',
          fillCount: 100n,
          ...acquisitionDestinations(tokens(100_000n), true),
        },
        { id: 'ten-fills-without-live-weight', fillCount: 10n, ...acquisitionDestinations(tokens(10_000n), false) },
      ],
    },
    redemptionAndBuyback: {
      marketRelativeToBacking: [
        buybackScenario('gbx-below-backing', 8n * 10n ** 17n),
        buybackScenario('gbx-above-backing', 12n * 10n ** 17n),
      ],
      revenueSourceComparison: [revenueFundedBuyback('mining-revenue'), revenueFundedBuyback('lp-fee-revenue')],
      simultaneousEmissionAndBurn: [0n, 5_000n, 10_000n, 15_000n].map((burnRateBps) => {
        const startingSupply = tokens(100_000_000n);
        const emission = tokens(10_000_000n);
        const burn = mulDiv(emission, burnRateBps, BPS);
        return {
          burnRateBps,
          startingSupply,
          emission,
          burn,
          netSupplyChange: emission - burn,
          supplyAfter: startingSupply + emission - burn,
        };
      }),
      sequentialLargeRedemptions: sequentialRedemptions(),
    },
  };
}

function decimalize(value: unknown): DecimalJson {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new RangeError('fixture number must be a safe integer');
    return value.toString();
  }
  if (typeof value === 'string' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.map(decimalize);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, decimalize(nested)]));
  }
  throw new TypeError(`unsupported fixture value: ${typeof value}`);
}

export function computeEconomicSuite(): DecimalJson {
  return decimalize(computeEconomicSuiteRaw());
}

export const ECONOMIC_MODEL_CONSTANTS = {
  WAD,
  BPS,
  DAY,
  USDG_DECIMALS,
  USDG_UNIT,
  USDG_NORMALIZATION_SCALE,
  UNIT_TARGET_PER_USDG_RATE,
  GENESIS_SUPPLY,
  MINING_EMISSION_ALLOCATION,
  INITIAL_DAILY_EMISSION,
  DAILY_DECAY_WAD,
  MAX_CUMULATIVE_MINT,
  HORIZON_DAYS,
} as const;
