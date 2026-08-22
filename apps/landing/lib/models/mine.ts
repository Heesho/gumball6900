/**
 * lib/models/mine.ts — the mine model, MOVED here from components/sections/Mining.tsx.
 *
 * THE ONE RULE: this is the frozen model layer. Every body below is the body
 * that shipped in Mining.tsx, textually unchanged apart from the mechanical
 * edits the move required:
 *
 *   · closure variables became fields on `MineState` (`S.t` → `s.t`,
 *     `scaleTop` → `s.scaleTop`, …);
 *   · the three things that were genuinely outside the model — narrating into
 *     the DOM, flashing a detail cell, and launching the payment chips from a
 *     screen coordinate — became the `MineFx` sink the caller supplies;
 *   · `depositFull = !displaced` moved out of `narrate()`'s body (which is now
 *     the caller's) to the statement immediately before `fx.narrate(…)`, so it
 *     still runs at exactly the same point in the same order.
 *
 * Nothing else. No renamed constant, no reordered branch, no changed clamp, no
 * altered random-seeding shape. Roughly twenty rounds of honesty fixes live in
 * these functions and are invisible in a screenshot — see docs/MODELS.md §1 and
 * the gauntlet's THE ONE RULE.
 *
 * Two paint layers now consume it: the mining section and the plate. Both step
 * the same code, so a figure on the plate and a figure in the section can never
 * disagree about what the contracts do.
 */

// Contract constants the sim is bound by.
export const SLOTS = 16;
export const DECAY = 3600; // Mine.PRICE_DECAY_PERIOD, seconds
export const MINER_BPS = 8000; // Mine.PREVIOUS_MINER_BPS
export const BPS = 10000;
export const MULT = 2; // Mine.PRICE_MULTIPLIER
export const MIN_PRICE = 1; // Mine.MINIMUM_INITIAL_PRICE = 1e6 raw six-decimal USDG
export const INITIAL_TPS = 64; // Mine.INITIAL_TPS, GBX/s globally
export const HALVING_PERIOD = 69 * 86400; // Mine.HALVING_PERIOD, seconds from startTime
export const TAIL_TPS = 1; // Mine.TAIL_TPS, GBX/s globally
export const MINE_START_TIME = 0;
export const SIM_ARRIVAL_TIME = 10 * 60; // enough reachable history to desynchronise occupied tenures
export const SLOT_HOURLY = (INITIAL_TPS / SLOTS) * 3600;
export const SLOT_HOURLY_LABEL = SLOT_HOURLY.toLocaleString('en-US');

export const NAMES = [
  'ava',
  'kai',
  'rin',
  'moss',
  'juno',
  'pike',
  'wren',
  'isla',
  'odin',
  'nix',
  'sol',
  'vega',
  'bex',
  'tao',
  'koi',
  'lux',
];
// Never-taken slots: the only ones that can deposit 100%. Two of the four sit
// inside the detail strip, so the reader watches a cell go open → taken.
export const OPEN_AT_START = new Set([1, 2, 9, 13]);
// The four slots the detail strip names. The other twelve are drawn, not
// truncated — the ghost row says which is which.
export const DETAIL = [0, 1, 2, 3];

// The scripted programme, in sim seconds. timeScale is 60, so a beat is five
// real seconds and one full cycle of the programme is twenty-five.
export const BEAT = 300;
export type Beat = 'other-occ' | 'other-first' | 'you-buy' | 'you-out';
export const PROGRAM: readonly Beat[] = ['other-occ', 'other-first', 'you-buy', 'other-occ', 'you-out'];
/* How long the reader holds a slot, in sim seconds, redrawn every cycle. What
   a tenure earns is its length times a locked rate, so a tenure scripted to a
   fixed length would report the same GBX on every exit for ever — the one beat
   that is about the reader would be the one beat that looks canned. Only the
   dwell varies: the rate, the split and every figure are the model's. */
export const YOU_MIN = 420; // ~7 real seconds
export const YOU_MAX = 840; // ~14 real seconds

