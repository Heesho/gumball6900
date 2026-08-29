/**
 * The models behind the three live boards on the homepage dashboard.
 *
 * Each one is a simulation of a rule that exists in the contracts, run fast enough to watch. The
 * rules are exact — the decay to zero, the 80/20 split, the doubling with its floor, the rate a
 * tenure locks, the seven-day stream split by weight, the pro-rata burn. The quantities are not:
 * nothing is deployed, so there are no prices, balances, holders, or totals to read. Every board
 * that renders one of these models says so in its own note.
 *
 * Pure state and arithmetic. No DOM, no React, no timers: the view steps these and paints them.
 */

import { AUCTION, MINE, SIGNAL } from '../../lib/protocol';

/**
 * Simulated seconds per real second, per board. The mine runs an hour a minute so a slot's whole
 * descending auction is watchable; Resonance runs a week in about eleven minutes so its stream and
 * its auction epochs both land inside a visit.
 */
export const SIM_SPEED = { mine: 60, flow: 900, fund: 120 } as const;

const BPS = MINE.bps;

/** Deterministic, so the server and the client agree on the opening frame of every board. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/* ------------------------------------------------------------------ formatting */

/** Grouped by hand rather than by locale, so a hydrated number matches the rendered one exactly. */
function group(value: string): string {
  const [whole = '', fraction] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

export function usd(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 10_000) return `$${(amount / 1_000).toFixed(1)}k`;
  if (amount >= 1_000) return `$${group(amount.toFixed(0))}`;
  return `$${amount.toFixed(2)}`;
}

export function gbx(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 10_000) return `${(amount / 1_000).toFixed(1)}k`;
  if (amount >= 1_000) return group(amount.toFixed(0));
  return amount.toFixed(1);
}

/** One cell line is about seventeen characters wide, so thousands abbreviate rather than group. */
export function gbxTight(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}k`;
  return amount.toFixed(1);
}

export function units(amount: number): string {
  if (amount >= 1_000) return group(amount.toFixed(0));
  if (amount >= 10) return amount.toFixed(2);
  return amount.toFixed(3);
}

export function clock(seconds: number): string {
  const day = Math.floor(seconds / 86_400);
  const hour = Math.floor((seconds % 86_400) / 3_600);
  const minute = Math.floor((seconds % 3_600) / 60);
  return `day ${day}, ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ the mine */

export interface MineSlot {
  /** What this tenure's auction opened at: twice the accepted payment, floored at the minimum. */
  initialPrice: number;
  /** Simulated seconds at which this auction opened. */
  startedAt: number;
  /** GBX per second, locked to this tenure the moment it began. A halving never reprices it. */
  tps: number;
  /** GBX this tenure has accrued and not yet minted. Minting happens on replacement. */
  accrued: number;
  /**
   * The price this tenure is replaced at. Illustrative only — the contract has no reservation, it
   * simply lets the price fall until somebody pays it.
   */
  reserve: number;
  /** Bumped on every replacement so the view flashes each event exactly once. */
  seq: number;
  /** Real seconds of flash remaining on the cell. */
  flash: number;
  /** The last replacement, kept for the cell's one-line receipt. */
  paidToMiner: number;
  mintedToMiner: number;
}

export interface MineModel {
  /** Simulated seconds since deployment. */
  t: number;
  slots: MineSlot[];
  /** GBX minted, which only ever happens when a tenure is replaced. */
  minted: number;
  /** USDG claimable by outgoing miners: 80% of every paid replacement of an occupied slot. */
  toMiners: number;
  /** USDG transferred onward to ResonanceRouter: the remaining 20%, or all of a first fill. */
  toResonance: number;
  random: () => number;
}

/** The prospective global rate: halves at every completed 69-day boundary, floored at the tail. */
export function globalTps(elapsed: number): number {
  const halvings = Math.floor(elapsed / MINE.halvingPeriodSeconds);
  return Math.max(MINE.initialRateValue / 2 ** halvings, MINE.tailRateValue);
}

/** Mine.currentPrice: a straight line from the opening price to zero across the decay period. */
export function slotPrice(model: MineModel, slot: MineSlot): number {
  const elapsed = model.t - slot.startedAt;
  if (elapsed >= MINE.decayPeriodSeconds) return 0;
  return slot.initialPrice * (1 - elapsed / MINE.decayPeriodSeconds);
}

/** How much of this slot's hour is still to run, 0–1. The meter reads as a clock. */
export function slotRemaining(model: MineModel, slot: MineSlot): number {
  const elapsed = (model.t - slot.startedAt) / MINE.decayPeriodSeconds;
  return Math.min(1, Math.max(0, 1 - elapsed));
}

