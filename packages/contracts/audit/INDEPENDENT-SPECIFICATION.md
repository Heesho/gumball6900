# Independent adversarial specification

Date: 2026-08-09

This specification was derived from current production Solidity, executable tests, generated interfaces, independent
economic models, accepted ADRs, deployment policy, and consumer behavior before deciding whether any new finding
required a code change. It intentionally does not treat prose in the historical audit brief as authority where ADR
0021 or ADR 0022 records a newer explicit owner decision.

## Trust and authority model

- Core deployments are direct and non-upgradeable. No proxy, pause, rescue, successor, migration, arbitrary call, or
  conventional DAO exists.
- `Fund` and `LiquidityPosition` are ownerless.
- After one-time setup, Resonance is the only owner-gated protocol contract. Its ongoing surface is `addStrategy`,
  `killStrategy`, and `addBribeReward`.
- Resonance is intended to be owned by an OpenZeppelin `TimelockController`. Deployment evidence must independently
  prove the delay, proposer/canceller/executor/default-admin roles, bindings, constructor arguments, external code,
  PoolKey, position token ID, and final custody.
- SignalGBX and both factories have one-time binding authority. GBX has one permanent minter handoff to Fundraiser.
  Incorrect setup is unrecoverable by design.

## GBX and Fundraiser

- GBX lifetime minting is cumulatively capped at `1_000_000_000 ether`. Burning never restores capacity and
  `totalSupply == lifetimeMinted - lifetimeBurned`.
- Exactly `20_000_000 ether` is minted for genesis liquidity. The remaining `980_000_000 ether` lifetime capacity is
  assigned permanently to Fundraiser by the one-time minter handoff.
- Fundraiser uses the fixed daily sequential-floor curve: initial emission
  `465152.749681042811702004 GBX`, daily decay `0.999525354337060160`, and 1,460-day half-life.
- Settlement is sequential and bounded. Empty ended epochs advance the curve and forfeit their emission without carry.
- Valid USDG contributions require exact payer debit and ResonanceRouter credit. Failed routing or unsupported token
  behavior reverts the complete contribution. Claims cannot exceed the settled pro-rata emission.

## Signal and revenue accounting

- SignalGBX is minted one-for-one only after exact GBX receipt and is non-transferable between nonzero accounts.
- A user may incrementally add or remove an absolute amount for one Strategy or a caller-bounded batch. Allocated
  SignalGBX is reserved; unallocated SignalGBX can be unstaked immediately.
- New signal cannot enter a killed Strategy. Existing signal can always be removed from it. Signal removal and unstake
  do not transfer USDG or reward tokens and therefore do not depend on their transfer success.
- Account, Strategy, total, and Bribe virtual-supply identities must remain equal after every operation. Idle SignalGBX
  contributes no weight, directs no revenue, earns no reward, and does not dilute active signalers.
- Every exact USDG unit entering Resonance is represented by scaled carry, indexed live-Strategy value, a user/Strategy
  liability, or an immutable Fund-bound liability. Checkpoint order, signal churn, Strategy death, zero signal, and
  tiny notifications may change allocation timing but may not create or destroy represented value. A-09 shows that
  conservation alone does not preserve the intended historical beneficiary across a denominator change.
- Fixed Fund liabilities are permissionlessly payable only to the immutable Fund. A failed transfer preserves the
  liability and cannot block signal exit or unrelated Strategy accounting.

## Uniform Strategy settlement

- There is one Strategy type. It auctions its complete current USDG balance using the bounded reverse Dutch mechanism.
- The payment token, epoch duration, multiplier, minimum price, initial price, Resonance, paired BribeRouter, and Fund
  destination are immutable for that Strategy graph.
- A successful fill requires the expected epoch, a live deadline, maximum-payment protection, exact payment-token
  debit/receipt, and atomic delivery of the snapshotted USDG lot to the chosen receiver.
- The complete nonzero payment is pulled exactly once into the paired BribeRouter and classified as a 100% fixed Fund
  liability. Settlement never funds Bribe and never burns GBX automatically.
- GBX is not a distinct Strategy kind. Once a GBX liability is paid to Fund, anyone may call `Fund.burnGBX`. A user who
  wants the maintained post-burn redemption denominator must settle pending GBX and burn Fund-held GBX before redeeming.
- Reverse-Dutch late-fill floor ratcheting and zero-price fills are accepted product behavior, not hidden oracle/NAV
  guarantees.

## Bribe and BribeRouter

- Each Strategy graph has one BribeRouter and Bribe. Only the immutable Strategy can route its settlement payment, and
  only Resonance can modify Bribe virtual balances or register reward tokens.