// Event durations, in SIM seconds (timeScale 60 → 66 ≈ 1.1 real seconds), so
// they pause with the sim instead of running on a wall clock.
export const EVT = 66;
export const LEAP = 27; // the restart leap, ~450ms real
export const DROP = 0.17; // the share of a chip's flight spent falling into the lane
/* Both halves of a payment are born at the same point and run to opposite ends
   of the lane, so a figure drawn the instant its chip lands on the rail is
   drawn on top of its twin — one frame in a thousand, but it is a number over
   a number. They pick up their figures a beat after they have parted. */
export const PART = DROP + 0.06;

/* The allocation divider has to be telling the truth while the money it explains
   is still in the air. A payment's chips are airborne for well under a second,
   so a bar that is still easing at +1s draws the inverse of its own caption for
   the whole transfer — the reader is told 80/20 and shown 3% at the moment they
   look. It lands in ~350ms, inside the same event window the cell flash uses,
   and it LANDS: this is a fixed-length ease on the house curve, not a
   first-order lag, which only ever approaches its target. */
export const DIV_EASE = 21; // sim-seconds ≈ 350ms real

/* The dollar axis holds the dearest thing the drawing has to show, and it can
   never cut anything off. A ceiling that clips draws two slots a full 1.7×
   apart at exactly the same height, and — far worse — it hides the restart
   leap on precisely the takes where the leap is largest, which is the one move
   that makes this a market rather than a giveaway. So the ceiling tracks the
   running peak with headroom; a slot mid-leap counts at its destination, so
   the frame opens ahead of the climb rather than being caught by it. It cannot
   ratchet away, because a restart price is capped and every price decays to
   zero within the hour, so the peak comes back down on its own. */
export const AXIS_HEAD = 1.09; // headroom above the dearest slot
export const AXIS_MIN = 6; // a quiet board still fills the frame
export const AXIS_RISE = 10; // sim-seconds: opens fast, ahead of a leap
export const AXIS_FALL = 90; // …and closes slowly, so the field never flickers
export const AXIS_SAFE = 1.035; // hard floor: nothing being painted is ever cut

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** The house curve, in canvas terms: fast away, settling in. */
export function easeOut(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 - Math.pow(1 - c, 3);
}

export interface Slot {
  owner: string | null;
  initialPrice: number;
  startedAt: number;
  lastAccruedAt: number;
  tps: number;
  mined: number;
  reserve: number;
}

/** A payment allocation in flight. It falls out of the taken column into the
    lane and then runs along the lane to one of its two ends. `a`/`b` are its
    window inside the event, so the claim and GBX that follows it never overlap. */
export interface Part {
  x0: number;
  x1: number;
  age: number;
  a: number;
  b: number;
  size: number;
  colour: string;
  /* The square is the keyed mark and takes its destination's exact tone; the
     figure beside it is text and takes whatever tone survives 10px antialiasing
     on the knockout. They are the same colour except on the 80% leg, whose
     segment tone is far too dark to carry type — see CHIP_INK_80. */
  ink: string;
  label: string;
  align: CanvasTextAlign;
}

export function globalTps(elapsedSinceStart: number): number {
  // Mirrors Mine._globalTps: only deployment-time age selects the prospective
  // rate. Minted and pending supply do not participate.
  const halvings = Math.floor(Math.max(0, elapsedSinceStart) / HALVING_PERIOD);
  return Math.max(INITIAL_TPS / Math.pow(2, halvings), TAIL_TPS);
}

export function money(n: number): string {
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + n.toFixed(2);
}

export function gbx(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return Math.round(n).toLocaleString();
  return n.toFixed(1);
}

/* The annotation on a restart leap is derived from the two prices the leap is
   drawn between — the ghost tick at what was paid, and the head of the column
   it climbed to. Mine fixes the multiplier at ×2; this display never approaches
   the contract's uint192 raw-price cap.

   When the FLOOR is what set the price, the label names the floor instead of
   quoting a ratio. Nothing was multiplied — a $0.17 take does not restart at
   $0.34, it restarts at the minimum — and a ratio there would be a figure the
   reader cannot check: the panel prints money to the cent, so "$0.17 → $1.00"
   reads as ×5.88 on screen while the unrounded prices make it ×5.74. Naming
   the floor is both the true cause and the one statement the two printed
   prices confirm exactly. */