export function createMine(): MineModel {
  const random = mulberry32(0x6900);
  const tps = MINE.initialRateValue / MINE.slotCount;
  const slots: MineSlot[] = [];

  for (let index = 0; index < MINE.slotCount; index += 1) {
    // Each slot opens at its own point in its own hour, or the whole board turns over at once.
    const elapsed = random() * MINE.decayPeriodSeconds * 0.86;
    const initialPrice = 4 + random() * 24;
    slots.push({
      initialPrice,
      startedAt: -elapsed,
      tps,
      accrued: elapsed * tps,
      reserve: initialPrice * (0.25 + random() * 0.55),
      seq: 0,
      flash: 0,
      paidToMiner: 0,
      mintedToMiner: 0,
    });
  }

  const model: MineModel = { t: 0, slots, minted: 0, toMiners: 0, toResonance: 0, random };
  // Run the opening twenty minutes so the board arrives mid-story: some slots have already changed
  // hands, and the totals underneath are not a row of zeros. This is also the whole frame a reader
  // who asked for no motion ever sees.
  for (let step = 0; step < 40; step += 1) stepMine(model, 0.5);
  return model;
}

/**
 * Replace one tenure. The outgoing tenure's accrual mints to the miner it displaces, 80% of the
 * payment becomes that miner's pull claim and the remainder goes onward, and the next auction
 * opens at twice what was paid — never below the one-USDG floor.
 */
function replace(model: MineModel, index: number): void {
  const slot = model.slots[index];
  if (!slot) return;
  const paid = slotPrice(model, slot);
  const toMiner = (paid * MINE.outgoingMinerBps) / BPS;

  model.minted += slot.accrued;
  model.toMiners += toMiner;
  model.toResonance += paid - toMiner;

  slot.paidToMiner = toMiner;
  slot.mintedToMiner = slot.accrued;
  slot.initialPrice = Math.max(paid * MINE.priceMultiplier, MINE.minInitialPriceValue);
  slot.startedAt = model.t;
  slot.accrued = 0;
  // The prospective rate is read once, here, and then belongs to this tenure for its whole life.
  slot.tps = globalTps(model.t) / MINE.slotCount;
  slot.reserve = slot.initialPrice * (0.25 + model.random() * 0.55);
  slot.seq += 1;
  slot.flash = 1.1;
}

export function stepMine(model: MineModel, realDt: number): void {
  const dt = realDt * SIM_SPEED.mine;
  model.t += dt;
  for (let index = 0; index < model.slots.length; index += 1) {
    const slot = model.slots[index];
    if (!slot) continue;
    slot.accrued += dt * slot.tps;
    if (slot.flash > 0) slot.flash = Math.max(0, slot.flash - realDt);
    // Never inside the first minutes of a tenure, so sixteen slots cannot turn over in lockstep.
    if (model.t - slot.startedAt > 240 && slotPrice(model, slot) <= slot.reserve) replace(model, index);
  }
}

/** GBX per hour across all sixteen tenures at their locked rates. */
export function mineHourlyRate(model: MineModel): number {
  return model.slots.reduce((total, slot) => total + slot.tps, 0) * 3_600;
}

/* ------------------------------------------------------------------ the flow */

export interface FlowStrategy {
  id: string;
  /** A placeholder. The Fund keeps no registry of approved assets and none has been chosen. */
  name: string;
  /** Signal weight, in escrowed sGBX. */
  weight: number;
  /** Only ever used to turn USDG into a count of units. Never shown: nothing here is priced. */
  unitPrice: number;
  /** USDG this Strategy has been streamed and not yet sold. */
  pot: number;
  /** Units of the asset this Strategy has bought and handed to Fund. */
  held: number;
  /** Immutable at deployment, bounded to 1 hour – 365 days. */
  epochDuration: number;
  epochStartedAt: number;
  fillAt: number;
  lastFill: number;
  flash: number;
  /** Last signal move, held briefly so the row can show it. */
  delta: number;
  moved: number;
}

export interface FlowParticle {
  lane: number;
  /** Position along its lane, 0–1. Negative values stagger a burst. */
  p: number;
  /** 1 is Resonance to the Strategy, 2 is the filled auction handing the asset to Fund. */
  stage: 1 | 2;
}

export interface FlowModel {
  t: number;
  strategies: FlowStrategy[];
  /** USDG sitting in ResonanceRouter, waiting for anyone at all to call route(). */
  pending: number;
  /** USDG per second the live stream is releasing. */
  rate: number;
  /** Simulated second the live stream runs dry. */
  finish: number;
  nextRouteAttempt: number;
  nextShift: number;
  particles: FlowParticle[];
  random: () => number;
}

