/**
 * Source-backed protocol constants.
 *
 * Every value here is read from `packages/contracts/src/core` or the repository documentation.
 * Nothing in this module may be invented: no supply figures, prices, yields, participant counts,
 * partners, launch dates, or live activity. The website renders only what this module exposes.
 */

export const DEVELOPMENT_STATUS = {
  short: 'Development protocol — not deployed',
  headline: 'Not deployed, audited, or authorized for user funds.',
  body:
    'Independent review, legal and provenance clearance, final economic parameters, and signed deployment ' +
    'evidence remain release blockers. No production addresses are configured.',
  governance: 'Governance execution remains an unselected external integration, so deployment is blocked.',
} as const;

export const MINE = {
  slotCount: 16,
  slotCountLabel: '16',
  decayPeriod: '1 hour',
  decayPeriodSeconds: 3_600,
  initialRate: '64 GBX/s',
  initialRateValue: 64,
  halvingPeriod: '69 days',
  halvingPeriodDays: 69,
  /** `Mine.HALVING_PERIOD` — 69 days expressed in seconds, for the emission-curve arithmetic. */
  halvingPeriodSeconds: 5_961_600,
  tailRate: '1 GBX/s',
  tailRateValue: 1,
  /** `Mine.BPS` — basis-point denominator for the replacement-payment split. */
  bps: 10_000,
  outgoingMinerBps: 8_000,
  outgoingMinerShare: '80%',
  routerShare: '20%',
  minInitialPrice: '1 USDG',
  /** `Mine.MIN_INITIAL_PRICE` is 1e6 raw units, and USDG carries six decimals, so one USDG. */
  minInitialPriceValue: 1,
  priceMultiplier: 2,
  startingSupply: '0 GBX',
  messageBytes: 280,
  /** Prospective global rate after each halving boundary, GBX per second. */
  halvingLadder: [64, 32, 16, 8, 4, 2, 1] as const,
  tailBoundaryDay: 414,
} as const;

export const SIGNAL = {
  ratio: '1:1',
  receipt: 'sGBX',
  rewardDuration: '7 days',
  rewardDurationDays: 7,
  /** `Resonance.REWARD_DURATION` — the seven-day stream expressed in seconds. */
  rewardDurationSeconds: 604_800,
  entrypoints: ['addSignal', 'addSignalMany', 'removeSignal', 'removeSignalMany'] as const,
} as const;

export const AUCTION = {
  fundShare: '80–100%',
  bribeShare: '0–20%',
  defaultBribeBps: 1_000,
  defaultBribeRate: '10%',
  maxBribeBps: 2_000,
  maxBribeRate: '20%',
  maxRewardTokens: 16,
  minEpochDuration: '1 hour',
  /** `Strategy` bounds its immutable epoch duration to 1 hour – 365 days, in seconds. */
  minEpochDurationSeconds: 3_600,
  maxEpochDuration: '365 days',
  maxEpochDurationSeconds: 31_536_000,
  minPriceMultiplier: '1.1×',
  maxPriceMultiplier: '3×',
} as const;

export const GOVERN = {
  actionCount: 4,
  actions: [
    {
      name: 'Add Strategy',
      signature: 'addStrategy(IERC20 paymentToken, Strategy.Config config)',
      bound: 'Rejects the zero address, code-less tokens, and sGBX.',
    },
    {
      name: 'Kill Strategy',
      signature: 'killStrategy(address strategy)',
      bound: 'Reverts while one live Strategy remains. Irreversible.',
    },
    {
      name: 'Add Bribe reward token',
      signature: 'addBribeRewardToken(address strategy, address rewardToken)',
      bound: 'Bounded by the fixed 16-token Bribe cap. Append-only.',
    },
    {
      name: 'Set global Bribe rate',
      signature: 'setBribeBps(uint256 newBribeBps)',
      bound: 'Bounded to 0–2000 bps. Applies to later purchases only.',
    },
  ],
  ownerless: ['Mine', 'Fund', 'GBX', 'Strategy', 'Bribe', 'BribeRouter', 'ResonanceRouter'] as const,
  absent: [
    'proxy',
    'pause switch',
    'upgrade path',
    'rescue function',
    'arbitrary-call executor',
    'emission setter',
    'migration path',
  ] as const,
} as const;

