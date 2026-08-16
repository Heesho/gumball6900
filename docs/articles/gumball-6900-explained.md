---
title: How GUM BALL 6900 Turns Community Conviction Into an Onchain Portfolio
version: 1.1.0
date: 2026-08-16
source_commit: 95ed60efe333d875f7a66da7853eebdf5384e956
protocol_status: Development candidate. Implementation complete at this commit; not approved for user funds.
deployment_status: Not deployed on any network. No signed deployment manifest exists.
internal_review_status: Internal engineering review and automated test campaigns, including passing static-analysis, mutation, and external-fuzzing gates. Open release gates recorded in packages/contracts/audit/FINDINGS.md.
independent_audit_status: No independent external audit has been performed.
---

# How GUM BALL 6900 Turns Community Conviction Into an Onchain Portfolio

> **Before you read on:** this protocol is not deployed, not audited, and not approved for user funds. This article
> describes what the code at commit `95ed60e` does, not a live product. Nothing here is investment advice.

## 1. The central idea

Imagine an investment club with three unusual rules.

**First**, it has no manager. Members commit a token to express conviction — "we should be buying wrapped bitcoin" —
and the club's income flows toward whichever holdings carry the most committed conviction. Move your commitment, and
the flow follows.

**Second**, it never negotiates a purchase. When it has money to spend, it holds a public auction: it offers its cash
to anyone willing to hand over the target asset and lowers its asking price steadily until someone accepts. No
appraiser, no price feed, no discretion.

**Third**, leaving is arithmetic rather than a request. Burn your membership tokens and the vault hands you your
proportional share of whichever holdings you name. No redemption window, no gate, no manager who can say no.

That is GUM BALL 6900. These are not policies people follow — they are smart contracts that execute. The manager is
not honest; the manager does not exist.

## 2. Why ordinary funds require trust

Buying into a conventional fund means trusting a chain of promises: that the fund holds what the statement says, that
the custodian really has the assets, that the fee calculation is right, that you can withdraw on the stated terms.
Each is enforced by law and reputation — slowly, and after the fact.

Early onchain funds moved the assets on-chain but often kept the trust. Look closely at many "decentralized index"
products and you find an admin key that can change holdings, an upgradeable contract that can change rules, a pause
switch that can stop withdrawals, and an oracle that decides what everything is worth. Same promises, different
paperwork.

GUM BALL 6900's premise is that if you remove _every_ discretionary lever, what remains is either verifiable or
absent. At this commit the protocol has no upgrade path, proxy, pause switch, rescue or sweep function,
arbitrary-call executor, migration route, price oracle, NAV calculation, rebalancing engine, or keeper role. The
treasury has no owner at all.

The honest flip side: removing every lever also removes every repair. A bug cannot be patched. A deployment mistake
cannot be corrected.

## 3. What GBX represents

**GBX** is the protocol's token. It is an ordinary transferable ERC-20 — you can hold it, send it, and trade it.

It is created in exactly two ways. At deployment, the contract mints **20,000,000 GBX** once, and that allocation
becomes the protocol's permanent market liquidity (more on that in section 11). After that, all new GBX comes from
**mining** — continuous issuance to whoever occupies the mine's slots.

The crucial structural fact is that mint authority is handed to one contract, exactly once, at deployment, and then
permanently locked. There is no way to add a second minter, replace the first, or reopen the handover. Burning GBX
doesn't reopen it either. Supply reconciles exactly: total supply always equals everything ever minted minus
everything ever burned.

There is **no supply cap**. Issuance halves as cumulative mining crosses fixed thresholds, but it settles at a
permanent floor that is strictly positive rather than falling to zero. GBX inflates forever, slowly.

Holding GBX gives you two rights, and it is worth being precise about which is which:

- **Signal with it**, and you direct protocol revenue, earn rewards, and vote in governance.
- **Burn it**, and you withdraw your share of the treasury.

Holding GBX in your wallet does neither of those things by itself.

## 4. What it means to signal

The protocol has **Strategies** — each one a standing mandate to acquire one particular asset. A Strategy for wrapped
bitcoin. A Strategy for a staked-ETH token. And so on.

