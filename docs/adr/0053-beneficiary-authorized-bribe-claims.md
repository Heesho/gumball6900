# ADR 0053: Beneficiary-authorized Bribe claims and Resonance batching

- Status: Remediated and internally verified in the working tree; independent closure, deployment authorization, and
  user-fund authorization remain pending.
- Date: 2026-08-30
- Supersedes: ADR 0047's requirement that caller-selected cross-Bribe claim batching remain outside the core
- Preserves: ordinary Bribe account-floor semantics, the bounded all-token claim, the scalar-token broken-token
  fallback, immutable Resonance/Bribe pairings, killed-Strategy reward claims, and caller-controlled batch sizing

## Context

Each Bribe converts a beneficiary's scaled index delta into whole raw reward-token units. The conversion intentionally
floors and retains no per-account fractional carry. Before this ADR, `claimReward(account, token)` and
`claimRewards(account)` allowed any caller to choose the beneficiary's checkpoint time. An outsider could therefore
checkpoint a small position whenever its new entitlement was below one raw unit, advance the beneficiary's paid index,
and repeatedly prevent those fractions from combining into a later payable unit. CEX-02/V12-249705 reproduced this
economic griefing through public functions. The caller receives nothing, but the beneficiary's discarded entitlement
becomes unallocated Bribe surplus.

Making claims beneficiary-only removes that attacker-selected cadence without introducing carry accounting. It also
removes direct keeper or relayer claims for an externally owned account. Users still need a practical way to claim
across several paired Bribes in one transaction. A generic external Router cannot satisfy a beneficiary-only Bribe
check because the Bribe would observe the Router as `msg.sender`. Each Bribe already trusts exactly one immutable
Resonance for signal coordination, and Resonance owns the canonical Strategy-to-Bribe mapping.

## Decision

### Bribe authorization

Bribe preserves its existing selectors:

```solidity
function claimRewards(address account) external;
function claimReward(address account, address rewardToken) external returns (uint256 amount);
```

Both functions authorize only:

```text
msg.sender == account || msg.sender == resonance
```

Every other caller reverts with `UnauthorizedClaimCaller(caller, account)` before the beneficiary's reward checkpoint
or entitlement changes. The immutable Resonance exception is narrow: it cannot be reassigned, and Bribe still always
pays the supplied beneficiary rather than the caller. Direct EOA, Safe, ERC-4337, and other smart-account self-claims
remain valid because the account itself is `msg.sender` at Bribe.

### Resonance cross-Bribe batch

Resonance adds:

```solidity
function claimBribeRewards(address[] calldata strategies) external;
```

The beneficiary is always `msg.sender`; the function accepts no separate account or receiver. For each caller-supplied
Strategy, Resonance requires `isStrategyRegistered[strategy]`, resolves the canonical `bribeFor[strategy]`, and invokes
that Bribe's all-token `claimRewards(msg.sender)`. Registered killed Strategies remain valid because killing a Strategy
does not erase incumbent Bribe rewards. An unregistered entry reverts with the existing `StrategyNotFound(strategy)`.

An empty array reverts with `EmptyClaimBatch()`. Duplicates are allowed and execute sequentially. Batch length is
caller-controlled and has no protocol cap; interfaces should simulate and split arrays that do not fit available gas.
The complete batch is atomic, so an invalid Strategy or failed reward-token transfer reverts every earlier claim in the
same call.

### Required fallbacks

The batch is optional convenience, not the only claim path. A beneficiary may always call one Bribe directly. Within
that Bribe, `claimReward(account, token)` remains the scalar-token fallback: a broken registered token can revert an
all-token or cross-Bribe batch, but it cannot block the beneficiary from claiming a healthy token directly. No signal
addition, signal removal, or GBX principal exit depends on any reward claim or reward-token transfer.

## Security and liveness consequences

- An unrelated caller can no longer advance another beneficiary's Bribe paid index, closing the reproduced CEX-02
  checkpoint-cadence griefing path without adding fractional carry state.
- Resonance may call only for the external batch caller. It is not a generic claim operator and cannot redirect rewards.
- Direct keeper/relayer claims for an EOA disappear. Account-native batching or sponsored smart-account execution
  remains compatible because the account is still the onchain caller.
- A cross-Bribe batch performs caller-controlled linear work, with a bounded loop of at most sixteen reward tokens
  inside each named Bribe. Duplicate Strategies may waste gas, and a sufficiently large batch may exceed the block gas
  limit.
- One broken token makes the all-token cross-Bribe batch revert atomically. Direct scalar claims preserve healthy-token
  realization, including for positions in killed Strategies.
- Existing ordinary account floors remain. A beneficiary can still choose a frequent self-checkpoint cadence that
  discards its own fractions, and signal changes may checkpoint Bribe accounting under the accepted no-carry model.

## Delivery and review boundary

This is a core ABI, authorization, integration, documentation, test, and audit-scope change. Regression coverage verifies
outsider rejection before checkpoint mutation; direct EOA and contract-wallet self-claims; Resonance batches across live
and killed Strategies; empty, unregistered, duplicate, and large caller-supplied arrays; atomic rollback on a broken
reward token; and direct scalar healthy-token isolation. Generated ABI consumers were rebuilt from compiler artifacts
rather than hand edited.

Internal verification recorded in the audit bundle includes 367/367 Foundry tests across 29 suites;
`ProtocolInvariantsTest` passed 32/32 total tests, comprising 30 invariant properties at 1,000 runs × 500 depth
(500,000 handler calls per property) plus two deterministic reachability tests. The invariant campaign reached 31/31
selectors with zero reverts/discards; Hardhat 4/4 with bytecode parity; the 10/10 integration campaign at 256 fuzz runs; gas and atomic
rollback coverage for direct and caller-sized batched claims; a corrected 70/70 test-killed mutation campaign; and the
applicable SDK, subgraph, documentation, simulation, web, lint, typecheck, and build checks. Exact receipts and remaining
limitations are recorded in
`packages/contracts/audit/codex-exitability-2026-08-29-f991253/TEST-EVIDENCE.md` E-16.

The V12 export reviewed `3ae171b997254b56602298d873b3918d1575b3c7` and the internal CEX-02 reproduction targeted
the permissionless starting behavior. Neither independently reviews or closes this remediation. The final root
`pnpm test` rerun passed 9/9 Turbo tasks; the unrelated repository-wide formatting blockers and fresh independent review
remain open. No deployment or user-fund authorization follows from the internal pass.