export function leapNote(paid: number, restart: number): string {
  if (paid * MULT < MIN_PRICE) return '$' + MIN_PRICE + ' floor';
  return '×' + (restart / paid).toFixed(2).replace(/\.?0+$/, '');
}

/* ------------------------------------------------------------------ state -- */

export interface MineState {
  t: number;
  totalMined: number;
  routerDeposits: number;
  paidToMiners: number;
  slots: Slot[];
  // Per-slot event emphasis, in sim seconds, decayed every step so lit
  // states can never accumulate.
  flash: number[];
  // What the slot last sold for, and how far its restart leap has climbed.
  // leapP === 1 means the leap is over; nothing lingers.
  paidAt: number[];
  leapP: number[];
  parts: Part[];
  scaleTop: number; // the dollar axis, eased so it never snaps
  // The deposit bar states the rule at rest and shows the exception while the
  // narrated take is the one that deposited everything. It is tied to the tape,
  // never to a timer, so bar and narration can never disagree.
  depositFull: boolean;
  // …and it moves as a fixed-length ease between the two allocations, so it is
  // done inside the event window rather than creeping after it.
  divFrom: number;
  divTo: number;
  divP: number;
  divShown: number;
  // The one column the tape is talking about — whoever's take it is. It gets
  // the emphasis: brighter stroke, solid marker, full-brightness price.
  featured: number;
  // The one slot the reader holds, or -1. Capped at one by construction: the
  // programme only buys when this is -1, and ambient takes never touch it.
  youSlot: number;
  // The ×2 annotation that rides the payment lane under the narrated take.
  x2Col: number;
  x2Age: number;
  // True only while the board is being pre-run to build history off-screen.
  warming: boolean;
  beatIdx: number;
  nextBeat: number;
  // The two beats the reader's tenure spans, drawn fresh each time they buy.
  youLegA: number;
  youLegB: number;
}

/**
 * The three things the model does that are not model: it narrates into the
 * page, it lights a detail cell, and it launches the payment chips from a
 * screen coordinate the paint layer owns. Each consumer supplies its own.
 */
export interface MineFx {
  /** the tape — who bought, who was displaced, where each share went */
  narrate?: (
    index: number,
    buyer: string,
    displaced: string | null,
    paid: number,
    toMiner: number,
    toRouter: number,
    accrued: number,
  ) => void;
  /** a detail cell names its own consequence for ~1s */
  cellEvent?: (index: number) => void;
  /** the payment, in flight: the caller knows where the taken column is */
  transfer?: (index: number, slot: Slot, toMiner: number, toRouter: number, accrued: number) => void;
  /** run once inside warmStart, between the pre-run and the first live beat */
  beforeFirstBeat?: () => void;
}

export function createMineState(): MineState {
  const s: MineState = {
    t: 0,
    totalMined: 0,
    routerDeposits: 0,
    paidToMiners: 0,
    slots: [],
    flash: new Array<number>(SLOTS).fill(0),
    paidAt: new Array<number>(SLOTS).fill(0),
    leapP: new Array<number>(SLOTS).fill(1),
    parts: [],
    scaleTop: 30,
    depositFull: false,
    divFrom: 0.8,
    divTo: 0.8,
    divP: 1,
    divShown: 0.8,
    featured: -1,
    youSlot: -1,
    x2Col: -1,
    x2Age: 0,
    warming: false,
    beatIdx: 0,
    nextBeat: 0,
    youLegA: BEAT,
    youLegB: BEAT,
  };
  seedBoard(s);
  return s;
}