**Signaling** is a single atomic step with three parts that always happen together:

1. You deposit GBX into **SignalGBX**, ticker **sGBX**.
2. You receive exactly the same amount of sGBX.
3. That sGBX is committed to one Strategy you name.

Withdrawing reverses all three at once. There is deliberately **no in-between state**: you cannot hold sGBX that isn't
committed to something. Every sGBX unit in existence is assigned to exactly one Strategy at all times.

That is a real design choice with consequences, so it's worth stating plainly. It means the protocol's voting supply
and its economically active signal are the _same number_ — everyone who can vote is also directing revenue and earning
rewards. It also means there is no way to hold voting power without also putting it to work.

sGBX is **non-transferable**. You cannot send it, sell it, or lend it. Any transfer attempt reverts.

You can spread your position across Strategies by signaling each one separately — 700 GBX to the bitcoin Strategy,
300 to the staked-ETH Strategy. These are absolute amounts, not percentages.

Three properties matter:

- **There is no lock-up, cooldown, or voting epoch.** You can signal, move, and withdraw in consecutive blocks.
- **You can always withdraw.** Withdrawal is bounded only by what you actually have committed to the Strategy you're
  withdrawing from.
- **Every signal change first settles the revenue that accrued under the old weights.** Moving your signal never
  claws back or redirects money that already accrued to someone else. It only affects flow from that moment on.

The complete user surface is four functions: signal, signal using a gasless approval on the underlying GBX, move
signal between Strategies, and withdraw signal.

## 5. How SignalGBX and governance relate to signaling

Signaling GBX gives you **voting power** in protocol governance. That power is measured using historical snapshots:
when a proposal is created, the system records everyone's sGBX balance at a specific past block, and votes are
weighted by that record. Your first signal automatically activates your voting power without a second transaction.

Because there is no idle sGBX, governance participation and economic participation are bundled: you cannot vote
without also directing revenue, and you cannot direct revenue without also being able to vote.

So there are three distinct positions a person can hold, and they are not interchangeable:

| Position                        | Can vote? | Directs revenue? | Earns rewards? | Can redeem?         |
| ------------------------------- | --------- | ---------------- | -------------- | ------------------- |
| Holding liquid GBX in a wallet  | No        | No               | No             | Yes (by burning)    |
| Signaling a Strategy with sGBX  | Yes       | Yes              | Yes            | No (withdraw first) |
| Voting on a governance proposal | —         | No               | No             | —                   |

Two wrinkles remain, and they're the reason governance risk hasn't gone away. Signal that is committed but never
_delegated_ still counts toward the _quorum denominator_ — the participation a proposal needs to pass — while never
voting. And signal sitting on a **retired** Strategy still counts toward quorum while directing no revenue at all.
Enough of either could make governance unreachable. This is a known, open concern, tracked internally as finding G-03.

## 6. Where the money comes from

Protocol revenue arrives in **USDG**, a stablecoin the protocol neither issues nor controls. In the intended
deployment it has six decimal places, which matters later for the arithmetic.

There are two revenue sources, and only two.

**Mining.** The mine has slots — one at launch, and governance may add more up to a hard maximum of sixteen. Whoever
occupies a slot receives continuously minted GBX at a fixed rate. To take a slot, you win its auction: the price to
displace the current occupant starts at some level and falls in a straight line to zero over one hour, then sits at
zero until someone takes it.

When you take an **occupied** slot, 80% of what you pay becomes a claim for the miner you displaced, and 20% becomes
protocol revenue. When you take an **empty** slot, there is nobody to compensate, so 100% becomes protocol revenue.
There is no team fee anywhere in this. The displaced miner's 80% is held as a claim they withdraw when they like —
anyone can trigger the withdrawal, but the money can only ever go to the miner.

Two things a prospective miner should understand. First, your GBX rate is **locked for your entire tenure** — adding
slots, halving issuance, and redemptions never change it. Only a newly occupied slot receives the current rate divided
by the current slot count. Second, less comfortably: **the 80% handoff is not guaranteed.** You receive it only if
someone later replaces you at a nonzero price, and since the price falls to zero after an hour, a successor can
replace you having paid nothing. You keep the GBX you accrued, but no handoff payment. Interfaces must not present
that 80% as principal, yield, or a refund.

