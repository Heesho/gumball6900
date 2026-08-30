# Independent adversarial specification

Date: 2026-08-15. Reconciled 2026-08-30 through ADR 0055.

This is the current review target for the unsuperseded portions of ADRs 0028, 0029, 0031, 0033-0055 in the
development candidate. ADRs 0051-0055 are outside the received V12 scope at `3ae171b`. This is not an independent
audit result.

## Authority model

- Deployments are direct and non-upgradeable. Fund is ownerless.
- Mine and Resonance are the only core contracts with continuing custom owner authority and both use `Ownable2Step`.
  Mine's owner may only set a structurally validated Router for future protocol revenue. Resonance's owner may add/kill
  Strategies, register Bribe rewards, or set the one global prospective Bribe share from 0 through 2,000 basis points.
  Resonance's separate setup-only Router binding is consumed before handoff and cannot later be replaced or cleared.
  Both may begin two-step ownership transfers, replace or cancel them before acceptance, or immediately renounce.
  SignalGBX and both factories retain setup-only plain-`Ownable` shells after their one-time bindings, with no remaining
  custom owner action.
- The core contains no Governor, protocol Timelock, generic executor, or provider-specific governance adapter.
  SignalGBX retains ERC20Votes checkpoints for a future external integration, but the core assigns them no proposal,
  quorum, execution, delay, or cancellation semantics.
- External governance is unselected. Production requires a separately reviewed integration, renunciation of the three
  consumed setup-only ownership shells, launch-time pending ownership of Mine and Resonance, and later acceptance of
  both by the exact executor, with no surviving usable temporary setup authority.
- The canonical `GBXLauncher` is callable once only by its immutable authority. Four public stateless deployers retain
  no state or authority; their outputs are canonical only when created and consumed by that launch transaction. A
  successful launch clears Mine's genesis authority, renounces the three setup-only owners, and makes the supplied
  contract `finalOwner` pending owner of Mine and Resonance. Governance must accept both after launch. The single-use
  launcher retains formal ownership until then but exposes no post-launch path that can exercise it.
- No authority can change the fixed slot count, reprice an occupied slot, replace the GBX minter, set emissions,
  migrate balances or positions, pause, rescue, sweep, or move Fund assets.

## GBX and Mine

- GBX starts with zero supply and permanently binds its only lifetime issuer to one deployed Mine whose reciprocal
  `gbx()` identity matches. Its setup minter cannot mint before that handoff.
- Supply reconciles as `lifetimeMinted - lifetimeBurned` and has no protocol-defined economic maximum. GBX retains
  ERC20Permit for general integrations but has no voting checkpoints; SignalGBX exposes the core's only IVotes
  checkpoints for a future external governance integration.
- Mine may issue exactly `1,000 ether` GBX once through its deployment-only `genesisAuthority`, only after reciprocal
  binding and only to a contract. The canonical launcher directs it to the validated Pair, consumes the flag, and
  clears the authority. `Mine.totalMined()` excludes genesis, so `lifetimeMinted` equals settled mining plus the fixed
  amount iff the genesis flag is consumed.
- Mine has exactly sixteen permanent slots from construction.
- Each slot price decays linearly to zero over one hour. Epoch ID, deadline, and maximum payment protect replacements.
- A replacement settles only the outgoing tenure in its selected slot. Each tenure receives `elapsed * slot.tps`, and
  `slot.tps` is never recomputed.
- The incoming tenure receives `globalTps(now - startTime) / 16`.
- `aggregateTps`, `storedPendingEmission`, and `pendingUpdatedAt` make total pending emission and effective supply
  constant-time without iterating or mutating all slots.
- Future-tenure global rates halve at immutable intervals measured from Mine deployment and stop falling at a positive tail.
- A nonempty price splits into an 80% outgoing tenure miner pull claim plus a 20% nominal deposit into
  ResonanceRouter. An empty slot deposits 100%.
- Mine uses `SafeERC20` without balance-delta checks and trusts canonical USDG to move requested amounts. Mine retains
  only outstanding claims, claims cannot be redirected, and `RevenueDeposited` records the nominal protocol share
  requested into ResonanceRouter.
- Mine never calls `ResonanceRouter.route()`. Routing is a later permissionless action with no caller role, bounty, or
  liveness guarantee. A failed Router deposit can revert a paid replacement; later Router or Resonance failure cannot.
- Mine stores immutable GBX, USDG, and Fund identities. `setResonanceRouter` rejects the current Router and accepts a
  candidate only when it reports Mine's USDG and points to a deployed Resonance that reciprocally reports that Router,
  USDG, and Fund and uses a SignalGBX that reciprocally reports that Resonance and Mine's GBX. Getter consistency does
  not authenticate bytecode.
- A Router update changes only future Mine deposits. Old Router balances, Resonance schedules, Strategy claims, Bribe
  rewards, and signal positions remain in the old graph. Users claim and unsignal there before optionally signaling
  returned GBX into the new graph; the switch cannot rescue an already broken old exit path. The replacement has a new
  SignalGBX address; Mine neither migrates checkpoints nor reconfigures external governance.

