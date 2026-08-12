/**
 * Every word printed on the one-pager.
 *
 * Copy lives in one module for two reasons. The build counts the page's words and fails
 * above the budget, and a one-page sheet is edited by cutting words rather than by
 * shrinking type - which is much easier to do when the whole script is readable at once.
 *
 * The order below is the order the page reads: what the product is, one person using it end
 * to end, how signalling works and what it accumulates into, where GBX comes from and what
 * a share is worth, and why anyone would want in.
 *
 * House rules, enforced by `build.mjs`:
 *   - ASCII hyphens only, never em dashes;
 *   - plain English first, protocol nouns second and always in a smaller label;
 *   - no claim here that `FACT-CHECK.md` does not carry a source for.
 */

import { numbers } from './facts.mjs';

/**
 * The answer to "what is this?", which is the one thing a reader must leave with.
 *
 * The four chips exist because a definition alone does not survive the 30-second retell
 * test: a reader also needs to know who it is for, what they hold, what comes back out, and
 * what ends up in the fund.
 *
 * The "you hold" chip changed with ADR 0024. Under the pooled Fundraiser a reader put
 * dollars in and received GBX from the protocol on a schedule; there is no such door any
 * more. GBX is acquired the way any other token is, and the sheet must not imply a
 * contribution window that no longer exists.
 */
export const hero = {
  wordmark: 'GumBall6900',
  tagline: 'The Index Fund That Chooses Itself',
  question: 'What is this?',
  definition: 'An index fund. The people who own it decide what goes in.',
  chips: [
    { label: "Who it's for", body: 'Anyone who wants a diversified stake, without a manager.' },
    { label: 'You hold', body: 'GBX: a share of the fund, and a say in what it buys.' },
    { label: 'You get back', body: 'Your share of the real assets, whichever ones you pick.' },
    { label: "What's in it", body: 'Tokenized stocks, ETFs and crypto on Robinhood Chain.' },
  ],
};

/**
 * The worked example.
 *
 * One person, one problem, five stages. Every protocol label in this section is small
 * enough to delete without the story stopping making sense, which is the test it is built
 * to pass.
 *
 * Stage one used to be the Fundraiser: Mara added dollars and claimed a proportional slice
 * of that day's new GBX. That mechanism is gone. She now acquires GBX on the market, and
 * where new GBX comes from is explained once, as plumbing, further down the sheet - because
 * for this reader the mining auction is how the fund is supplied, not how they take part.
 */
export const story = {
  title: 'One person, start to finish',
  disclaimer: 'Illustrative: Mara, the amounts and the mix are invented. Nothing has been bought yet.',
  setup: 'Mara has $500 to invest. Every fund she finds hands her a finished basket and decides when she can leave.',
  stages: [
    {
      n: '1',
      verb: 'She gets GBX',
      body: 'Mara buys $500 of GBX, the token that is both her share and her vote.',
      tech: 'GBX',
    },
    {
      n: '2',
      verb: 'She points it',
      body: 'She stakes her GBX for sGBX and assigns it to the assets she wants bought.',
      tech: 'sGBX',
    },
    {
      n: '3',
      verb: 'The fund buys',
      body: "New dollars follow all holders' assignments. The price falls until a trader is willing to supply the asset.",
      tech: 'Strategy',
    },
    {
      n: '4',
      verb: 'The basket grows',
      body: 'The asset joins the basket: everything holders have bought so far.',
      tech: 'Fund',
    },
    {
      n: '5',
      verb: 'She takes her share',
      body: 'She burns her GBX and takes that exact share of the ones she picks. No desk, no notice.',
      tech: 'redeem',
    },
  ],
};

/**
 * Signalling, and why anyone bothers.
 *
 * The sheet used to state that signalling happens without ever saying what a signaler gets
 * for it. The loop `lead` closes is the product's whole argument: point your stake at an
 * asset, the fund buys that asset, the asset backs your GBX, and you can take your share of
 * it out. Splitting this across a "signal" strip and a separate "basket" chart hid the
 * causal chain; they are one section because they are one mechanism.
 *
 * Untouched by ADR 0024: signals decide where routed dollars go, whatever brought them in.
 *
 * The tickers are eligible assets named in `packages/config/assets/robinhood.ts`, not
 * holdings. The split and the four rounds are invented.
 */