<!-- figure: mining-split -->

**Liquidity fees.** The 20,000,000 GBX genesis allocation sits in a single Uniswap v4 position pairing GBX with USDG,
held permanently in a contract with no owner and no withdrawal function. Anyone may call a public function that
collects its trading fees: the USDG becomes revenue, the GBX is burned, and the underlying liquidity is verified
unchanged. There is no reward for the caller, so fees can sit uncollected until someone volunteers the gas.

## 7. How Resonance directs revenue over time

Revenue does not get handed out the moment it arrives. It flows into a contract called **Resonance**, which releases
it as a **rolling seven-day stream**.

Think of it as a tank set to drain evenly over seven days. Whatever comes out at each moment is divided among
Strategies in proportion to the sGBX signaling them _at that moment_.

Two design details exist to prevent specific attacks.

**Revenue waits in a router until it is worth restarting the stream for.** New revenue accumulates in a staging
contract called **ResonanceRouter**, which forwards its balance only once that balance is at least as large as the
exact amount still left in the current schedule. Once it qualifies, the router forwards _everything_, and Resonance
combines the new money with the old remainder and restarts a fresh seven-day stream. So restarting the stream early is
possible but expensive — you must match what's left. It also means a mining payment can sit in the router for a while
before it appears in the stream; interfaces must show those as different states.

**Streaming is lazy.** Entitlement accrues with time in the arithmetic, but tokens move only when someone triggers a
settling action — a signal change, a revenue notification, a payout, or a purchase. So a Strategy's visible token
balance understates what it is owed, and any interface that reads the raw balance and calls it inventory is wrong.

## 8. A numeric walkthrough: how signal allocation works

Let's make this concrete. All figures below are exact integer arithmetic at six decimals for USDG and eighteen for
sGBX.

**Setup.** Resonance receives a notification of **604,800 USDG**. Seven days is 604,800 seconds, so the stream rate
works out to exactly **1 USDG per second** with no remainder. (When the division isn't clean, the leftover raw units
are paid out one extra unit per second at the start of the period — nothing is discarded.)

Three participants and three Strategies:

| Person | Signals                                        | sGBX minted |
| ------ | ---------------------------------------------- | ----------- |
| Ana    | 1,000 GBX to **Strategy A** (wrapped bitcoin)  | 1,000       |
| Ben    | 3,000 GBX to **Strategy B** (staked ETH)       | 3,000       |
| Cara   | 600 GBX to **Strategy C** (a governance token) | 600         |

Total active signal weight: 1,000 + 3,000 + 600 = **4,600 sGBX** — which is also the entire sGBX supply, since none
of it can sit idle.

**Day 1** streams 86,400 USDG (86,400,000,000 raw units), split by weight:

| Strategy | Weight | Share | Day 1 USDG        |
| -------- | ------ | ----- | ----------------- |
| A        | 1,000  | 5/23  | 18,782.608695     |
| B        | 3,000  | 15/23 | 56,347.826086     |
| C        | 600    | 3/23  | 11,269.565217     |
|          |        |       | **86,399.999998** |

Notice the total: **0.000002 USDG short**. That residue is the floor of the integer division. It is not paid to
anyone, does not go to the treasury, and stays in Resonance permanently. This is a deliberate, documented trade-off —
section 15 returns to it.

**Day 2.** Ben decides staked ETH is the wrong bet and moves his entire 3,000 signal from Strategy B to Strategy A.
Crucially, this settles Day 1 first — Ben's move does **not** claw back the 56,347.826086 USDG that already accrued to
Strategy B. From now on:

| Strategy | Weight | Share | Day 2 USDG    |
| -------- | ------ | ----- | ------------- |
| A        | 4,000  | 20/23 | 75,130.434782 |
| B        | 0      | 0     | 0             |
| C        | 600    | 3/23  | 11,269.565217 |

