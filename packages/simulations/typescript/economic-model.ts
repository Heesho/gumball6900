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

const MAX_CUMULATIVE_MINT = 1_000_000_000n * WAD;
const GENESIS_MINER_GBX = 80_000_000n * WAD;
const GENESIS_LP_GBX = 20_000_000n * WAD;
const GENESIS_SUPPLY = GENESIS_MINER_GBX + GENESIS_LP_GBX;
const INITIAL_DAILY_EMISSION = 427_181_096_645_855_643_000_000n;
const DAILY_DECAY_WAD = 999_525_354_337_060_160n;

const HORIZON_DAYS = [365, 1_460, 2_920, 5_840, 11_680] as const;
const EMISSION_BURN_BPS = [0n, 5_000n, 10_000n, 12_500n, 15_000n] as const;

type DemandPattern = 'fully-funded' | 'fifty-percent-funded' | 'sporadic-demand' | 'long-empty-period';

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

function rawUSDGForEmissionUp(gbxAmount: bigint, priceWad: bigint): bigint {
  return mulDivUp(gbxAmount, priceWad, WAD * USDG_NORMALIZATION_SCALE);
}

function minimumMiningPrice(referencePrice: bigint): bigint {
  if (referencePrice <= 0n) throw new RangeError('reference price must be positive');
  return max(mulDiv(referencePrice, 9_500n, BPS), 1n);
}

function updateReferencePrice(previous: bigint, clearing: bigint, hadContributions: boolean): bigint {
  const lower = minimumMiningPrice(previous);
  if (!hadContributions) return lower;
  if (clearing <= 0n) throw new RangeError('a contributed epoch requires a positive clearing price');

  // Solidity floors each EMA term separately.
  const weighted = mulDiv(previous, 8_000n, BPS) + mulDiv(clearing, 2_000n, BPS);
  const upper = mulDiv(previous, 15_000n, BPS);
  return min(max(weighted, lower), upper);
}

function demandFundingBps(pattern: DemandPattern, dayIndex: number): bigint {
  switch (pattern) {
    case 'fully-funded':
      return BPS;
    case 'fifty-percent-funded':
      return 5_000n;
    case 'sporadic-demand': {
      const weekly = [10_000n, 0n, 2_500n, 0n, 10_000n, 5_000n, 0n] as const;
      return weekly[dayIndex % weekly.length] ?? 0n;
    }
    case 'long-empty-period':
      if (dayIndex < 365) return BPS;
      if (dayIndex < 2_365) return 0n;
      return dayIndex % 3 === 0 ? BPS : 5_000n;
  }
}

interface EmissionCheckpointRaw {
  days: number;
  recurringMinted: bigint;
  totalCumulativeMinted: bigint;
  totalUSDGAcceptedRaw: bigint;
  nextScheduledEmission: bigint;
  nextReferenceMiningPrice: bigint;
  fullyFundedEpochs: number;
  partiallyFundedEpochs: number;
  emptyEpochs: number;
}