## Signals, Strategies, and Bribes

- SignalGBX mints and burns one-for-one, is non-transferable, and accepts GBX only after reciprocal Resonance binding.
  Every mint atomically adds the same signal to live Strategies, and every burn atomically removes signal and returns
  the same GBX. Its supply is fully backed; unsolicited GBX is stranded surplus rather than token issuance. It retains
  ERC20Votes but not ERC20Permit and consumes no underlying permit signature.
- SignalGBX is the sole user-facing signal coordinator. Its balance is each account's aggregate signal. Scalar
  `addSignal`/`removeSignal` remain bounded; `addSignalMany`/`removeSignalMany` optionally aggregate custody and loop
  over caller-supplied allocations atomically. Idle sGBX is unreachable.
- Each paired Bribe owns account-by-Strategy signal weight and total Strategy signal weight. Resonance owns only the
  active global denominator and reads the Bribe's canonical `signalWeightOf` and `totalSignalWeight` values. A killed
  Strategy is excluded immediately while its Bribe weights remain recorded for exit.
- Resonance remains solvent for its scheduled balance and Strategy claims. Per-index and per-Strategy floors,
  zero-active-signal emission, and direct donations are intentionally unclassified surplus rather than Fund
  liabilities.
- The canonical launcher requires its immutable USDG to report six decimals at construction and launch. Resonance, its
  Router, Mine, and Strategy still account only in raw units and neither read nor normalize token decimals.
- Resonance stores one scalar four-field USDG schedule in `revenueData`: `periodFinish`, `revenueRate`,
  `lastUpdateTime`, and `revenuePerSignalStored`. It streams at `1e36` index precision using the ordinary whole-unit
  rate. A qualifying top-up
  checkpoints old weights, combines the new amount with `remainingRevenue()`, and restarts seven days; the rate remainder stays
  unallocated USDG surplus rather than being front-loaded.
- Resonance accepts at most `floor((2^256 - 1) / 1e36)` fresh raw USDG units over its complete lifetime. The monotonic
  counter excludes direct donations and does not recount rolled-over remaining revenue. Cap rejection precedes
  checkpointing and token interaction, preserving existing signal exits while leaving later USDG buffered in Router.
- ResonanceRouter retains its complete balance below
  `max(REWARD_DURATION, Resonance.remainingRevenue())` and notifies the complete balance once it qualifies. A
  sub-`REWARD_DURATION` balance needs another deposit even after the old stream ends.
- A qualifying Router balance does not execute itself and may wait indefinitely until a manual, frontend, volunteer-
  keeper, or cron caller invokes `route()`.
- Killing a Strategy checkpoints and preserves its accrued claim, excludes its full weight from future Resonance
  revenue, blocks later signal additions, and leaves incumbent signalers free to exit without decrementing the active
  total twice. Its paired Bribe remains independently fundable.
- SignalGBX exposes no public move and Resonance exposes no dedicated move hook. Each retained add/remove hook
  checkpoints its Strategy before its own weight mutation. Smart wallets may compose direct calls atomically; a shared
  write Router is forbidden because it would become the signal owner under `msg.sender` semantics.
- One uniform Strategy type checkpoints and pulls released revenue before auctioning its complete USDG lot. Each
  payment snapshots Resonance's current global Bribe rate; the Fund rate is its complement and no Strategy override
  exists. For each purchase `a` at its snapshotted rate `r`, Strategy computes
  `bribeAmount = floor(a * r / 10_000)` and `fundAmount = a - bribeAmount`. No split remainder crosses purchases.
- Strategy pulls the payment, sends `fundAmount` directly to Fund, and transfers a nonzero `bribeAmount` to the paired
  BribeRouter. A failed Fund transfer reverts the purchase. The BribeRouter has no Fund leg or liability ledger; its
  permissionless `route()` notifies the paired Bribe with the complete buffered balance only after satisfying both
  `REWARD_DURATION` and `remainingReward` thresholds. Direct compatible-token Router donations join that notification.
- Bribes remain independently fundable and have at most sixteen registered reward tokens. Each token uses a four-field
  seven-day Synthetix schedule and a `1e36` index. Reward time continues at zero supply; notifications are not queued;
  and rate, index, and account floors remain unallocated Bribe surplus rather than carry or Fund liabilities.
  `claimRewards(account)` is the bounded all-token convenience path, while `claimReward(account, token)` isolates a
  broken token. Each direct claim authorizes only `account` or the Bribe's immutable Resonance and always pays
  `account`. Resonance may batch all-token claims across caller-selected registered live or killed Strategies, but
  always for `msg.sender`; empty arrays and unregistered entries revert, duplicates execute sequentially, and the
  complete caller-controlled batch is atomic. Direct scalar claiming remains the gas and broken-token fallback.
  Neither scalar nor batched signal removal transfers a reward token.
