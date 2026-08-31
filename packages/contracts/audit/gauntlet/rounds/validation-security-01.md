# Independent validation: SECURITY-01

Target: `70091b642006f0b2788bd89a6a0e734a632619cf`

Disposition: confirmed Medium; production design decision and ADR pending.

An independent reviewer first composed two behaviors that existing tests covered only separately: a zero-price purchase
after full decay and a purchase whose receiver is the Strategy itself. With the canonical GBX Strategy parameters, an
unfunded account can call `buy(address(strategy), epochId, deadline, 0)` once per mature epoch. The USDG transfer to the
Strategy is a successful self-transfer, so the complete inventory stays put, while the auction advances and resets to
`100,000 GBX`. A competing zero-price transaction becomes stale.

The self-receiver reproduction repeats this transition across eight epochs, including after the seven-day Resonance
stream is exhausted. The attacker holds zero GBX, grants zero allowance, and pays only transaction gas. Measured call
execution was 37,881 gas after stream exhaustion and at most 145,549 gas while a purchase also checkpointed and pulled
released revenue. A buyer willing to pay the reset floor can clear the inventory immediately, so the behavior is a
repeatable ordering/liveness grief rather than an absolute freeze or direct user-principal lock.

A second independent review rejected the proposed self-receiver-only remediation. A helper contract calls
`buy(address(helper), epochId, deadline, 0)`, receives the complete USDG inventory, and lets `buy` finish. The Strategy
has already advanced the epoch and restored the full floor. After the reentrancy guard unlocks, the helper transfers its
complete USDG balance back to Strategy in the same outer transaction. The helper is both buyer and receiver, is not the
Strategy, holds no GBX, and grants no allowance. The end state is the same: the Strategy holds the old or larger
inventory, while the current price has moved from zero to `100,000 GBX`.

The production `Strategy.sol` used by that second test was byte-for-byte equal to frozen target `70091b6` with SHA-256
`9ac38ff5adc3dc45ea37223026c39542338c3e3552c397b7548cf2e455decf0a`. The focused helper case passed, and the complete
reproduction file passed two tests with zero failures.

Executable evidence:

- `packages/contracts/test/minimal/audit-exitability/reproductions/StrategySelfReceiverGrief.t.sol`
- self-receiver case: eight repeatable resets, including one after stream exhaustion
- non-self helper case: three atomic receive-and-return resets
- focused result: 2 passed, 0 failed
- formatter result for the reproduction: pass

The exact pinned Euler source also permits a caller-selected asset receiver and transfers auctioned assets before
resetting the epoch. Its constructor rejects a self-addressed fixed _payment_ receiver, not the caller-selected asset
receiver. That ancestry explains the auction shape but does not support a GumBall revenue-receiver identity check or
make the round trip safe in GumBall's permissionless zero-price USDG-clearance context.

## Root invariant

An untrusted zero-cost operation must not transform a mature Strategy from `(price = 0, inventory = R)` into
`(price > 0, inventory >= R)`. Any transition that restores a positive price must be coupled to either durable
inventory removal or an irreversible nonzero payment. A Strategy cannot prove durable removal of freely transferable
USDG after `buy` returns, because any receiver or later holder can transfer those fungible units back.

## Rejected local mitigations

- Rejecting `revenueReceiver == address(this)` is bypassed by the reproduced helper.
- Requiring `revenueReceiver == msg.sender` is also bypassed because the helper is both caller and receiver.
- Requiring an apparent EOA or codeless receiver is bypassable by a constructor-in-progress or ordered EOA
  transactions, while excluding smart accounts.
- Checking exact Strategy debit and receiver credit inside `buy` still passes before the helper returns the tokens, and
  `AGENTS.md` independently forbids adding those balance-delta checks to Strategy.
- `nonReentrant` does not help because the return transfer happens sequentially after `buy` completes.
- Waiting for a zero Strategy balance before a later reset does not establish durable removal: the receiver can retain
  the tokens through the check and return them after reset.
- Ignoring or redirecting returned balances requires distinguishing fungible direct donations from Resonance revenue,
  changes Strategy's documented complete-balance behavior, and can create stuck or reclassified USDG.

## Required design decision

There is no receiver-identity-only fix. The smallest robust mitigation class is an economically meaningful,
nonrefundable payment for every zero-to-positive epoch reset. Making `minimumPrice` a fill-time floor is the smallest
code change in that class, but `AGENTS.md` and ADR 0054 explicitly say `minimumPrice` is not a fill-time floor and that
a free fill restarts the next epoch at the floor. It would also trade the current zero-price clearance path for a risk
that inventory remains unsold below the floor. A separate zero-fill reset fee or a redesigned zero-fill state machine
changes the same economic contract and adds more state or configuration.

Production remediation therefore requires an ADR selecting new auction economics, or an explicit accepted-risk ADR
that retains the current behavior. Rejecting only self-receipt must not receive fix or convergence credit. No production
Solidity was changed during either validation.