export function seedBoard(s: MineState): void {
  s.t = SIM_ARRIVAL_TIME;
  s.totalMined = 0;
  s.routerDeposits = 0;
  s.paidToMiners = 0;
  s.slots.length = 0;
  s.flash.fill(0);
  s.paidAt.fill(0);
  s.leapP.fill(1);
  s.parts.length = 0;
  s.depositFull = false;
  s.divFrom = 0.8;
  s.divTo = 0.8;
  s.divP = 1;
  s.divShown = 0.8;
  s.featured = -1;
  s.youSlot = -1;
  s.x2Col = -1;
  s.x2Age = 0;
  NAMES.forEach((name, i) => {
    const open = OPEN_AT_START.has(i);
    const slot: Slot = {
      // Start occupied slots at independently reachable times after deployment,
      // otherwise the whole board reaches its reservation together and all
      // sixteen change hands at once. Empty slots retain Mine's deployment-time
      // $1 auction and never get silently reopened.
      owner: open ? null : name,
      initialPrice: open ? MIN_PRICE : 4 + Math.random() * 26,
      startedAt: open ? MINE_START_TIME : MINE_START_TIME + Math.random() * s.t,
      lastAccruedAt: open ? MINE_START_TIME : MINE_START_TIME + Math.random() * s.t,
      tps: open ? 0 : globalTps(s.t - MINE_START_TIME) / SLOTS, // vacant slots emit nothing
      mined: 0,
      // Reservation as a fraction of the slot's own price, redrawn per tenure —
      // the desync that keeps the board from churning in lockstep.
      reserve: 0,
    };
    if (!open) {
      slot.lastAccruedAt = slot.startedAt;
      slot.mined = (s.t - slot.startedAt) * slot.tps;
    }
    slot.reserve = slot.initialPrice * (0.25 + Math.random() * 0.55);
    s.slots.push(slot);
  });
}

/** The decay law at any point of a slot's own hour — Mine._price, which is
    as valid read forward as read now. */
export function priceAt(slot: Slot, at: number): number {
  const elapsed = at - slot.startedAt;
  if (elapsed >= DECAY) return 0;
  return slot.initialPrice * (1 - elapsed / DECAY);
}
export function priceOf(s: MineState, slot: Slot): number {
  return priceAt(slot, s.t);
}

export function neverTaken(s: MineState): number {
  let n = 0;
  s.slots.forEach((slot) => {
    if (slot.owner === null) n++;
  });
  return n;
}

/** Push one allocation chip into the lane. The paint layer owns the geometry. */
export function spawn(
  s: MineState,
  x0: number,
  x1: number,
  size: number,
  colour: string,
  label: string,
  align: CanvasTextAlign,
  a: number,
  b: number,
  ink: string = colour,
): void {
  if (s.parts.length > 24) s.parts.splice(0, s.parts.length - 24);
  s.parts.push({ x0, x1, age: 0, a, b, size, colour, ink, label, align });
}

/** A miner from the pool who is not the one being displaced. */
function otherName(exclude: string | null): string {
  for (let k = 0; k < 8; k++) {
    const n = NAMES[Math.floor(Math.random() * NAMES.length)];
    if (n && n !== exclude) return n;
  }
  return NAMES[0]!;
}

export function buy(s: MineState, fx: MineFx, index: number, forcedOwner: string | undefined, narrated: boolean): void {
  const slot = s.slots[index];
  if (!slot) return;
  const paid = priceOf(s, slot);
  const displaced = slot.owner;

  // Settle the outgoing tenure: its accrual mints to the displaced miner.
  let accrued = 0;
  if (displaced !== null) {
    accrued = (s.t - slot.lastAccruedAt) * slot.tps;
    s.totalMined += accrued;
  }

  // Allocate the payment: vacant slot → 100% Router deposit; occupied →
  // an 80% pull claim plus the exact 20% Router deposit.
  let toMiner = 0;
  let toRouter = 0;
  if (paid > 0) {
    if (displaced === null) {
      toRouter = paid;
    } else {
      toMiner = (paid * MINER_BPS) / BPS;
      toRouter = paid - toMiner;
    }
    s.routerDeposits += toRouter;
    s.paidToMiners += toMiner;
  }

  // New tenure: restart price at paid ×2 with the $1 floor; only deployment-
  // time age selects the prospective rate, which is divided by sixteen and
  // locked until this slot is replaced.
  // Nobody displaces themselves: the incoming miner is never the outgoing one.
  slot.owner = forcedOwner || otherName(displaced);
  slot.initialPrice = Math.max(paid * MULT, MIN_PRICE);
  slot.startedAt = s.t;
  slot.lastAccruedAt = s.t;
  slot.tps = globalTps(s.t - MINE_START_TIME) / SLOTS;
  slot.mined = 0;
  slot.reserve = slot.initialPrice * (0.3 + Math.random() * 0.55);

  if (displaced === 'you') s.youSlot = -1;
  if (slot.owner === 'you') s.youSlot = index;

  if (!s.warming) {
    // The leap: the marker climbs from what was paid to what it restarts at.
    s.flash[index] = 1;
    s.paidAt[index] = paid;
    s.leapP[index] = 0;
    // A detail cell names its own consequence for ~1s, then cleans up.
    fx.cellEvent?.(index);
  }

  if (narrated) {
    s.featured = index;
    s.depositFull = !displaced;
    fx.narrate?.(index, slot.owner, displaced, paid, toMiner, toRouter, accrued);
    if (!s.warming) {
      s.x2Col = index;
      s.x2Age = 1;
      fx.transfer?.(index, slot, toMiner, toRouter, accrued);
    }
  }
}