const FLOW_NAMES = ['Asset A', 'Asset B', 'Asset C', 'Asset D'] as const;
/** Distinct epoch lengths, all inside Strategy's own 1-hour-to-365-day bound. */
const FLOW_EPOCHS = [4, 6, 9, 13] as const;
const FLOW_WEIGHTS = [12_400, 9_200, 6_100, 3_800] as const;
const FLOW_UNIT_PRICES = [120, 480, 32, 240] as const;
/** Illustrative USDG per week arriving from mining replacements. */
const FLOW_INFLOW_PER_WEEK = 42_000;

export function createFlow(): FlowModel {
  const random = mulberry32(0x29b6);
  const strategies: FlowStrategy[] = FLOW_NAMES.map((name, index) => {
    const epochDuration = AUCTION.minEpochDurationSeconds * (FLOW_EPOCHS[index] ?? 6);
    return {
      id: name.toLowerCase().replace(/\s+/gu, '-'),
      name,
      weight: FLOW_WEIGHTS[index] ?? 4_000,
      unitPrice: FLOW_UNIT_PRICES[index] ?? 100,
      pot: 0,
      held: 0,
      epochDuration,
      epochStartedAt: 0,
      fillAt: epochDuration * (0.4 + random() * 0.45),
      lastFill: 0,
      flash: 0,
      delta: 0,
      moved: 0,
    };
  });

  const model: FlowModel = {
    t: 0,
    strategies,
    pending: FLOW_INFLOW_PER_WEEK,
    rate: 0,
    finish: 0,
    nextRouteAttempt: 0,
    nextShift: 4_000,
    particles: [],
    random,
  };

  // Open with a stream already running and something in every pot, so the first frame is not empty:
  // one step to route the waiting revenue, a second to let the stream release against the weights.
  stepFlow(model, 10);
  stepFlow(model, 40);
  stepFlow(model, 6);
  seedFlowParticles(model);
  return model;
}

export function totalWeight(model: FlowModel): number {
  return model.strategies.reduce((total, strategy) => total + strategy.weight, 0) || 1;
}

/** USDG the live stream still has to release. */
export function streamLeft(model: FlowModel): number {
  return Math.max(0, model.rate * Math.max(0, model.finish - model.t));
}

export function stepFlow(model: FlowModel, realDt: number): void {
  const dt = realDt * SIM_SPEED.flow;

  // Checkpoint the elapsed interval against the weights that were live during it, then move them.
  const intervalEnd = model.t + dt;
  const activeDt = model.finish > model.t ? Math.max(0, Math.min(intervalEnd, model.finish) - model.t) : 0;
  const released = model.rate * activeDt;
  const total = totalWeight(model);
  model.t = intervalEnd;

  for (const strategy of model.strategies) {
    strategy.pot += released * (strategy.weight / total);

    // The Strategy's own descending auction: a buyer takes the lot, paying in the asset itself.
    if (model.t - strategy.epochStartedAt >= strategy.fillAt && strategy.pot > 0) {
      const bought = strategy.pot / strategy.unitPrice;
      strategy.lastFill = bought * (1 - AUCTION.defaultBribeBps / BPS);
      strategy.held += strategy.lastFill;
      strategy.pot = 0;
      strategy.flash = 1.4;
      strategy.epochStartedAt = model.t;
      strategy.fillAt = strategy.epochDuration * (0.4 + model.random() * 0.45);
      const lane = model.strategies.indexOf(strategy);
      for (let k = 0; k < 7; k += 1) model.particles.push({ lane, p: -k * 0.08, stage: 2 });
    }
    if (strategy.flash > 0) strategy.flash = Math.max(0, strategy.flash - realDt);
    if (strategy.moved > 0) {
      strategy.moved = Math.max(0, strategy.moved - realDt);
      if (strategy.moved === 0) strategy.delta = 0;
    }
  }

  // Replacement payments pile up in ResonanceRouter. Mine never calls route() and nobody is paid
  // to: this models an unprivileged caller trying once an hour, which no rule requires to exist.
  model.pending += (FLOW_INFLOW_PER_WEEK * dt) / SIGNAL.rewardDurationSeconds;
  if (model.t >= model.nextRouteAttempt) {
    model.nextRouteAttempt = model.t + 3_600;
    const scheduledLeft = streamLeft(model);
    if (model.pending > 0 && model.pending >= scheduledLeft) {
      model.rate = (model.pending + scheduledLeft) / SIGNAL.rewardDurationSeconds;
      model.finish = model.t + SIGNAL.rewardDurationSeconds;
      model.pending = 0;
    }
  }

  // Signal moves in whole lots, and the next dollar follows it.
  if (model.t >= model.nextShift) {
    const lots = [500, 1_000, 1_500, 2_000, 3_000];
    const lot = lots[Math.floor(model.random() * lots.length)] ?? 1_000;
    const from = model.strategies[Math.floor(model.random() * model.strategies.length)];
    const to = model.strategies[Math.floor(model.random() * model.strategies.length)];
    if (from && to && from !== to && from.weight - lot > 1_200) {
      from.weight -= lot;
      to.weight += lot;
      from.delta = -lot;
      to.delta = lot;
      from.moved = 2.6;
      to.moved = 2.6;
    }
    model.nextShift = model.t + 3_200 + model.random() * 5_200;
  }
}

