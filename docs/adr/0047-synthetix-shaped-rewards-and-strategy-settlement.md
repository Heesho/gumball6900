# ADR 0047: Restore Synthetix-shaped rewards and Strategy settlement

- Status: accepted for development and partially superseded by ADR 0048 where it preserves the historical eight-token
  Bribe cap; not audited, deployed, or approved for user funds
- Date: 2026-08-23
- Supersedes: ADR 0020's Bribe exact-carry, queue, pause, Fund-liability, and selected-batch-claim decisions; ADR 0021's
  deferred Strategy-to-Fund settlement; ADR 0026's exact raw-unit successor scheduling; ADR 0027; ADR 0028's
  queue-created terminal-lock analysis; ADR 0032's deferred dual-liability and exact split-carry rules; ADR 0036's
  exact weighted split carry and deferred settlement; and ADR 0046's preservation of exact Resonance scheduling
- Preserves: USDG-only scalar Resonance accounting, the global bounded `bribeBps`, virtual Bribe balances, the fixed
  eight-token Bribe cap, the `1e36` Bribe index, the lifetime-notification cap, and deferred Bribe notification

[ADR 0048](0048-expand-bribe-rewards-and-compose-signal-moves.md) later changes that preserved cap from eight to
sixteen and removes Resonance's dedicated move hook. The decision body below records the ADR-0047 state historically.

## Context

The core was selected as a minimal adaptation of Synthetix staking rewards and Liquid Signal Governance. Successive
development decisions then made every raw and scaled rounding remainder explicit, paused and queued reward streams,
classified sub-token carry to Fund, rejected nonstandard token balance behavior, and moved complete Strategy payments
into BribeRouter so Fund and Bribe settlement could fail independently.

Those mechanisms are internally coherent, but they replace the upstream reward engine with a substantially larger
accounting system. The added state and transitions make the contracts harder to review and reduce the assurance gained
from retaining a long-used upstream shape. The protocol is not deployed, so compatibility with the development ABI is
not a reason to preserve that complexity.

## Decision

### Supported token behavior

Core accounting supports standard, non-rebasing ERC-20 tokens whose successful transfer moves the requested amount.
Fee-on-transfer, rebasing, receiver-blocking, and otherwise mutable transfer semantics are unsupported. Governance is
responsible for registering only suitable Strategy payment and independent Bribe reward tokens. Contracts use
`SafeERC20` but do not duplicate balances before and after each transfer.

### Resonance reward stream

Resonance remains permanently USDG-only and scalar. Its reward state returns to the Synthetix shape:

```text
Reward {
  periodFinish
  rewardRate
  lastUpdateTime
  rewardPerTokenStored
}
```

Elapsed rewards use `elapsed * rewardRate`; there is no front-loaded raw-unit remainder. A notification during an
active stream rolls `remainingSeconds * rewardRate` into the new amount and starts a fresh seven-day period. Rate,
global-index, and per-Strategy division floors remain unallocated USDG surplus. Time continues while active signal
supply is zero, and the corresponding USDG is not later allocated.

ResonanceRouter buffers USDG until the complete balance is at least one raw unit per stream second and, during an
active stream, at least the scheduled amount left. It then forwards the complete balance. This prevents a zero-rate
schedule while preserving the simple permissionless Router boundary.

The `1e36` Resonance reward-per-signal index remains because USDG uses six decimals and signal uses eighteen.

### Bribe reward streams

Each Bribe follows the Liquid Signal/Synthetix cumulative-index engine:

- Resonance controls virtual `deposit` and `withdraw` balances.
- At most eight append-only reward tokens may be registered.
- Each token has one seven-day `periodFinish`, `rewardRate`, `lastUpdateTime`, and stored reward-per-signal index.
- Notifications are permissionless but must be at least `DURATION` raw units and at least the current `left` amount.
  A valid notification combines with the ordinary Synthetix leftover and restarts the period.
- Reward time does not pause at zero supply. Notifications are not queued.
- Rate, index, and account floors remain unallocated token surplus. There are no global, account, or Fund carry
  buckets and no Fund reward liability.
- The `1e36` index and monotonic lifetime raw-notification cap remain to support low-decimal rewards without allowing
  cumulative index overflow to block mandatory signal checkpoints.
- The normal all-token claim remains. One scalar-token claim is retained so a failed token transfer need not block an
  unrelated reward. Caller-selected batch claims are periphery, not core.

### Strategy payment settlement

Strategy again classifies the acquired payment itself. Before interacting with the payment token it snapshots the
current global `Resonance.bribeBps`, then for payment `a` and rate `r` computes:

```text
bribeAmount = floor(a * r / 10,000)
fundAmount = a - bribeAmount
```

Strategy pulls the payment, transfers `fundAmount` directly to the immutable Fund, and transfers any nonzero
`bribeAmount` to its paired BribeRouter. There is no cumulative split remainder and no deferred Fund liability. A
successful purchase is therefore atomic with Fund receipt.

BribeRouter returns to a small Bribe-only buffer. Its permissionless `distribute` function uses the complete payment
token balance and notifies the paired Bribe only when the balance satisfies the Bribe notification thresholds. Bribe
notification failure leaves the buffered tokens in BribeRouter without reverting the already completed Strategy
purchase. Direct compatible-token donations to BribeRouter join the next notification.

The global `bribeBps` setter and its zero-through-20% bound remain. Rate changes affect later Strategy purchases only.

## Accepted consequences

- Integer-division dust and reward time elapsed at zero signal supply remain as unallocated contract balances.
- Payment partitioning can change cumulative classification by sub-token rounding units; no state is retained to make
  the split frequency-independent.
- A failed direct Strategy-to-Fund transfer reverts the complete purchase.
- Unsupported token mechanics may revert, underfund, or otherwise make a registered market unusable; the core does
  not add recovery, alternate destinations, or token-specific adapters.
- The smaller state machine and closer upstream correspondence are preferred over exact raw-unit conservation and
  recipient-specific settlement liveness.
- The ABI change is intentional and receives no migration shim because the protocol is not deployed.
- This decision requires coordinated Solidity, tests, models, SDK, subgraph, documentation, and audit-harness updates.
  Local green checks remain engineering evidence, not audit or deployment approval.