/** Which never-taken slot the scripted first-take spends next.

    CHEAPEST FIRST, and it matters. There are exactly four slots that can
    ever deposit 100%, they are spent one at a time over about forty seconds,
    and every one of them is decaying towards zero the whole while. Spending
    the dearest first leaves the cheapest — the one closest to being worth
    nothing — to carry the last and most recent demonstration of the
    headline allocation, which is how the panel came to teach "the whole
    payment is deposited" over a payment of $0.00 and a Router tally that did
    not move. Cheapest first spends each vacancy while it still has a price
    to spend and leaves the dearest standing, so the last 100% take on
    screen — the one a reader arriving late sees — is the one worth the
    most. Same four slots, same prices, same order of magnitude of total
    Router deposits: only which of the eligible slots the beat targets changes,
    exactly as the reader's own beat already chooses among occupied slots.

    Cheapest measured AT THE MOMENT ITS TURN WOULD COME, not at this
    instant, and the difference decides the tail. The four vacancies fall at
    four different rates — a slot's whole price is surrendered across one
    hour, so the dearest one is also the one shedding cents fastest — and
    the walk takes about a beat and a half per slot. Ranking on the price
    right now therefore keeps back whichever slot happens to be dearest
    today and hands the last beat a slot that has since expired: over 30,000
    modelled walks that lands the final 100% take on exactly $0.00 in 3.6%
    of them. Ranking on the price the slot will still have when its turn
    arrives spends the ones that are about to run their hour out while they
    are still worth something and keeps back the one that will still be
    alive at the end — $0.00 in 0.8%, and a median final take of $2.43
    against $0.58 for taking the dearest first.

    Nothing is skipped and nothing is re-opened: every vacancy is still
    spent, in a different order, so the counter's walk down to "every slot
    has been taken once" always completes.

    Still weighted toward the detail strip, so a named cell is seen flipping
    open → taken. */
const FIRST_GAP = 720; // sim seconds between scripted first-takes, measured
function pickFirst(s: MineState): number {
  const open: number[] = [];
  s.slots.forEach(function (slot, i) {
    if (slot.owner === null) open.push(i);
  });
  if (!open.length) return -1;
  const turn = s.t + (open.length - 1) * FIRST_GAP;
  const bias = (i: number) => (DETAIL.includes(i) ? 1 / 1.35 : 1);
  const worth = (i: number, at: number) => priceAt(s.slots[i]!, at) * bias(i);
  // …and where two will both be worth nothing by then, spend the deader one
  // now and leave the other its remaining minutes.
  open.sort((a, b) => worth(a, turn) - worth(b, turn) || worth(a, s.t) - worth(b, s.t));
  return open[0]!;
}

/** An occupied slot the reader does not hold, from the dearer middle of the
    board so the 80/20 split is worth reading, picked with enough spread that
    the narrated column moves around the board instead of sitting on one
    slot and bidding it into the price cap. */