/** Particles travel in real time, so the lanes read at a human pace whatever the clock does. */
export function animateFlow(model: FlowModel, realDt: number): void {
  const total = totalWeight(model);
  if (model.t < model.finish && model.particles.length < 90 && model.random() < 0.5) {
    const pick = model.random() * total;
    let accumulated = 0;
    let lane = 0;
    for (let index = 0; index < model.strategies.length; index += 1) {
      accumulated += model.strategies[index]?.weight ?? 0;
      if (pick <= accumulated) {
        lane = index;
        break;
      }
    }
    model.particles.push({ lane, p: 0, stage: 1 });
  }
  for (let index = model.particles.length - 1; index >= 0; index -= 1) {
    const particle = model.particles[index];
    if (!particle) continue;
    particle.p += (particle.stage === 1 ? 0.3 : 0.9) * realDt;
    if (particle.p >= 1) model.particles.splice(index, 1);
  }
}

/**
 * Dots already spaced along every lane, so the opening frame reads as flowing rather than as an
 * empty diagram — which is the whole frame a reader who asked for no motion ever sees.
 */
function seedFlowParticles(model: FlowModel): void {
  model.particles = [];
  for (let lane = 0; lane < model.strategies.length; lane += 1) {
    for (let step = 0; step < 5; step += 1) {
      model.particles.push({ lane, p: 0.08 + step * 0.2, stage: 1 });
    }
  }
}

/* ------------------------------------------------------------------ the fund */

export interface Holding {
  id: string;
  name: string;
  /** Units held. Illustrative: Fund holds whatever its Strategies bought, and none exist. */
  amount: number;
  /** The scale the bar is drawn against, so a burn is visible as a share of the whole. */
  base: number;
  /** Units leaving in the burn currently playing. */
  leaving: number;
}

export interface FundModel {
  t: number;
  holdings: Holding[];
  /** The share of effective supply the reader chose to burn, 0–1. */
  share: number;
  /** 0–1 through the burn currently playing. */
  progress: number;
  playing: boolean;
  /** The completed burn, kept so the readout survives after the animation. */
  receipt: { share: number; taken: number[] } | null;
  random: () => number;
}

const FUND_NAMES = ['Asset A', 'Asset B', 'Asset C', 'Asset D'] as const;
const FUND_AMOUNTS = [1_240, 386, 2.42, 864] as const;
/** The three slices the reader can burn, as a share of effective supply. */
export const BURN_SHARES = [0.005, 0.01, 0.025] as const;

export function createFund(): FundModel {
  const amounts = FUND_AMOUNTS;
  return {
    t: 0,
    holdings: FUND_NAMES.map((name, index) => ({
      id: name.toLowerCase().replace(/\s+/gu, '-'),
      name,
      amount: amounts[index] ?? 100,
      base: (amounts[index] ?? 100) * 1.12,
      leaving: 0,
    })),
    share: BURN_SHARES[1] ?? 0.01,
    progress: 0,
    playing: false,
    receipt: null,
    random: mulberry32(0xf92b),
  };
}

/** Start a burn. Reduced motion applies it whole, because there is no frame loop to play it. */
export function burn(model: FundModel, share: number, animate: boolean): void {
  model.share = share;
  const taken = model.holdings.map((holding) => holding.amount * share);
  if (!animate) {
    model.holdings.forEach((holding, index) => {
      holding.amount -= taken[index] ?? 0;
      holding.leaving = 0;
    });
    model.playing = false;
    model.progress = 0;
    model.receipt = { share, taken };
    return;
  }
  model.playing = true;
  model.progress = 0;
  model.receipt = { share, taken };
  model.holdings.forEach((holding, index) => {
    holding.leaving = taken[index] ?? 0;
  });
}

export function stepFund(model: FundModel, realDt: number): void {
  model.t += realDt * SIM_SPEED.fund;

  if (model.playing) {
    const previous = model.progress;
    model.progress = Math.min(1, model.progress + realDt / 0.9);
    const delta = model.progress - previous;
    model.holdings.forEach((holding) => {
      holding.amount -= holding.leaving * delta;
    });
    if (model.progress >= 1) {
      model.playing = false;
      model.progress = 0;
      model.holdings.forEach((holding) => {
        holding.leaving = 0;
      });
    }
    return;
  }

  // Between burns the Strategies keep filling, so what Fund holds keeps climbing.
  model.holdings.forEach((holding, index) => {
    holding.amount += (holding.base * realDt * (0.9 + index * 0.12)) / 90;
    if (holding.amount > holding.base) holding.base = holding.amount;
  });
}
