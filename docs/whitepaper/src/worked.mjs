/**
 * The continuous worked example: one cast, one thread of numbers, computed here.
 *
 * Every figure quoted in the worked-example chapters is produced by these functions, which
 * replay the same integer arithmetic the production contracts apply (floor division at the
 * same points, the same scaled-carry rules, the same stream-rate remainder rule). Inputs
 * are illustrative; arithmetic is not. Nothing in this file is transcribed by hand into
 * prose - pages import and format these values.
 *
 * The cast (all fictional): Maya mines and signals, Elena signals, Leo holds and redeems
 * GBX, Noor fills auctions. Strategies are illustrative tokenized-stock wrappers; no
 * listing, availability, or value is implied.
 */

import { contractConstants, schedule, streamRate } from './protocol-facts.mjs';

const WAD = 10n ** 18n;
const USDG = 10n ** 6n; // canonical USDG uses 6 decimals

const mulDiv = (a, b, d) => (a * b) / d;

/* ------------------------------------------------------------- formatting ---- */

export function formatUnits(value, decimals, fractionDigits = decimals) {
  const base = 10n ** BigInt(decimals);
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const whole = magnitude / base;
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (fractionDigits === 0) return `${negative ? '-' : ''}${grouped}`;
  const fraction = (magnitude % base).toString().padStart(decimals, '0').slice(0, fractionDigits);
  return `${negative ? '-' : ''}${grouped}.${fraction}`;
}

export const fmtGBX = (v, digits = 2) => formatUnits(v, 18, digits);
export const fmtUSDG = (v, digits = 2) => formatUnits(v, 6, digits);

/* -------------------------------------------------------------- fundraiser ---- */

/** Replay the sequential schedule up to `epochIndex` and return that epoch's emission. */
export function scheduledEmissionAt(epochIndex) {
  const { initialDailyEmission, dailyDecayWad } = contractConstants.fundraiser;
  let scheduled = initialDailyEmission;
  for (let epoch = 0; epoch < epochIndex; epoch += 1) {
    scheduled = mulDiv(scheduled, dailyDecayWad, WAD);
  }
  return scheduled;
}

/** Fundraiser.claim: floor(contribution * epochEmission / totalContributions). */
export function contributorReward({ contribution, totalContributions, epochEmission }) {
  return mulDiv(contribution, epochEmission, totalContributions);
}

/* --------------------------------------------------------------- resonance ---- */

/**
 * Mirror of Resonance's scaled-carry index arithmetic for one revenue notification
 * followed by a full distribution, starting from a clean index.
 */
export function distributeRevenue({ revenueRaw, weights, carriedScaled = 0n }) {
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0n);
  const pending = carriedScaled + revenueRaw * WAD;
  if (totalWeight === 0n) {
    return { totalWeight, indexDelta: 0n, carriedScaled: pending % WAD, fundBound: pending / WAD, allocations: [] };
  }
  const indexDelta = pending / totalWeight;
  const indexedScaled = indexDelta * totalWeight;
  const remainingCarry = pending - indexedScaled;

  const allocations = weights.map(({ name, weight, remainderScaled = 0n }) => {
    const accrued = remainderScaled + weight * indexDelta;
    return { name, weight, amount: accrued / WAD, remainderScaled: accrued % WAD };
  });

  return { totalWeight, indexDelta, carriedScaled: remainingCarry, fundBound: 0n, allocations };
}

/* ----------------------------------------------------------------- auction ---- */

/** Strategy.currentPrice: initial - floor(initial * elapsed / duration). */
export function auctionPriceAt({ initialPrice, elapsedSeconds, epochDuration }) {
  if (elapsedSeconds >= epochDuration) return 0n;
  return initialPrice - mulDiv(initialPrice, elapsedSeconds, epochDuration);
}

/** Strategy._nextInitialPrice: payment * multiplier / 1e18, floored at minimumPrice. */
export function nextAuctionPrice({ payment, multiplierWad, minimumPrice }) {
  const raised = mulDiv(payment, multiplierWad, WAD);
  const max = contractConstants.strategy.absoluteMaximumPrice;
  if (raised > max) return max;
  return raised < minimumPrice ? minimumPrice : raised;
}

/* -------------------------------------------------------------- redemption ---- */

/** Fund.redeem: per selected token, floor(balance * burned / supplyBeforeBurn). */
export function redemptionPayouts({ balances, burned, supplyBeforeBurn }) {
  return balances.map(({ name, balance, decimals }) => ({
    name,
    decimals,
    payout: mulDiv(balance, burned, supplyBeforeBurn),
  }));
}

/* ---------------------------------------------------------- the one thread ---- */

/**
 * The complete example thread. Inputs are chosen for legible round-ish numbers; every
 * output is computed by the functions above.
 */