function pickOccupied(s: MineState): number {
  const held: { i: number; p: number }[] = [];
  const any: { i: number; p: number }[] = [];
  s.slots.forEach(function (slot, i) {
    if (slot.owner === null || slot.owner === 'you') return;
    const entry = { i, p: priceOf(s, slot) };
    any.push(entry);
    // Longer than a beat, so the tape can never narrate the same column
    // twice running, and no slot churns in lockstep with the programme.
    if (s.t - slot.startedAt > BEAT + 60) held.push(entry);
  });
  const pool = held.length ? held : any;
  if (!pool.length) return -1;
  pool.sort(function (a, b) {
    return a.p - b.p;
  });
  const lo = Math.floor(pool.length * 0.35);
  const hi = Math.max(lo, pool.length - 1 - Math.floor(pool.length * 0.2));
  const k = Math.min(pool.length - 1, lo + Math.floor(Math.random() * (hi - lo + 1)));
  return pool[k]!.i;
}

export function runBeat(s: MineState, fx: MineFx): void {
  const scripted = PROGRAM[s.beatIdx % PROGRAM.length] ?? 'other-occ';
  /* A never-taken slot's hour runs out whether or not anyone takes it, and
     those four are the only slots that can ever deposit 100%. So while any
     remain, the cycle's second miner beat spends one too: all four are seen
     at a real price, and the foot counter's walk down to "every slot has
     been taken once" is a thing that happens rather than a thing that
     stalls. Nothing is re-opened — when they are gone the beat is an
     ordinary 80/20 take, which is the truth from then on. */
  const slot0 = s.beatIdx % PROGRAM.length;
  const kind: Beat = slot0 === 3 && scripted === 'other-occ' && pickFirst(s) >= 0 ? 'other-first' : scripted;
  s.beatIdx++;
  /* The reader's tenure runs from the 'you-buy' beat to the 'you-out' beat
     two beats later, so those two beats carry its length between them.
     Both stay long enough to read the take they narrate. */
  if (slot0 === 2) {
    const span = YOU_MIN + Math.random() * (YOU_MAX - YOU_MIN);
    s.youLegA = span * (0.4 + Math.random() * 0.2);
    s.youLegB = span - s.youLegA;
  }
  s.nextBeat = s.t + (slot0 === 2 ? s.youLegA : slot0 === 3 ? s.youLegB : BEAT);
  if (kind === 'you-out' && s.youSlot >= 0) {
    // Someone takes the slot the reader holds: 80% and the GBX go to them.
    buy(s, fx, s.youSlot, undefined, true);
    return;
  }
  if (kind === 'you-buy' && s.youSlot < 0) {
    const i = pickOccupied(s);
    if (i >= 0) {
      buy(s, fx, i, 'you', true);
      return;
    }
  }
  if (kind === 'other-first') {
    const i = pickFirst(s);
    if (i >= 0) {
      buy(s, fx, i, undefined, true);
      return;
    }
    // Every slot has been taken once: the 100% deposit honestly no longer
    // exists, and the foot counter has already said so.
  }
  const i = pickOccupied(s);
  if (i >= 0) buy(s, fx, i, undefined, true);
}

