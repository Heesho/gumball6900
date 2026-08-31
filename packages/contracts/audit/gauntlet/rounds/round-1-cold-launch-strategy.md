# Round 1 cold review: launcher, Strategy, deployment, and MEV

Target: `70091b642006f0b2788bd89a6a0e734a632619cf`

Reviewer independence: the reviewer read `AGENTS.md` and the audit playbook, did not inspect prior finding records,
and made no edits.

## Candidate SECURITY-01: Strategy zero-price inventory round-trip epoch-reset grief

Provisional severity: Medium. Mechanics confidence: high. Severity confidence: medium.

The cold review first observed that `Strategy.buy` accepts the Strategy itself as `revenueReceiver`. Under a standard
ERC-20, transferring USDG from the Strategy to itself leaves the complete balance in place, but the successful call
advances `epochId`, resets `epochStartedAt`, and raises the next starting price to at least `minimumPrice`. At full
decay any caller can compose that self-transfer with a zero-payment fill and repeat it after each epoch, or front-run
another zero-price fill, without holding or approving the payment token. A buyer willing to pay the reset price can
still clear the inventory, so the candidate is repeatable delay rather than an absolute freeze.

Subsequent independent validation strengthened the candidate beyond the self-transfer special case. A non-Strategy
helper can receive the inventory, wait for `buy` to return, and transfer the inventory back in the same outer
transaction. It is both buyer and receiver, so rejecting the Strategy address or requiring caller-equals-receiver does
not change the final state or cost. The root issue is a zero-cost transition from a mature zero-price auction with
inventory to a newly reset positive-price auction holding the same or more inventory.

Primary evidence:

- `packages/contracts/src/core/Strategy.sol:151-199`
- `packages/contracts/test/minimal/Strategy.t.sol:283-297`
- `packages/contracts/test/minimal/Strategy.t.sol:501-512`
- `packages/contracts/test/minimal/audit-exitability/reproductions/StrategySelfReceiverGrief.t.sol:9-16`
- `packages/contracts/test/minimal/audit-exitability/reproductions/StrategySelfReceiverGrief.t.sol:28-132`
- `packages/sdk/src/actions.ts:294-320`

The pre-gauntlet tests intentionally proved self-receipt and free fill separately, but did not compose or repeat them
and did not assert that a successful purchase durably drains the snapshotted inventory. The completed reproduction now
covers both eight repeated self-receiver resets, including after the revenue stream ends, and three repeated atomic
helper receive-and-return resets.

Candidate status: confirmed Medium; production design decision and ADR pending. The previously proposed
`revenueReceiver != address(this)` check is explicitly rejected as incomplete and receives no fix or convergence
credit. Receiver identity, caller identity, code-size checks, in-call balance deltas, and `nonReentrant` do not prevent
the post-return transfer. The smallest robust mitigation class requires an economically meaningful nonrefundable
payment for every zero-to-positive reset, but that changes the free-fill and next-epoch-floor behavior explicitly
required by `AGENTS.md` and ADR 0054. No production fix is credited.

The reviewer did not elevate the documented post-launch ownership-acceptance window or deterministic-pair precreation
race; both remain explicit deployment gates and accepted operational risks rather than undisclosed runtime findings.
