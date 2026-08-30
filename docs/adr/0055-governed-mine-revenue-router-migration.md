# ADR 0055: Governed Mine revenue-router migration and two-step ownership

- Status: accepted for development; not independently audited, deployed, or approved for user funds
- Date: 2026-08-30
- Supersedes:
  - [ADR 0034](0034-external-governance-ownership.md) where it makes Resonance the only continuing custom owner;
  - [ADR 0045](0045-defer-mine-router-token-verification.md) where it makes Mine's initial ResonanceRouter permanently
    immutable; and
  - [ADR 0054](0054-atomic-gbx-launch-and-genesis-v2-liquidity.md) where the launcher completes a one-step Resonance
    ownership handoff inside `launch` and leaves Mine ownerless.
- Preserves: direct non-upgradeable contracts; immutable Mine emissions, slots, auction accounting, GBX mint authority,
  USDG, and Fund; ownerless Fund; permissionless old-graph exits and claims; setup-only plain-Ownable shells; and the
  absence of pause, sweep, arbitrary-call, proxy, or balance-migration authority

## Context

Mine deposits the protocol share of each replacement into ResonanceRouter and deliberately does not call `route()`.
That isolation prevents a later Router or Resonance failure from reverting an already completed replacement. The
original design nevertheless fixed Mine's Router at construction, so a permanently unusable Router or Resonance would
also permanently stop new mining revenue from reaching a working signal-and-acquisition graph.

Resonance has substantially more state and accounting surface than Mine or Fund. Replacing that graph without changing
Mine, Fund, GBX issuance, slot ownership, or redemption is a useful failure boundary. The replacement must not sweep,
rewrite, or impersonate the old graph: users may still need to remove old signal, claim old rewards, and then signal
their returned GBX into the new graph.

The selected design gives governance one narrow Mine method for future revenue only. It also changes the two contracts
that retain continuing governance to OpenZeppelin `Ownable2Step`, reducing accidental ownership handoff risk without
adding a Governor, Timelock, guardian, or core execution policy.

## Decision

### Narrow Mine administration

Mine remains a direct, non-upgradeable contract. Its GBX, USDG, Fund, slot count, emission schedule, auction parameters,
genesis state, accrued mining claims, and GBX mint binding remain immutable or otherwise outside owner control.

Mine stores a mutable `resonanceRouter` and exposes exactly one custom owner method:

```text
Mine.setResonanceRouter(newRouter)
```

The method changes only the destination of future protocol-share deposits. It cannot move a token balance, alter an
existing outgoing-miner claim, call either graph, change mining emissions, pause a slot, redirect a user's claim, or
modify Fund redemption. A successful change emits the previous Router, new Router, and new Resonance.
Each later `RevenueDeposited` event also identifies the Router that received that specific payment, so historical
deposits remain attributable across multiple cutovers.

Mine retains the immutable Fund address solely as part of replacement-graph validation. Construction requires that Fund
to contain code and report Mine's immutable GBX. A candidate Router is accepted
only when the following graph is deployed and reciprocally consistent:

```text
newRouter.usdg() == Mine.usdg()
newRouter.resonance() contains code
newResonance.usdg() == Mine.usdg()
newResonance.fund() == Mine.fund()
newResonance.resonanceRouter() == newRouter
newSignalGBX.gbx() == Mine.gbx()
newSignalGBX.resonance() == newResonance
```

The new Router must differ from the current Router. These checks prove structural consistency only. They do not prove
runtime-code provenance, honest token behavior, safe governance, or correct economics. Governance and release evidence
must separately authenticate every replacement contract and binding at a pinned chain state.
Mine does not validate the new Resonance owner, factory bindings, Strategy set, Bribe rate, lifetime counters, or
pristine schedule state. Those are deployment and governance gates for the replacement graph, not properties implied by
setter success.

The setter never calls the old Router or old Resonance. Governance must first deploy and bind the complete replacement
Resonance graph, verify it independently, and switch Mine last. This prevents a broken old graph from vetoing the
switch and prevents Mine from pointing at an incomplete replacement graph.

### Old and new graph boundaries

The switch applies prospectively. USDG already held by the old Router, scheduled or unscheduled USDG in the old
Resonance, Strategy claims, Bribe balances, and account signal positions remain in the old graph. The protocol adds no
sweep, forced signal move, cross-graph accounting copy, or automatic reward migration.

Users exit the old graph through its ordinary public paths: claim old Bribe rewards as desired, remove signal to burn
old sGBX and recover the same GBX, then add signal into a Strategy registered by the new Resonance. Old live or killed
Strategy positions remain governed by the old graph's own state and liveness properties. The Mine switch cannot rescue
an old position if the old graph's own exit path is already broken.

Because each SignalGBX binds one Resonance exactly once, the replacement graph uses a different SignalGBX address. An
external governance system configured to read the old SignalGBX checkpoints does not automatically recognize voting
power in the new receipt. The external integration must separately define and review whether governance continues to
use the old token, changes to the new token, or uses another explicit transition. Mine's setter does not update a voting
token, proposal system, permission graph, or governance owner.

Future empty-slot payments and the protocol share of future nonempty replacements go to the new Router. Outgoing-miner
claims, historical Mine events, GBX emissions, and Fund assets do not move. Permissionless `route()` calls continue
independently on both the old and new Routers for balances each already holds.

### Two-step continuing ownership