export const signal = {
  title: 'How signaling works',
  lead:
    'Stake GBX for sGBX, then point it at the assets you want the fund to own. What it ' +
    'buys backs your GBX, and you can take your share of it out.',
  splitLabel: "This round's signal",
  splitNote: "Every holder's sGBX is pooled, so the next dollar in splits the same way. Move yours any time.",
  segments: [
    { token: 'NVDA', share: 50 },
    { token: 'QQQ', share: 30 },
    { token: 'TSLA', share: 20 },
  ],
  basketLabel: 'What it adds up to',
  basketCaption: 'Nothing is sold, so the basket is every round so far.',
  legend: ['NVDA', 'QQQ', 'TSLA'],
  /** Cumulative holdings after each round. */
  rounds: [
    { a: 50, b: 30, c: 20 },
    { a: 70, b: 90, c: 40 },
    { a: 80, b: 110, c: 110 },
    { a: 140, b: 120, c: 140 },
  ],
};

/**
 * What a share is worth, and where new GBX comes from.
 *
 * Two different kinds of claim share this band, and the distinction is the reason they are
 * set at different sizes. `items[0]` is arithmetic the contract performs - `Fund.redeem`
 * pays `balance * gbxAmount / supplyBeforeBurn` for each selected token, and it holds at
 * any size. `items[1]` is a description of a market: a slot is always for sale, and what a
 * miner ends up with depends on whether anyone replaces them.
 *
 * The old "Going in" rule was the Fundraiser's matching proportion - put in 5% of a day's
 * dollars, get 5% of that day's new GBX - and it has no successor. Nothing about the Mine
 * gives a payer a proportional claim on an epoch's issuance. Writing a mining rule shaped
 * like that proportion would be the single easiest way for this sheet to lie, which is why
 * the replacement deliberately reads as a market and ends on the sentence that says so.
 */
export const rules = {
  title: 'What your share is worth',
  items: [
    { label: 'Coming out', body: 'Burn 1% of all GBX, get 1% of each asset you pick.' },
    {
      label: 'New GBX',
      // Set smaller than the proportion above it, which is the point rather than a space
      // saving: the redemption rule is arithmetic a holder can rely on, and this is a
      // market whose outcome nobody is owed. Giving them equal weight would read as two
      // promises.
      tone: 'note',
      body:
        `Mining slots are always for sale, each price falling to zero over ${numbers.priceDecay}. ` +
        `The buyer pays USDG and earns GBX until replaced: ${numbers.minerShare} of each payment repays ` +
        `the miner replaced, ${numbers.routedShare} is what the fund spends. Nobody is promised a replacement.`,
    },
  ],
};

/**
 * The reasons, not the trivia.
 *
 * This strip used to print protocol facts - genesis liquidity, distribution capacity -
 * which are true and mean nothing to someone deciding whether they want in. These five say
 * what a reader actually gets, and the three zeros are the ones a financially literate
 * reader recognises instantly: no fee, no insiders, no gate on the way out.
 *
 * The fifth figure used to be a lifetime supply ceiling. ADR 0024 removed the cap - Mine is
 * a permanent minter whose rate halves toward a positive tail - so printing a maximum
 * supply would now be false. What replaced it is the genesis allocation, which is the
 * honest version of the same reassurance: the only GBX that existed before mining is
 * locked in the liquidity position, whose principal can never be withdrawn by anyone.
 *
 * Values come from `facts.mjs` where they are derived; only the labels are written here.
 */
export const reasons = {
  label: "Why you'd want in",
  items: [
    { value: '0%', label: 'Management fee, ever' },
    { value: '0', label: 'Team or presale tokens' },
    { value: '0', label: 'Lockup or notice period' },
    { value: numbers.fundBoundShare, label: 'Of payments reach the fund' },
    { value: numbers.genesisLiquidityShort, label: 'Genesis GBX, locked in liquidity' },
  ],
};

/**
 * One line, not a section.
 *
 * The risk register, the open finding, and the reviewed commits belong in the whitepaper;
 * a reader learning what the project is does not need them and will not read them. What
 * survives is the single fact that changes what a reader should do next: it does not exist
 * yet, so there is nothing to take part in. `AGENTS.md` requires that label to be preserved,
 * and dropping it would let the sheet read as a live product.
 */
export const status = {
  note: 'Experimental software. Not deployed, and pending independent review.',
  more: 'Full detail: docs/WHITEPAPER.md',
};