- A Bribe supports at most eight append-only reward tokens. The immutable cap cannot be raised by governance.
- Bribe rewards are independently notified; Strategy settlement supplies none. Each notification requires exact token
  receipt and every supported unit is represented by stream value, exact rate remainder, queued value, index/user carry,
  accrued user value, or Fund-bound value.
- Active stream time pauses at zero virtual supply. A future signaler cannot steal a zero-supply interval. Replacement
  notifications queue rather than erasing an active stream or earned liability.
- Claiming may be scalar or caller-selected. A broken token cannot block a healthy selected claim or signal removal.
  Failed transfer preserves the affected claim. Permissionless claim triggers cannot redirect the entitled account.
- BribeRouter settlement liabilities and no-signal Bribe liabilities have fixed immutable Fund destinations. Failed
  payout remains retryable; no fallback receiver or sweep authority exists.

## Fund redemption

- Fund is a permissionless raw-token treasury, not a curated registry. Any ERC-20 sent to it may become backing, while
  official protocol membership is represented by Resonance Strategies.
- Redemption is non-reentrant, unpausable, and caller-selected. The array must be nonempty, unique in any order, and
  contain neither zero nor GBX. Duplicate detection uses operation-namespaced EIP-1153 transient storage and clears
  successful marks so multiple calls in one transaction remain independent.
- For each selected token the payout is
  `floor(preBurnFundBalance * gbxAmount / preBurnTotalSupply)`. All balances and the single supply denominator are
  snapshotted before GBX is transferred and burned.
- The GBX transfer/burn and every selected transfer are atomic. Exact Fund debit and receiver credit are required for
  supported tokens. Omitted assets remain for the post-redemption supply and the redeemer permanently forfeits them.
- `burnGBX` burns only GBX already held by Fund, can be called by anyone, and cannot burn another account's GBX.

## Genesis liquidity

- LiquidityPosition accepts only the precommitted PositionManager NFT from the expected depositor and token ID after
  validating exact GBX/USDG ordering, hookless PoolKey, fee, tick spacing, ticks, ownership, and nonzero liquidity.
- The NFT can never leave through production code. There is no principal decrease, arbitrary manager call, owner,
  successor, recovery, migration, or approval redirection path.
- Anyone may harvest accrued fees by invoking a zero-liquidity decrease. The caller supplies no tokens and receives no
  bounty. A successful call leaves principal liquidity exactly unchanged.
- Every resulting USDG unit routes through ResonanceRouter into Resonance. Every resulting GBX unit transfers to Fund
  and burns in the same atomic transaction. Direct canonical-token donations follow the same destinations.
- Manager, route, transfer, burn, or postcondition failure rolls back the complete harvest. The removed caller-funded
  increase resolves A-06; no oracle, swap, keeper, fee split, or governance parameter is introduced.

## Integration and release properties

- Foundry and Hardhat compile the one Solidity tree with exact compiler/config parity. Generated SDK and subgraph ABIs
  must match current artifacts.
- SDK math/actions/readers, subgraph mappings, simulations, and frontend wording must implement the uniform Strategy
  model. No consumer may expose Strategy kinds, auction-funded Bribe splits, `bribeBps`, or automatic buyback burn.
- Frontend writes remain disabled for incomplete or wrong-chain deployment state and must not treat an indexer as an
  authorization source.
- Provisional deployment records cannot authorize transactions. CI and validation must not broadcast mainnet calls.
- A green internal campaign does not clear the independent-audit, monitored-testnet, signed-manifest, licensing,
  provenance, regulatory, or external dependency review gates.

## Superseded brief requirements

| Historical requirement                                              | Current disposition                                                           |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Acquisition and buyback Strategy kinds                              | Superseded by ADR 0021; one uniform Strategy type.                            |
| 90/10 acquisition split and governed `bribeBps`                     | Superseded; 100% of every payment is a fixed Fund liability.                  |
| Canonical payment token automatically registered as a Bribe reward  | Superseded; reward registration/funding is independent.                       |
| Buyback requires GBX and burns atomically                           | Superseded; GBX follows uniform settlement and may be burned later from Fund. |
| `setBribeBps` as ongoing Resonance authority                        | Superseded and removed; ongoing surface has three methods.                    |
| Buyback/acquisition subgraph, SDK, frontend, and model distinctions | Superseded; consumers must expose the uniform payment-liability model.        |
| Fixed 20-bps LP compounding and caller ownership of fees            | Superseded by ADR 0022; fixed principal, routed USDG, and burned GBX.         |

These rows are not silently omitted from the review: their old selectors and concepts must remain absent, and current
GBX settlement/burn ordering receives adversarial coverage under the accepted replacement design.