Mine and Resonance inherit OpenZeppelin `Ownable2Step`. Their current owner begins a transfer with
`transferOwnership(newOwner)`, and only that exact pending owner completes it with `acceptOwnership()`. Renunciation
remains the inherited immediate owner action. Before acceptance, the current owner can replace the pending owner or
cancel the pending transfer with `transferOwnership(address(0))`; pending status grants no owner authority. Two-step
transfer does not add a delay to ordinary owner calls.

Resonance's separate setup-only `setResonanceRouter` call is consumed before handoff. It binds the sole notifying Router
once and cannot replace or clear that binding later. SignalGBX, StrategyFactory, and BribeFactory remain plain `Ownable`
setup shells. Each uses its owner only for the one-time Resonance binding, after which the launcher renounces ownership
in the launch transaction. Adding
`pendingOwner` and `acceptOwnership` to those permanently ownerless shells would add unused ABI surface without
protecting their actual renunciation path.

The canonical launcher initially owns Mine and Resonance. After it binds the graph, seeds liquidity, registers the two
initial Strategies, and renounces the three setup-only owners, it begins both two-step transfers to the exact passed
governance contract. Before `launch` returns, it verifies:

```text
Mine.owner() == launcher
Mine.pendingOwner() == finalOwner
Resonance.owner() == launcher
Resonance.pendingOwner() == finalOwner
```

The governance contract must then call `acceptOwnership()` on both Mine and Resonance. Those acceptance calls occur
after the atomic launch transaction and may be batched only if the reviewed external governance executor supports it.
Until acceptance, the single-use launcher remains the formal owner, but it exposes no post-launch path that can call
Mine or Resonance owner methods, including the ordinary ability to replace or cancel a pending transfer. A missing or
failed acceptance therefore leaves administration inert rather than silently assigning it to another address.

Production exposure remains blocked until pinned receipts prove both acceptances, both zero pending owners, the three
setup-shell renunciations, and the complete immutable/mutable authority graph.

## Security consequences

- A compromised Mine owner can redirect all future protocol-share revenue to any malicious graph that mimics the
  required identity getters. The onchain checks do not authenticate bytecode.
- A consistent but operationally incomplete graph can pass the Mine checks. In particular, setter success does not prove
  that reviewed governance owns the new Resonance, that its factories are correct, that a live Strategy exists, or that
  accounting begins in the intended state.
- The core imposes no delay, veto, guardian, or rollback on `setResonanceRouter`. Any such policy must come from the
  exact reviewed external governance system.
- `Ownable2Step` reduces accidental transfer to an address that cannot acknowledge ownership, but does not protect
  against a malicious current owner, a compromised pending owner, current-owner replacement or cancellation of a
  pending transfer, immediate renunciation, or a malicious Router update.
- A bad accepted Router can divert future protocol revenue. Under the reviewed standard-USDG model, Mine still performs
  only an ERC-20 transfer to that address and does not call its routing logic during replacement.
- Old graph balances and user positions do not follow the switch. Operational interfaces must present old-graph claim
  and unsignal actions until every relevant account has exited; deprecating discovery is not the same as emptying the
  contracts.
- Moving signal to the new graph also moves the user into a different SignalGBX checkpoint system. A governance design
  tied to old sGBX can lose participation as users exit, while a design tied to new sGBX needs an independently reviewed
  transition. The cutover plan must avoid depending on voting power that users must first destroy to complete it.
- The Fund remains the same immutable treasury across accepted replacement graphs. A replacement Resonance that reports
  another Fund is rejected, preventing future acquisitions from silently building a separate backing treasury through
  this setter.
- The GBX and reciprocal SignalGBX checks prevent the replacement graph from presenting another staking asset as the
  canonical signal token, but exact source, runtime, factory, Strategy, Bribe, and governance review remains mandatory.
- Renouncing Mine ownership after a switch permanently fixes the then-current Router. Renouncing Resonance ownership
  separately freezes that Resonance's administration surface. Neither action is two-step or recoverable.

## Consequences

- Mine and Fund remain non-upgradeable; only Mine's future revenue destination becomes governed.
- Mine gains one immutable Fund reference, one mutable Router reference, one owner-only setter, two-step ownership
  state, validation interfaces, errors, and a Router-update event. This is new audit, ABI, SDK, subgraph, deployment,
  monitoring, and invariant surface.
- Resonance's four continuing custom owner methods and its consumed setup-only Router binding are unchanged, but its
  ownership transfer becomes two-step.
- The canonical launch no longer completes final ownership inside one transaction. Graph construction and pending-owner
  assignment remain atomic; governance acceptance is an explicit post-launch release gate.
- A replacement is a forward-revenue cutover, not a state migration. It does not make the old graph disappear or prove
  every user has exited it.
- An owner may perform more than one reviewed Router change over Mine's lifetime unless it later renounces ownership.
  Every change requires the same full graph validation, governance authorization, monitoring, and independent review.

## Review and deployment boundary

This decision changes the trust model after the V12 audit, the 2026-08-29 direct review, and the ADR-0054 launcher
evidence. Those records remain historical and must not be cited as coverage of `Ownable2Step`, the Mine setter,
replacement-graph validation, two-step launch handoff, or old/new graph operations.

Production remains blocked on implementation review; current deterministic, stateful, integration, mutation, ABI,
subgraph, and pinned-fork evidence; exact external-governance selection; acceptance-call compatibility; replacement
runbook review; and a signed manifest. Nothing in this ADR authorizes deployment, ownership acceptance, a Router
switch, user funds, or a claim that migration has occurred.