**Day 3.** Cara withdraws her 600 signal from Strategy C — which in one atomic step removes the signal, burns her 600
sGBX, and returns her 600 GBX. Active weight is now just Ana's 1,000 plus Ben's 3,000, both on Strategy A:

| Strategy | Weight | Share | Day 3 USDG |
| -------- | ------ | ----- | ---------- |
| A        | 4,000  | 100%  | 86,400.00  |

**Totals after three days:**

| Strategy | Accumulated USDG |
| -------- | ---------------- |
| A        | 180,313.043477   |
| B        | 56,347.826086    |
| C        | 22,539.130434    |

<!-- figure: signal-allocation -->

Four days and 345,600 USDG remain in the stream. Cara earned Bribe rewards on Strategy C for two days and stopped the
moment she withdrew. Ben's Strategy B holding is frozen at what it earned — it will accumulate nothing further unless
someone signals it again.

## 9. What a Strategy auction does

A Strategy now holds USDG and needs to convert it into the asset it is mandated to acquire. It does this with a
**descending-price auction** — the design is sometimes called a "reverse Dutch auction" after the lineage it derives
from; mechanically, the price starts high and falls until somebody takes the trade.

Here is the whole mechanism. The Strategy offers its **entire** USDG balance. It asks to be paid a certain quantity of
the target asset. That asking quantity falls in a straight line to zero over a configured period (at minimum one hour,
at maximum one year). Anyone may fill it at any moment by paying the current asking price. Once filled, the next
auction starts at the price just paid multiplied by a fixed multiplier — so a hot auction restarts higher — subject to
a floor and a ceiling.

There is no oracle. The auction _is_ the price discovery. If the Strategy is asking too much, nobody fills it and the
price falls. If it is asking too little, someone fills it immediately and the next auction starts higher.