- At a 0% automatic rate, new Strategy payments go entirely to Fund. Existing reward settlement, independent
  notifications, signal additions, removals, and killed-Strategy exit remain unchanged and callable.
- Mine, SignalGBX, Strategy, Resonance, and Bribe use `SafeERC20` under standard canonical or
  registered-token assumptions rather than checking sender and receiver deltas. Fund redemption retains exact payout
  deltas and basket guards because selected assets are arbitrary.

## Fund

- Fund is registry-free and ownerless. Before redemption it validates the permanent Mine and reads its effective supply.
- Every selected token uses one effective pre-burn supply and raw balance snapshot. The burn and
  all exact transfers are atomic. Zero, GBX, and duplicates are rejected with EIP-1153 marks. A basket-wide final
  balance check rejects distinct selected addresses whose transfers consume the same snapshotted backing.
- The continuing core contains no liquidity custodian or liquidity-specific settlement path. The one-shot launcher is
  the deployment exception: on chain ID 4663 it uses the pinned V2 Factory directly, calls `createPair` for the actual
  USDG/GBX tokens, deposits `1e6` raw USDG and `1,000 ether` GBX, and requires exactly `31,622,776,601,683` raw LP, all
  minted to `address(0)`. Any precreated Pair makes launch revert atomically with `PairAlreadyExists` before
  `createPair`; the operator must use a fresh launcher whose caller-scoped GBX address and predicted Pair differ. The
  launcher never adopts or skims an existing Pair.
- Predictable-address USDG prefunding of the launcher, ResonanceRouter, or Resonance cannot veto launch solely through
  a nonzero balance. Launcher-held USDG is forwarded to Fund; preexisting ResonanceRouter and Resonance balances retain
  their ordinary buffer and direct-surplus semantics while launch still requires zero scheduled revenue and pristine
  accounting state. The deterministic future Pair is the exception: any prefunded USDG there makes the exact deposit
  invariant fail and denies that launcher.
- The launcher registers GBX first at `100,000 ether` and the actual LP second at `50 * pair.totalSupply()`, each with
  equal initial/minimum price, a 24-hour epoch, and `1.2e18` multiplier. The first epoch begins at deployment and may
  reach zero before inventory; later Fund-held LP is ordinary caller-selected redemption backing.

## Release properties

- Foundry and Hardhat compile the same Solidity tree; SDK/subgraph ABIs come from current artifacts.
- TypeScript and Python independently assert fixed sixteen-slot tenure, future-tenure halvings, 80/20 payments, the
  no-economic-cap issuance model, effective-supply redemption, qualifying Resonance resets and surplus solvency. The
  Solidity suites cover per-purchase Strategy floors, direct Fund settlement, Router buffering, Synthetix leftover
  rollover, and Bribe surplus floors. The ADR-0048 focused suites passed 104/104 and the revised mutation campaign
  killed 47/47 mutants before ADRs 0049-0051. The post-ADR-0053 internal campaign now verifies the deterministic,
  stateful, integration, gas, corrected mutation, ABI-consumer, and recorded workspace components for the
  beneficiary-authorized claim design; its exact limits are recorded in the audit bundle's E-16. That evidence and the
  later E-17/E-18 launcher evidence predate ADR 0055. E-19 records current internal executable coverage of ADR 0055's
  authority and migration surface, but it is not independent review or formal proof.
- Those E-16 and root-workspace receipts predate ADR 0054. Review must separately prove the fixed mint and
  issuance identities, launcher authority/single use, full rollback, dependency and chain checks, module sizes, Pair
  identity/token ordering, create-only/precreation behavior, predictable component-address prefunding, exact LP lock
  math, initial Strategy configuration, setup-owner removal, and later LP redemption. The pinned pre-ADR-0055 fork
  closes one real Factory/createPair execution case. E-19's fresh fork proves the current launch and two ownership
  acceptances against the recorded USDG/Factory state; it does not exercise a later Router cutover. E-19's local tests
  separately prove Router validation, same-Router rejection, and old/new graph isolation internally. Those results
  still cannot close dependency provenance, selected-governance, signed-manifest, independent-review, or production-
  release gates.
- Pre-ADR-0055 review internally proves signal and Bribe-claim batch rollback, beneficiary authorization, aggregate custody,
  duplicate-entry semantics, killed-Strategy claiming, scalar broken-token fallback, and that historical SignalGBX
  voting checkpoints survive removal. No post-ADR-0053 Medusa, Echidna, static, symbolic, formal, or independent-review
  result is claimed. The final root `pnpm test` rerun passed 9/9 Turbo tasks. A later integration campaign must prove the
  selected external system's token compatibility, permissions, voting, proposal scope, delay, cancellation, execution,
  and both Mine/Resonance ownership handoffs.
- No consumer may display pending Mine accrual as already minted supply or the 80% replacement claim as guaranteed.
- A green local campaign does not clear independent audit, parameter, monitored testnet, manifest, licensing, or legal
  review gates.