function simulateDemandPattern(pattern: DemandPattern): { id: DemandPattern; checkpoints: EmissionCheckpointRaw[] } {
  let scheduled = INITIAL_DAILY_EMISSION;
  let cumulativeMinted = GENESIS_SUPPLY;
  let referencePrice = WAD;
  let totalUSDGAcceptedRaw = 0n;
  let fullyFundedEpochs = 0;
  let partiallyFundedEpochs = 0;
  let emptyEpochs = 0;
  const checkpoints: EmissionCheckpointRaw[] = [];

  for (let dayIndex = 0; dayIndex < HORIZON_DAYS.at(-1)!; dayIndex += 1) {
    const mintCapacity = MAX_CUMULATIVE_MINT - cumulativeMinted;
    const epochScheduled = min(scheduled, mintCapacity);
    const fundingBps = demandFundingBps(pattern, dayIndex);
    const desiredEmission = mulDiv(epochScheduled, fundingBps, BPS);
    const reservePrice = minimumMiningPrice(referencePrice);
    const contributedUSDGRaw = rawUSDGForEmissionUp(desiredEmission, reservePrice);
    const affordableEmission =
      contributedUSDGRaw === 0n ? 0n : mulDiv(normalizeUSDG(contributedUSDGRaw), WAD, reservePrice);
    const actualEmission = min(epochScheduled, affordableEmission);
    const fullyFunded = epochScheduled > 0n && actualEmission === epochScheduled;
    const clearingPrice =
      contributedUSDGRaw === 0n ? 0n : fullyFunded ? usdGPriceWad(contributedUSDGRaw, epochScheduled) : reservePrice;

    cumulativeMinted += actualEmission;
    totalUSDGAcceptedRaw += contributedUSDGRaw;
    if (contributedUSDGRaw === 0n) emptyEpochs += 1;
    else if (fullyFunded) fullyFundedEpochs += 1;
    else partiallyFundedEpochs += 1;

    referencePrice = updateReferencePrice(referencePrice, clearingPrice, contributedUSDGRaw !== 0n);
    scheduled = mulDiv(scheduled, DAILY_DECAY_WAD, WAD);

    const elapsedDays = dayIndex + 1;
    if ((HORIZON_DAYS as readonly number[]).includes(elapsedDays)) {
      checkpoints.push({
        days: elapsedDays,
        recurringMinted: cumulativeMinted - GENESIS_SUPPLY,
        totalCumulativeMinted: cumulativeMinted,
        totalUSDGAcceptedRaw,
        nextScheduledEmission: scheduled,
        nextReferenceMiningPrice: referencePrice,
        fullyFundedEpochs,
        partiallyFundedEpochs,
        emptyEpochs,
      });
    }
  }

  return { id: pattern, checkpoints };
}

function priceShockTrace(id: string, requestedMarketPrices: readonly bigint[]) {
  let referencePrice = WAD;
  return {
    id,
    points: requestedMarketPrices.map((requestedMarketPrice, epoch) => {
      const previousReferencePrice = referencePrice;
      const reservePrice = minimumMiningPrice(previousReferencePrice);
      // A non-empty underfunded mining epoch clears at the reserve, never below it.
      const effectiveClearingPrice = max(requestedMarketPrice, reservePrice);
      referencePrice = updateReferencePrice(previousReferencePrice, effectiveClearingPrice, true);
      return {
        epoch: epoch + 1,
        requestedMarketPrice,
        reservePrice,
        effectiveClearingPrice,
        previousReferencePrice,
        nextReferencePrice: referencePrice,
      };
    }),
  };
}

function integerSquareRoot(value: bigint): bigint {
  if (value < 0n) throw new RangeError('square root value must be non-negative');
  if (value < 2n) return value;
  let estimate = 1n << ((BigInt(value.toString(2).length) + 1n) / 2n);
  for (;;) {
    const next = (estimate + value / estimate) / 2n;
    if (next >= estimate) return estimate;
    estimate = next;
  }
}

function sqrtWad(valueWad: bigint): bigint {
  return integerSquareRoot(valueWad * WAD);
}

function inverseSqrtWad(valueWad: bigint): bigint {
  return (WAD * WAD) / sqrtWad(valueWad);
}

const LADDER = [
  { allocation: tokens(10_000_000n), lower: WAD, upper: 15n * 10n ** 17n },
  { allocation: tokens(6_000_000n), lower: 15n * 10n ** 17n, upper: 3n * WAD },
  { allocation: tokens(3_000_000n), lower: 3n * WAD, upper: 6n * WAD },
  { allocation: tokens(1_000_000n), lower: 6n * WAD, upper: 12n * WAD },
] as const;