Buyers are protected by three parameters on their own transaction: the auction round they expect (so a competing fill
can't change the price under them), a deadline, and a maximum they will pay.

<!-- figure: auction-decay -->

## 10. A numeric walkthrough: acquisition and redemption

Continuing the example, **Strategy A** holds **180,313.043477 USDG** and is mandated to acquire wrapped bitcoin.

**The auction.** Strategy A's auction runs over 24 hours with a starting price of **4 WBTC**. The price falls
linearly. A buyer watching decides that 180,313 USDG is worth roughly 2 WBTC and waits.

At 13.2 hours elapsed (47,520 of 86,400 seconds, so 55% of the way through), the price has fallen 55%:

```text
price = 4 WBTC − (4 WBTC × 47,520 ÷ 86,400) = 4 − 2.2 = 1.8 WBTC
```

The buyer fills. They pay **1.8 WBTC** and receive **180,313.043477 USDG**. (The purchase first pulls any revenue
released to the Strategy through that exact timestamp, so they receive everything the Strategy is owed, not just its
visible balance.)

**Settlement — the 90/10 split.** The 1.8 WBTC is immediately divided by an immutable, hard-coded rule:

```text
Fund   90%  →  1.62 WBTC   (treasury backing for every GBX holder)
Bribe  10%  →  0.18 WBTC   (reward for Ana and Ben, who signaled Strategy A)
```

Each share is recorded as a separate liability and delivered by its own call that anyone can make. This matters: if
the treasury or the reward pool has a problem with that token, **only that leg stalls**. The other leg still settles,
and neither can freeze the auction itself.

<!-- figure: acquisition-split -->

The split is also **cumulatively exact**. It carries the fractional remainder between payments, so a buyer cannot
starve the reward share by paying in tiny increments. Ten separate one-unit payments produce exactly 9 units to the
Fund and 1 to the Bribe — not zero to the Bribe ten times over.

The next auction round then starts at 1.8 WBTC × the configured multiplier — at 1.5×, that is **2.7 WBTC**.

**So Ana and Ben are paid directly out of the acquisition.** They split 0.18 WBTC in proportion to their signal —
Ana 1,000/4,000 and Ben 3,000/4,000, so 0.045 and 0.135 WBTC respectively. On top of that they may also earn separately
funded **Bribes** — see section 12.

**Redemption.** Time passes. Many auctions run. Suppose the Fund now holds **50 WBTC** and **400 ETH**, GBX total
supply is **100,000,000**, and miners have accrued **1,000,000 GBX** that has not yet been minted.

Diego holds 250,000 GBX and wants out. He calls redeem, naming WBTC and ETH.

**Step 1 — the miners get credited first.** Before doing anything else, the Fund forces the mine to mint every miner's
accrued GBX. Supply rises from 100,000,000 to **101,000,000 GBX**. This is deliberate: it stops a redeemer from
claiming a share calculated against a supply figure that ignores GBX the miners have already earned.

**Step 2 — one snapshot for everything.** The Fund records supply-before-burn = 101,000,000 GBX and records its
balance of each named asset. Every payout uses this same denominator.

**Step 3 — the payouts.**

```text
WBTC: floor(50 WBTC × 250,000 ÷ 101,000,000) = 0.12376237 WBTC
ETH:  floor(400 ETH × 250,000 ÷ 101,000,000) = 0.990099009900990099 ETH
```

**Step 4 — the burn.** Diego's 250,000 GBX is burned. Supply falls to 100,750,000 GBX. Everything above happens in one
atomic transaction: if any transfer fails, the entire redemption including the burn is undone.

<!-- figure: redemption -->

**Two things worth noticing.** Without the Step 1 checkpoint, Diego's WBTC payout would have been 0.125 WBTC instead
of 0.12376237 — the difference is exactly the dilution from recognising the miners' claim, and it is correct. And if
the Fund had been holding, say, 2,000,000 GBX from a GBX-denominated auction that nobody had burned yet, that GBX
would have counted in the denominator and reduced Diego's payout. Anyone can burn Fund-held GBX at any time, and a
redeemer should do so first.

## 11. What the Fund holds

The Fund is an **ownerless raw-token treasury**. Not a curated portfolio — a treasury.

It has no administrator, no roles, and no asset registry. Assets can leave in exactly two ways: a GBX holder redeems,
or someone burns Fund-held GBX. There is no sweep, rescue, recovery, or migration function of any kind.

The consequence of having no registry is that **anyone can send any ERC-20 to the Fund and it becomes redeemable
backing**, reviewed or not. Being in the Fund does not make a token official. Official membership means being a
Strategy registered by governance — nothing more. That registered set is the closest thing the protocol has to an
index: it is the curated list of assets the protocol is trying to acquire. But it is only a list. There are no target
weights, no rebalancing, and no valuation — whatever proportions the Fund ends up holding are an outcome, not a plan.
Interfaces must label unsolicited Fund balances separately.

Because you name the assets you want, you can skip a broken or worthless token rather than have it block your
redemption. The trade-off is that **anything you skip is permanently forfeited** — it stays in the Fund for the
remaining supply. There is no partial-claim ledger.

## 12. How signalers are rewarded

Signalers have two stacked income sources, and they arrive through the same contract.

**First, the automatic 10%.** Every time their Strategy acquires an asset, a tenth of that asset is streamed to
whoever is signaling it, split in proportion to signal. This requires no external party and no negotiation — it is
simply what the protocol does with every acquisition. It also aligns the incentive neatly: you earn the asset you
voted to accumulate, so signaling for something worthless pays you in something worthless.

**Second, Bribes.** A "bribe," here, is not corruption — it is the standard term for an open, permissionless reward
stream used to attract attention. Anyone can deposit additional reward tokens into a Strategy's pool, which streams
them to that Strategy's signalers the same way.

Who would do that? A project that wants the protocol to accumulate its token; a DAO that wants its asset in a
long-term treasury; a market maker who benefits from the auction flow. The protocol takes no position on motive.

Some deliberate details, which apply to both sources:

- **At most eight reward tokens per Strategy**, hard-coded, append-only. The cap exists so that entering, leaving, and
  settling a signal position stay bounded in gas no matter what governance does.
- **You cannot disturb someone else's live stream.** Adding rewards while a stream is running queues them behind it
  rather than restarting or slowing it. (This is the opposite of Resonance's behavior — the two are genuinely
  different mechanisms.)
- **If everyone stops signaling, the stream pauses** rather than draining with nobody to pay, and resumes when signal
  returns.
- **You can claim one token at a time**, so a single frozen reward token cannot block the rest.
- **Rewards you arrived too late for are not yours.** Fractional amounts that cannot be fairly assigned are routed to
  the Fund rather than redistributed to whoever happens to still be signaling.

## 13. How governance works

Governance can do **four things**, and the contract rejects any proposal that tries to do anything else — checked by
target address, function selector, and even calldata length, before the proposal can be created:

1. Add a Strategy.
2. Permanently retire a Strategy.
3. Register a Bribe reward token (within the eight-token cap).
4. Increase mine capacity (increase-only, hard cap of sixteen).

Voting power comes from signalled sGBX measured at a historical snapshot block. A passing proposal goes into a
**Timelock** — a contract that holds an approved action for a fixed delay before it can be executed. After the delay,
anyone can execute it.

There is one guard rail on retirement: **the final live Strategy cannot be retired.** If only one remains, the
proposal reverts. To replace it, governance must add the replacement first — both actions can sit in the same
proposal. This guarantees there is always somewhere valid to signal, which matters now that signaling is the only way
to hold sGBX at all.

Governance **cannot** change mining prices, the 90/10 acquisition split, halving parameters, the tail rate, mint
authority, Fund assets, liquidity custody, the auction mechanism, or any voting parameter. The Governor's own settings
are fixed at deployment. The generic escape hatches that most DAO frameworks ship with — arbitrary relay calls,
replacing the timelock, accepting ETH — are all wired to revert permanently.

Three honest limitations:

- **The timelock delay is a warning window, not an emergency brake.** Once a proposal is queued, nobody can cancel it.
  There is no guardian and no veto. Cancellation is available only to the proposer, and only before voting starts.
- **Voting power is not locked.** Because votes use a historical snapshot and withdrawal is unrestricted, someone can
  signal across the snapshot, vote, and withdraw immediately. Borrowed GBX can vote.
- **Retiring a Strategy is irreversible**, which makes the point above materially more serious.

## 14. What happens when something fails

The protocol is built so a failure in one place doesn't cascade:

- **A broken token cannot trap your position.** Withdrawing signal is pure accounting — it never transfers
  a reward, payment, or revenue token, so a frozen third-party token cannot block them.
- **A frozen treasury cannot block an auction.** Auction payments are recorded as a liability and delivered by a
  separate, retryable call.
- **A broken asset cannot block redemption for everyone else.** You name what you want, so you can omit it.
- **A misbehaving token fails loudly.** Every transfer checks that the sender was debited and the receiver credited by
  exactly the requested amount, so fee-on-transfer and rebasing tokens revert rather than lose value silently. This is
  fail-closed evidence — it does _not_ make an adversarial token safe.
- **Failed payouts stay owed and retryable.** A blocked recipient cannot redirect a liability elsewhere.

One failure mode has no recovery. When a Strategy is retired, its reward pool stays open for existing signalers but
nobody new can join. If the **last** signaler withdraws while rewards remain, those rewards are stranded permanently —
possibly an entire unvested stream, not merely dust. There is deliberately no refund or rescue. Interfaces must warn
the final signaler before they exit.

## 15. What GUM BALL 6900 does not guarantee

Read this section twice.

- **It does not guarantee that assets appreciate.** The protocol buys what signalers point it at. That aggregates
  conviction; it does not make conviction correct.
- **It does not guarantee investment returns.** There is no yield, distribution, or promise of any kind. Your
  redemption is a share of whatever the Fund happens to hold, which may be worth less than you paid.
- **It does not guarantee auction liquidity.** An auction fills only if someone chooses to fill it. A price falling to
  zero guarantees a _price_, not a _buyer_.
- **It does not guarantee good signal choices.** There is no quality filter beyond governance approval, no
  diversification requirement, and no risk framework.
- **It does not guarantee safe external tokens.** USDG and every payment and reward token are third-party contracts
  that may be upgradeable, pausable, blocklisting, or malicious. The Fund accepts any ERC-20 without review.
- **It does not guarantee permanent frontend availability.** The contracts are permissionless, but no website,
  indexer, or API is guaranteed to exist. You may need to interact with contracts directly.
- **It does not eliminate smart-contract risk.** The code has not been independently audited, and because nothing is
  upgradeable, a discovered bug cannot be patched.
- **It does not eliminate governance risk.** Capture, deadlock through undelegated signal, and uncancellable queued proposals
  are all live concerns (section 13).
- **It does not eliminate chain, MEV, or timing risk.** Auctions and mining slots are competitive, publicly visible
  opportunities. Transactions can be reordered, front-run, or censored, and chains can reorganize.
- **It does not eliminate regulatory risk.** Legal treatment in any jurisdiction is unresolved.
- **And it accumulates permanent dust.** Rounding residue and revenue streamed while nobody signals accrue in
  Resonance forever with no recovery path. Precision keeps individual amounts tiny, but **no lifetime bound on the
  total is claimed**.

## 16. Major risks, summarized

| Risk                            | What it means                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| No independent audit            | No third party has reviewed this code. The single largest unknown.                                  |
| Immutability                    | No patch, no pause, no rescue. A bug or deployment error is permanent.                              |
| Deployment correctness          | Parameters, pool configuration, and role setup must be right the first time, forever.               |
| Unresolved economics            | Mining rate, halving threshold, tail rate, and price parameters not yet selected or modelled.       |
| Governance capture and deadlock | Unlocked snapshot voting; undelegated signal inflates quorum; queued proposals cannot be cancelled. |
| Miner rollover                  | The 80% handoff arrives only if a successor pays. It can be zero.                                   |
| Abandoned rewards               | A retired Strategy's last signaler can strand an unbounded amount of rewards.                       |
| Accepted dust                   | Rounding and zero-signal intervals accumulate unrecoverable USDG in Resonance.                      |
| Third-party tokens              | USDG and every acquired asset carry independent freeze, upgrade, and solvency risk.                 |
| Legal and provenance            | Upstream code lineage and license reconciliation are unresolved release blockers.                   |

## 17. Current project status

To be exact about where this stands at commit `95ed60e`:

- **Not deployed.** No contract is live on any network. No signed deployment manifest exists. The intended target
  chain and the canonical USDG and Uniswap v4 addresses remain unresolved candidates.
- **Not audited.** No independent external audit has been performed, and symbolic analysis and formal verification
  have not been completed.
- **Internally tested.** At this commit the default test suite passes 335 tests and the integration suite passes 17,
  with zero failures and zero skips. That includes 21 property-based fuzz tests at 10,000 runs each and 27 stateful
  invariants each run 1,000 times to a depth of 500 transitions — 13.5 million state transitions in total. Real
  Uniswap v4 fee harvesting is exercised.
- **Static analysis, mutation testing, and external fuzzing now pass.** Pinned Slither, Aderyn, Semgrep, and Gitleaks
  gates pass; Medusa completed 101,602 calls and Echidna 100,213 calls with all 25 properties holding; a 43-mutant
  campaign killed every mutant. This is a meaningful step up from the previous internal state, and it is still
  engineering evidence rather than a security guarantee.
- **Five High-severity release gates remain open**, covering deployment verification, unselected economic parameters,
  and the governance capture and liveness model. Also outstanding: a second external-fuzzer seed, reviewed production
  parameters, a monitored testnet rehearsal, and release review.
- **Legal and provenance clearance is outstanding.** The protocol's contracts adapt several upstream codebases whose
  licensing chain has not been resolved, including one with a GPL ancestor.

Nothing in this article should be read as a claim that the protocol is safe, audited, live, launched,
production-ready, or suitable for funds you cannot afford to lose.

---

_See also: the [one-pager](../one-pagers/gumball-6900.md) for a two-minute summary, and the
[technical whitepaper](../whitepapers/gumball-6900/whitepaper.md) for exact formulas, state machines, accounting
identities, and the full threat model._