export function workedExample() {
  // -- Day 121 of mining (epoch index 120).
  const epochIndex = 120n;
  const epochEmission = scheduledEmissionAt(120);
  const totalContributions = 40_000n * USDG;
  const mayaContribution = 1_000n * USDG;
  const mayaReward = contributorReward({
    contribution: mayaContribution,
    totalContributions,
    epochEmission,
  });

  // -- Staking and incremental signaling.
  const mayaStaked = 1_500n * WAD; // 1,500 GBX -> 1,500 sGBX
  const mayaToNvda = 900n * WAD;
  const mayaToAapl = 400n * WAD;
  const mayaIdle = mayaStaked - mayaToNvda - mayaToAapl; // withdrawable immediately
  const mayaAaplTrim = 150n * WAD; // removeSignal(AAPL, 150e18): a delta, not a target
  const mayaAaplAfterTrim = mayaToAapl - mayaAaplTrim;

  // -- The live distribution across three Strategies (aggregate of many accounts).
  const weights = [
    { name: 'NVDA-linked Strategy', weight: 45_000n * WAD },
    { name: 'AAPL-linked Strategy', weight: 30_000n * WAD },
    { name: 'GBX-payment Strategy', weight: 15_000n * WAD },
  ];

  // -- One revenue event: 12,345.678901 USDG arrives through the router.
  const revenueRaw = 12_345_678_901n;
  const distribution = distributeRevenue({ revenueRaw, weights });

  // -- Tiny revenue: 0.00005 USDG cannot advance the index at this weight; it carries.
  const tiny = distributeRevenue({ revenueRaw: 50n, weights });
  // A later 0.15 USDG event arrives on top of the carried 0.00005.
  const tinyFollowup = distributeRevenue({ revenueRaw: 150_000n, weights, carriedScaled: tiny.carriedScaled });

  // -- The NVDA Strategy auctions its accumulated lot.
  const nvdaLot = distribution.allocations[0].amount; // raw USDG
  const auction = {
    initialPrice: 60n * WAD, // opening ask: 60 units of the wrapper token
    epochDuration: 86_400n,
    multiplierWad: 2n * WAD,
    minimumPrice: 1_000_000n,
  };
  const fillElapsed = 61_200n; // Noor fills 17 hours in
  const noorPayment = auctionPriceAt({
    initialPrice: auction.initialPrice,
    elapsedSeconds: fillElapsed,
    epochDuration: auction.epochDuration,
  });
  const nextOpen = nextAuctionPrice({
    payment: noorPayment,
    multiplierWad: auction.multiplierWad,
    minimumPrice: auction.minimumPrice,
  });
  // Zero-price illustration: at expiry the same lot goes for nothing.
  const zeroPrice = auctionPriceAt({
    initialPrice: auction.initialPrice,
    elapsedSeconds: 86_400n,
    epochDuration: auction.epochDuration,
  });
  const floorRestart = nextAuctionPrice({
    payment: 0n,
    multiplierWad: auction.multiplierWad,
    minimumPrice: auction.minimumPrice,
  });

  // -- Rewards: an independent funder streams 350 wrapper tokens over seven days.
  const canonicalNotified = 350n * WAD;
  const canonicalStream = streamRate(canonicalNotified);
  // A supplemental token (the second of at most eight) is separately funded.
  const supplementalNotified = 1_000n * WAD;
  const supplementalStream = streamRate(supplementalNotified);
  // Elena holds 9,000 of the Strategy's 45,000 weight: a fifth of the stream.
  const elenaWeight = 9_000n * WAD;
  const nvdaWeight = weights[0].weight;
  const elenaShareOfDay = mulDiv(mulDiv(canonicalStream.rate * 86_400n + 86_400n, elenaWeight, nvdaWeight), 1n, 1n);

  // -- The GBX-payment Strategy: a fill delivers GBX toward Fund; the burn is explicit.
  const buybackLot = distribution.allocations[2].amount;
  const buybackGbxPaid = 30_000n * WAD;

  // -- Leo redeems: 10,000 GBX against a 120,000,000 supply, selecting two of three assets.
  const supplyBeforeBurn = 120_000_000n * WAD;
  const leoBurn = 10_000n * WAD;
  const fundBalances = [
    { name: 'NVDA-linked wrapper', balance: 5_000n * WAD, decimals: 18 },
    { name: 'USDG', balance: 250_000n * USDG, decimals: 6 },
    { name: 'PARTNER (omitted)', balance: 12n * WAD, decimals: 18 },
  ];
  const leoPayouts = redemptionPayouts({
    balances: fundBalances.slice(0, 2),
    burned: leoBurn,
    supplyBeforeBurn,
  });

  // -- A permissionless harvest: fees route in, GBX burns.
  const harvestUsdg = 1_234_560_000n; // 1,234.56 USDG
  const harvestGbx = 2_500n * WAD;

  return {
    epochIndex,
    epochEmission,
    totalContributions,
    maya: {
      contribution: mayaContribution,
      reward: mayaReward,
      staked: mayaStaked,
      toNvda: mayaToNvda,
      toAapl: mayaToAapl,
      idle: mayaIdle,
      aaplTrim: mayaAaplTrim,
      aaplAfterTrim: mayaAaplAfterTrim,
    },
    weights,
    revenueRaw,
    distribution,
    tiny,
    tinyFollowup,
    auction: { ...auction, nvdaLot, fillElapsed, noorPayment, nextOpen, zeroPrice, floorRestart },
    rewards: {
      canonicalNotified,
      canonicalStream,
      supplementalNotified,
      supplementalStream,
      elenaWeight,
      nvdaWeight,
      elenaShareOfDay,
    },
    buyback: { lot: buybackLot, gbxPaid: buybackGbxPaid },
    redemption: { supplyBeforeBurn, leoBurn, fundBalances, leoPayouts },
    harvest: { usdg: harvestUsdg, gbx: harvestGbx },
    scheduleFacts: schedule,
  };
}

export const worked = workedExample();