function ladderState(priceMultipleWad: bigint, genesisPriceWad = WAD) {
  const positions = LADDER.map((range) => {
    const inverseLower = inverseSqrtWad(range.lower);
    const inverseUpper = inverseSqrtWad(range.upper);
    const liquidity = mulDiv(range.allocation, WAD, inverseLower - inverseUpper);
    let gbxRemaining: bigint;
    let usdGRaisedWad: bigint;
    if (priceMultipleWad <= range.lower) {
      gbxRemaining = range.allocation;
      usdGRaisedWad = 0n;
    } else if (priceMultipleWad >= range.upper) {
      gbxRemaining = 0n;
      usdGRaisedWad = mulDiv(liquidity, sqrtWad(range.upper) - sqrtWad(range.lower), WAD);
    } else {
      gbxRemaining = mulDiv(liquidity, inverseSqrtWad(priceMultipleWad) - inverseUpper, WAD);
      usdGRaisedWad = mulDiv(liquidity, sqrtWad(priceMultipleWad) - sqrtWad(range.lower), WAD);
    }
    usdGRaisedWad = mulDiv(usdGRaisedWad, genesisPriceWad, WAD);
    return {
      gbxAllocation: range.allocation,
      lowerPriceMultipleWad: range.lower,
      upperPriceMultipleWad: range.upper,
      gbxRemaining,
      usdGRaisedWad,
      usdGRaisedRaw: usdGRaisedWad / USDG_NORMALIZATION_SCALE,
    };
  });
  const gbxRemaining = positions.reduce((sum, position) => sum + position.gbxRemaining, 0n);
  const usdGRaisedWad = positions.reduce((sum, position) => sum + position.usdGRaisedWad, 0n);
  const usdGRaisedRaw = positions.reduce((sum, position) => sum + position.usdGRaisedRaw, 0n);
  return {
    priceMultipleWad,
    gbxRemaining,
    gbxSold: GENESIS_LP_GBX - gbxRemaining,
    usdGRaisedWad,
    usdGRaisedRaw,
    positions,
  };
}

function quoteBootstrap(communityRaise: bigint) {
  const sponsorRequirement = mulDivUp(communityRaise, GENESIS_LP_GBX, GENESIS_MINER_GBX);
  const totalGenesisBacking = communityRaise + sponsorRequirement;
  const initialGBXPrice = usdGPriceWad(communityRaise, GENESIS_MINER_GBX);
  const backingPerGBX = usdGPriceWad(totalGenesisBacking, GENESIS_SUPPLY);
  const participantContribution = communityRaise / 100n;
  const participantGBX = mulDiv(participantContribution, GENESIS_MINER_GBX, communityRaise);
  const genesisRedemptionUSDGRaw = mulDiv(totalGenesisBacking, participantGBX, GENESIS_SUPPLY);
  const fullyConvertedLadderUSDGRaw = ladderState(12n * WAD, initialGBXPrice).usdGRaisedRaw;
  return {
    communityRaiseUSDGRaw: communityRaise,
    sponsorRequirementUSDGRaw: sponsorRequirement,
    totalGenesisBackingUSDGRaw: totalGenesisBacking,
    genesisMinerAllocation: GENESIS_MINER_GBX,
    oneSidedLPAllocation: GENESIS_LP_GBX,
    initialGBXPrice,
    backingPerGBX,
    lpBackingRequirementUSDGRaw: sponsorRequirement,
    initialOneSidedLPUSDGRaw: 0n,
    fullyConvertedLadderUSDGRaw,
    participantContributionUSDGRaw: participantContribution,
    participantGBX,
    genesisRedemptionUSDGRaw,
  };
}

function auctionRate(referenceRate: bigint, elapsedSeconds: bigint): bigint {
  const start = mulDiv(referenceRate, 12_500n, BPS);
  const floor = mulDiv(referenceRate, 8_000n, BPS);
  if (elapsedSeconds >= DAY) return floor;
  return start - mulDiv(start - floor, elapsedSeconds, DAY);
}

function marketRateWithDrift(startRate: bigint, driftBps: bigint, elapsedSeconds: bigint): bigint {
  const magnitude = mulDiv(startRate, driftBps < 0n ? -driftBps : driftBps, BPS);
  const elapsedDrift = mulDiv(magnitude, elapsedSeconds, DAY);
  return driftBps < 0n ? startRate - elapsedDrift : startRate + elapsedDrift;
}

function findAuctionFillSecond(options: {
  marketStartRate: bigint;
  dailyDriftBps: bigint;
  makerAvailable: boolean;
  haltStartSecond?: bigint;
  haltEndSecond?: bigint;
}): bigint | null {
  if (!options.makerAvailable) return null;
  for (let second = 0n; second <= DAY; second += 1n) {
    const halted =
      options.haltStartSecond !== undefined &&
      options.haltEndSecond !== undefined &&
      second >= options.haltStartSecond &&
      second <= options.haltEndSecond;
    if (halted) continue;
    if (
      auctionRate(UNIT_TARGET_PER_USDG_RATE, second) <=
      marketRateWithDrift(options.marketStartRate, options.dailyDriftBps, second)
    ) {
      return second;
    }
  }
  return null;
}