export function stepMine(s: MineState, dt: number, fx: MineFx): void {
  s.t += dt;
  s.slots.forEach(function (slot, i) {
    if (slot.owner !== null) slot.mined += dt * slot.tps;
    // Never inside the first stretch of a tenure, so slots cannot churn in
    // lockstep. Never-taken slots are left for the scripted first-take, and
    // the reader's own slot is left for the scripted displacement.
    if (
      slot.owner !== null &&
      slot.owner !== 'you' &&
      s.t - slot.startedAt > 240 &&
      priceOf(s, slot) <= slot.reserve
    )
      buy(s, fx, i, undefined, false);
    if (s.flash[i]! > 0) s.flash[i] = Math.max(0, s.flash[i]! - dt / EVT);
    if (s.leapP[i]! < 1) s.leapP[i] = Math.min(1, s.leapP[i]! + dt / LEAP);
  });
  if (s.x2Age > 0) s.x2Age = Math.max(0, s.x2Age - dt / EVT);

  /* The axis. `peak` is what the frame has to hold a moment from now — a
     slot mid-leap counts at the price it is climbing to — and `drawn` is
     what is on the glass this frame, computed exactly as the painter
     computes it. The ceiling eases toward a round-dollar peak, quick to
     open and slow to close, and is then floored just above `drawn`, so no
     column can ever terminate at the ceiling with its price flattened
     against its neighbours'. */
  let peak = 0;
  let drawn = 0;
  s.slots.forEach(function (slot, i) {
    const p = priceOf(s, slot);
    if (s.leapP[i]! < 1) {
      peak = Math.max(peak, slot.initialPrice);
      drawn = Math.max(drawn, s.paidAt[i]! + (slot.initialPrice - s.paidAt[i]!) * easeOut(s.leapP[i]!));
    } else {
      peak = Math.max(peak, p);
      drawn = Math.max(drawn, p);
    }
  });
  const raw = Math.max(AXIS_MIN, peak * AXIS_HEAD);
  const step = raw > 48 ? 10 : raw > 24 ? 4 : raw > 9 ? 2 : 1;
  const wanted = Math.ceil(raw / step) * step;
  s.scaleTop += (wanted - s.scaleTop) * Math.min(1, dt / (wanted > s.scaleTop ? AXIS_RISE : AXIS_FALL));
  s.scaleTop = Math.max(s.scaleTop, drawn * AXIS_SAFE, AXIS_MIN);

  const divWant = s.depositFull ? 0 : 0.8;
  if (divWant !== s.divTo) {
    s.divFrom = s.divShown;
    s.divTo = divWant;
    s.divP = 0;
  }
  if (s.divP < 1) {
    s.divP = Math.min(1, s.divP + dt / DIV_EASE);
    s.divShown = s.divFrom + (s.divTo - s.divFrom) * easeOut(s.divP);
  }
  for (let j = s.parts.length - 1; j >= 0; j--) {
    const part = s.parts[j]!;
    part.age += dt / EVT;
    if (part.age >= part.b) s.parts.splice(j, 1);
  }
  if (s.t >= s.nextBeat) runBeat(s, fx);
}

// Arrive mid-life: pre-run ten sim minutes so the reader lands on a board with
// history — tallies non-zero, prices spread across the axis — and then
// watches live purchases happen on top of it. `landOn` walks the programme
// forward off-screen to a chosen beat, which is how the reduced-motion still
// is composed without faking a state the mechanism cannot reach.
export function warmStart(s: MineState, fx: MineFx, landOn?: Beat): void {
  seedBoard(s);
  s.beatIdx = 0;
  s.nextBeat = Infinity; // no scripted beats during the warm-up
  s.warming = true;
  for (let k = 0; k < 100; k++) stepMine(s, 6, fx);
  if (landOn) {
    let guard = 0;
    // One beat per turn regardless of how long that beat is scheduled to
    // run for, so the walk cannot stall on a long scripted tenure.
    while (guard++ < 24 && PROGRAM[s.beatIdx % PROGRAM.length] !== landOn) {
      s.nextBeat = s.t;
      stepMine(s, BEAT, fx);
    }
    s.nextBeat = Infinity;
  }
  s.warming = false;
  s.parts.length = 0;
  s.flash.fill(0);
  s.paidAt.fill(0);
  s.leapP.fill(1);
  s.x2Col = -1;
  s.x2Age = 0;
  s.depositFull = false;
  s.divFrom = 0.8;
  s.divTo = 0.8;
  s.divP = 1;
  s.divShown = 0.8;
  // Land on a real take rather than a placeholder: the tape, the deposit
  // bar and the money all tell the truth from the very first frame.
  fx.beforeFirstBeat?.();
  runBeat(s, fx);
  // …including the bar. There is no previous allocation to ease away from on a
  // cold start, so the divider begins where the take it is drawn beside
  // already is, rather than sliding into agreement with its own caption.
  s.divShown = s.divFrom = s.divTo = s.depositFull ? 0 : 0.8;
  s.divP = 1;
}
