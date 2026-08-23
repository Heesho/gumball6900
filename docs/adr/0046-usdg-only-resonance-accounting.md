# ADR 0046: Specialize Resonance to USDG-only accounting

- Status: partially superseded by ADR 0047: scalar USDG-only state remains, while exact raw scheduling does not; not
  audited, deployed, or approved for user funds
- Date: 2026-08-23
- Supersedes: ADR 0029's retained Bribe-shaped multi-token storage and view ABI inside Resonance
- Preserves: ADR 0029's seven-day schedule, `1e36` index, checkpoint ordering, accepted surplus, and Strategy lifecycle;
  ADR 0047 governs the schedule arithmetic

[ADR 0048](0048-expand-bribe-rewards-and-compose-signal-moves.md) later raises Bribe's separate historical
eight-token cap to sixteen; that does not alter this ADR's USDG-only Resonance specialization.

## Context

ADR 0029 adapted Resonance from a multi-token Bribe rewarder. Although Resonance permanently accepted only USDG, it
retained a token registry, token-keyed reward schedule, nested Strategy-by-token accounting, and token parameters on
every reward view. No state transition could register a second Resonance reward token, so all non-USDG keys were
unreachable zero-value branches rather than protocol capability.

Keeping that upstream shape reduced the initial adaptation distance, but it made the final contract and ABI imply a
multi-token extension point that the protocol does not support. It also required an extra mapping key on every schedule
and per-Strategy reward access and a constructor write for a permanently single-element registry.

## Decision

Resonance is specialized to one immutable USDG reward stream. It stores:

```text
Reward rewardData
mapping(address strategy => uint256 paid) strategyRewardPerTokenPaid
mapping(address strategy => uint256 reward) strategyRewards
```

The `token_RewardData`, `token_IsReward`, `rewardTokens`, `account_Token_RewardPerTokenPaid`, and
`account_Token_Rewards` fields are removed. The permanently single-element `getRewardTokens` view is also removed.

Because every affected view can refer only to USDG, `lastTimeRewardApplicable`, `rewardPerToken`, `left`, and
`getRewardForDuration` take no token argument, while `earned` takes only the Strategy address. `ICoreResonance.left`
and `ResonanceRouter.route` use the same tokenless boundary. Bribe remains independently multi-token and retains its
complete registry, token-keyed accounting, fixed eight-token cap, and selective reward operations.

The scalar specialization changes neither reward arithmetic nor execution order. Notifications still pull exact USDG,
checkpoint elapsed emission, require the new amount to cover the exact active remainder, and restart the combined
amount for seven days. Signal mutations and Strategy death retain their prior checkpoints, and distribution still pays
only the entitled Strategy.

## Consequences

- The Resonance storage model and ABI now encode the actual one-token invariant instead of documenting unreachable
  non-USDG branches.
- Schedule and Strategy reward accesses use fewer mapping keys, and deployment no longer writes a redundant token
  registry.
- Resonance intentionally diverges further from the upstream Bribe shape. Differential tests remain required to prove
  unchanged USDG scheduling, index, checkpoint, and payout behavior.
- This is an ABI-breaking change across Resonance, `ICoreResonance`, ResonanceRouter callers, the SDK, and generated
  subgraph artifacts. No migration or compatibility shim is added because the protocol is not deployed and the core is
  non-upgradeable.
- Bribe multi-token rewards are unaffected. `Resonance.addBribeReward` remains one of the four continuing owner actions.
- This decision does not authorize deployment or use with user funds.