export const FUND = {
  denominator: 'effective GBX supply',
  denominatorFormula: 'GBX.totalSupply() + Mine.pendingEmission()',
  payoutFormula: 'payout(token) = floor(Fund.balanceOf(token) × gbxAmount ÷ effectiveSupply)',
} as const;

export type MechanismSlug = 'mine' | 'signal' | 'auction' | 'govern';

export interface Mechanism {
  slug: MechanismSlug;
  index: string;
  name: string;
  href: string;
  /** Short verb phrase used in the homepage sequence. */
  kicker: string;
  /** One-sentence definition used on cards and page headers. */
  summary: string;
  accent: 'pink' | 'blue';
  headline: string;
  standfirst: string;
}

export const MECHANISMS: readonly Mechanism[] = [
  {
    slug: 'mine',
    index: '01',
    name: 'Mine',
    href: '/mine',
    kicker: 'Issue',
    summary: 'Sixteen permanent slots issue GBX to whoever holds them.',
    accent: 'pink',
    headline: 'Sixteen slots issue every GBX in existence.',
    standfirst:
      'GBX begins at zero supply. Each of the sixteen permanent slots runs its own hourly ' +
      'descending-price replacement auction, and the rate a slot is assigned stays locked for its ' +
      'complete tenure.',
  },
  {
    slug: 'signal',
    index: '02',
    name: 'Signal',
    href: '/signal',
    kicker: 'Direct',
    summary: 'Escrowed GBX becomes weight on the Strategies the Fund buys through.',
    accent: 'blue',
    headline: 'Escrowed GBX is weight, never an idle receipt.',
    standfirst:
      'GBX enters one-for-one escrow as non-transferable sGBX. Every addition allocates immediately ' +
      'to a live Strategy, and that weight decides which Strategies receive the seven-day USDG stream.',
  },
  {
    slug: 'auction',
    index: '03',
    name: 'Auction',
    href: '/auction',
    kicker: 'Acquire',
    summary: 'Every Strategy sells its USDG for the asset it is mandated to acquire.',
    accent: 'pink',
    headline: 'One bounded auction acquires every asset.',
    standfirst:
      'A Strategy sells its accumulated USDG in a descending-price auction and asks to be paid in the ' +
      'asset itself. Between 80% and 100% of that payment goes straight to Fund. There is no oracle.',
  },
  {
    slug: 'govern',
    index: '04',
    name: 'Govern',
    href: '/govern',
    kicker: 'Bound',
    summary: 'Four bounded actions, and nothing else, remain under any owner.',
    accent: 'blue',
    headline: 'Four actions. No proxy, no pause, no rescue.',
    standfirst:
      'Resonance holds the only continuing owner authority in the protocol, and it is limited to four ' +
      'bounded calls. Mine and Fund have no owner at all. The external executor remains unresolved.',
  },
] as const;

export type ChapterSlug = 'mine' | 'resonance' | 'fund';

export interface Chapter {
  slug: ChapterSlug;
  index: string;
  name: string;
  /** One sentence on what this stage of the protocol converts into what. */
  summary: string;
  accent: 'pink' | 'blue';
}

/**
 * How the landing page tells it: the protocol is a conversion in three stages. Emissions pull USDG
 * in, that USDG is spent into the assets the Fund holds, and a burn takes those assets back out.
 *
 * A chapter carries no route. The dashboard that renders these is the explanation of the rules and
 * nothing else, so it holds no link into the app shells.
 */
export const CHAPTERS: readonly Chapter[] = [
  {
    slug: 'mine',
    index: '01',
    name: 'Mine',
    summary: 'GBX emissions are what buys USDG into the protocol.',
    accent: 'pink',
  },
  {
    slug: 'resonance',
    index: '02',
    name: 'Resonance',
    summary: 'That USDG is spent into the assets the Fund ends up holding.',
    accent: 'blue',
  },
  {
    slug: 'fund',
    index: '03',
    name: 'Fund',
    summary: 'Burning GBX takes a share of those assets back out.',
    accent: 'pink',
  },
] as const;

export const HERO = {
  headline: 'An onchain index fund built by its holders.',
  /* The headline is set in two halves so they can part around the film as it boxes. */
  headlineLead: 'An onchain index fund',
  headlineTrail: 'built by its holders.',
  standfirst: 'Mine GBX. Signal what the Fund should acquire. Redeem the assets it holds.',
} as const;