function acquisitionDestinations(acquired: bigint, hasActiveWeight: boolean) {
  const nominalManagerReward = mulDiv(acquired, 200n, BPS);
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

function computeEconomicSuiteRaw() {
  const demandScenarios = (
    ['fully-funded', 'fifty-percent-funded', 'sporadic-demand', 'long-empty-period'] as const
  ).map(simulateDemandPattern);
  const fullDemand = demandScenarios[0];
  if (fullDemand === undefined) throw new Error('fully funded demand scenario missing');

  const burnSweep = fullDemand.checkpoints.flatMap((checkpoint) =>
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

  const auctionDriftInputs = [
    { id: 'stable-market', marketStartRate: UNIT_TARGET_PER_USDG_RATE, dailyDriftBps: 0n, makerAvailable: true },
    {
      id: 'target-appreciates',
      marketStartRate: UNIT_TARGET_PER_USDG_RATE,
      dailyDriftBps: -2_000n,
      makerAvailable: true,
    },
    {
      id: 'target-depreciates',
      marketStartRate: UNIT_TARGET_PER_USDG_RATE,
      dailyDriftBps: 2_000n,
      makerAvailable: true,
    },
    {
      id: 'missing-market-maker',
      marketStartRate: UNIT_TARGET_PER_USDG_RATE,
      dailyDriftBps: 0n,
      makerAvailable: false,
    },
    {
      id: 'trading-halt-at-crossing',
      marketStartRate: UNIT_TARGET_PER_USDG_RATE,
      dailyDriftBps: 0n,
      makerAvailable: true,
      haltStartSecond: 36_000n,
      haltEndSecond: DAY,
    },
  ] as const;

  const priceMultiples = [WAD, 125n * 10n ** 16n, 15n * 10n ** 17n, 2n * WAD, 3n * WAD, 6n * WAD, 12n * WAD];
  const lpInventory = priceMultiples.map((priceMultipleWad) => ladderState(priceMultipleWad));
  let referenceAfterTwoThousandEmptyEpochs = WAD;
  for (let epoch = 0; epoch < 2_000; epoch += 1) {
    referenceAfterTwoThousandEmptyEpochs = updateReferencePrice(referenceAfterTwoThousandEmptyEpochs, 0n, false);
  }

  return {
    schemaVersion: 2,
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
      auctionDurationSeconds: DAY,
      managerRewardBps: 200n,
      noOnchainNavOracle: true,
    },
    emissions: {
      demandScenarios,
      priceShockTraces: [
        priceShockTrace(
          'large-price-increase',
          Array.from({ length: 10 }, () => 8n * WAD),
        ),
        priceShockTrace(
          'large-price-decrease',
          Array.from({ length: 10 }, () => WAD / 10n),
        ),
        priceShockTrace('reference-price-lag', [WAD, WAD, 2n * WAD, 2n * WAD, 4n * WAD, 4n * WAD, WAD, WAD, WAD, WAD]),
      ],
      roundingRegressions: {
        solidityTermByTermEma: updateReferencePrice(101n, 104n, true),
        referenceAfterTwoThousandEmptyEpochs,
        minimumNonzeroPrice: minimumMiningPrice(referenceAfterTwoThousandEmptyEpochs),
        affordableGBXWeiFromOneRawUSDGAtOneDollar: mulDiv(normalizeUSDG(1n), WAD, WAD),
      },
      burnSweep,
    },
    bootstrap: {
      raises: [usdG(1_000_000n), usdG(10_000_000n), usdG(80_000_000n), usdG(160_000_000n)].map(quoteBootstrap),
      ladderRanges: LADDER,
      lpInventory,
      fullyConvertedUSDGRawAtOneDollarP0: lpInventory.at(-1)!.usdGRaisedRaw,
      sixDecimalRegression: {
        oneUSDGRaw: USDG_UNIT,
        normalizedOneUSDG: normalizeUSDG(USDG_UNIT),
        oneTargetPerUSDGRate: UNIT_TARGET_PER_USDG_RATE,
        targetRequiredForOneUSDG: mulDivUp(normalizeUSDG(USDG_UNIT), UNIT_TARGET_PER_USDG_RATE, WAD),
      },
    },
    auctions: {
      bounds: {
        referenceRate: UNIT_TARGET_PER_USDG_RATE,
        startRate: auctionRate(UNIT_TARGET_PER_USDG_RATE, 0n),
        floorRate: auctionRate(UNIT_TARGET_PER_USDG_RATE, DAY),
        startRateBps: 12_500n,
        floorRateBps: 8_000n,
      },
      curve: [0n, 21_600n, 43_200n, 64_800n, DAY].map((elapsedSeconds) => ({
        elapsedSeconds,
        rate: auctionRate(UNIT_TARGET_PER_USDG_RATE, elapsedSeconds),
      })),
      driftAndAvailability: auctionDriftInputs.map((input) => {
        const fillSecond = findAuctionFillSecond(input);
        const lot = usdG(10_000n);
        const fillRate = fillSecond === null ? null : auctionRate(UNIT_TARGET_PER_USDG_RATE, fillSecond);
        return {
          ...input,
          usdGLotRaw: lot,
          fillSecond,
          fillRate,
          requiredTarget: fillRate === null ? null : mulDivUp(normalizeUSDG(lot), fillRate, WAD),
          budgetRetainedUSDGRaw: fillSecond === null ? lot : 0n,
        };
      }),
      lotSizesAtMidpoint: [usdG(1_000n), usdG(10_000n), usdG(100_000n)].map((usdGLotRaw) => ({
        usdGLotRaw,
        rate: auctionRate(UNIT_TARGET_PER_USDG_RATE, DAY / 2n),
        requiredTarget: mulDivUp(normalizeUSDG(usdGLotRaw), auctionRate(UNIT_TARGET_PER_USDG_RATE, DAY / 2n), WAD),
      })),
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
      frequentSwitching: [
        { hour: 0n, event: 'signal-strategy-b', activeStrategy: 'none', pendingStrategy: 'strategy-b', reward: 0n },
        {
          hour: 12n,
          event: 'fill-strategy-b-before-activation',
          activeStrategy: 'none',
          pendingStrategy: 'strategy-b',
          reward: 0n,
        },
        {
          hour: 24n,
          event: 'checkpoint-and-fill-strategy-b',
          activeStrategy: 'strategy-b',
          pendingStrategy: 'none',
          reward: tokens(20n),
        },
        { hour: 30n, event: 'switch-to-strategy-a', activeStrategy: 'none', pendingStrategy: 'strategy-a', reward: 0n },
        {
          hour: 36n,
          event: 'fill-strategy-a-during-delay',
          activeStrategy: 'none',
          pendingStrategy: 'strategy-a',
          reward: 0n,
        },
        {
          hour: 54n,
          event: 'checkpoint-and-fill-strategy-a',
          activeStrategy: 'strategy-a',
          pendingStrategy: 'none',
          reward: tokens(20n),
        },
      ],
      activationDelay: [
        { elapsedSeconds: 0n, effectiveWeight: 0n, pendingWeight: tokens(100_000n) },
        { elapsedSeconds: DAY - 1n, effectiveWeight: 0n, pendingWeight: tokens(100_000n) },
        { elapsedSeconds: DAY, effectiveWeight: tokens(100_000n), pendingWeight: 0n },
      ],
      noLockStakeChurn: {
        earlyExit: {
          stakedAtSecond: 0n,
          unstakedAtSecond: 21_600n,
          activeWeightAtExit: 0n,
          cancelledPendingWeight: tokens(100_000n),
          rewardCaptured: 0n,
        },
        postActivationExit: {
          stakedAtSecond: 0n,
          activatedAtSecond: DAY,
          filledAtSecond: DAY,
          unstakedAtSecond: DAY,
          activeWeightAtFill: tokens(100_000n),
          accruedRewardAfterUnstake: tokens(20n),
        },
      },
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
      lpInventorySoldOverTime: lpInventory,
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
  MAX_CUMULATIVE_MINT,
  HORIZON_DAYS,
} as const;
