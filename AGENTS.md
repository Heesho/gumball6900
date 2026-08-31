# Repository execution guide

This file governs automated contributors working in this repository. The protocol is not audited, deployed, or
authorized for user funds. A green local build is engineering evidence, never a release or deployment claim.

## Protocol starting point

- Build the core contracts as a minimal adaptation of the pinned give.fun and Liquid Signal Governance contracts.
  Preserve their simple contract boundaries and behavior unless this file or a recorded ADR explicitly changes them.
- Use these protocol names consistently: `GBX`, `Mine`, `SignalGBX`, `ResonanceRouter`, `Resonance`,
  `StrategyFactory`, `Strategy`, `BribeFactory`, `BribeRouter`, `Bribe`, and `Fund`.
- `packages/contracts/src` is the single Solidity source tree shared by Foundry and Hardhat. Core contracts use direct,
  non-upgradeable deployments. `StrategyFactory` and `BribeFactory` are allowed only as Resonance-controlled factories;
  do not add generic public factories, arbitrary vault calls, NAV/price oracles, or governance implementation contracts
  inside the core. Governance is a separately selected and reviewed external integration.
- ADR 0054 permits one GBX-specific, single-use `GBXLauncher` under `packages/contracts/src/launch` and four predeployed
  stateless component deployers solely to fit the complete graph below EIP-170. The modules are public, ownerless, and
  retain no authority over their outputs. Every module uses caller-scoped CREATE2 salts derived from the direct caller
  and a contract-specific domain, so an unrelated public caller cannot consume or shift the launcher's canonical output
  addresses. Unrelated deployments through them are not canonical GBX graphs. This is deployment infrastructure, not a
  generic fund factory or a continuing protocol role. Predictable-address USDG prefunding must not by itself deny the
  launch: forward any USDG already held by the launcher into Fund, and treat USDG already held at the new
  ResonanceRouter or Resonance address under those contracts' ordinary direct-donation semantics. These exceptions do
  not apply to the Pair: the launcher always calls `Factory.createPair`, never adopts or skims an existing Pair, and
  requires exact seed balances and LP output.
- Keep the core protocol surface limited to invariant-, custody-, and accounting-critical actions. Generic frontend
  composition, wallet-level transaction batching, reads, and cron/keeper automation belong in optional periphery and
  must not become a correctness or liveness dependency of a core action. SignalGBX's typed add/remove batches are the
  narrow exception because its custody and caller identity cannot be preserved by a shared write-through Router. A
  future helper may compose `Mine.mine()` with
  `ResonanceRouter.route()`, but no such helper is required now and Mine must remain complete if routing fails.

## Robinhood mainnet demo environment

- ADR 0061 permits a separate, valueless **Robinhood Mainnet Demo** lane under `packages/contracts/src/demo`. It is not
  a testnet, production deployment, release candidate, governance selection, or authorization for user funds. Every
  public surface must say that its mock assets are worthless and interactions spend real ETH for gas.
- The demo reuses the unchanged GBX core, component deployers, and `GBXLauncher` with a six-decimal `mUSDG`. Its
  constructor creates exactly the `1e6` raw genesis seed for the launch authority and its public faucet is unavailable
  before launch. Because the standard token remains transferable, every broadcast preflight must prove the authority
  still holds the exact seed and the predicted Pair is empty. The authority binds one matching launcher; only a
  completed launch with a deployed Pair may permissionlessly and irreversibly enable the fixed self-only faucet. Do not
  add arbitrary-recipient minting or a Pair adoption, cleanup, skim, or recovery path.
- Other demo assets must identify themselves as mock/no-value tokens and may expose only fixed self-only faucets. The
  ownerless `DemoOwner` precommits one through four deployments of the exact compiled `DemoFaucetToken` runtime, then
  permissionlessly accepts both Mine and Resonance ownerships and registers those fixed Strategies in one atomic setup.
  It exposes no continuing administration or generic call surface. A different asset set requires a newly labelled
  demo generation.
- Keep demo plans, artifacts, addresses, start blocks, manifests, subgraphs, and website configuration separate from
  `packages/config/deployments` and the production release gate. Never use a mock receipt as production evidence.

## Revenue, signaling, and acquisitions

- Mining revenue follows `Mine -> current ResonanceRouter -> its Resonance seven-day stream -> Strategy`. On a nonempty-slot
  replacement, 80% of the USDG payment becomes a pull claim for the outgoing tenure miner and Mine transfers the
  nominal 20% remainder into ResonanceRouter. The first occupation of an empty slot deposits 100% into
  ResonanceRouter. There is no team fee.
- Mine never calls `ResonanceRouter.route()` during a replacement. Routing is a separate permissionless manual, frontend,
  keeper, or cron action with no role or bounty and no liveness guarantee; Router revenue may wait indefinitely if
  nobody calls. `Mine.RevenueDeposited` records a successful `SafeERC20` transfer request for the nominal protocol
  share into ResonanceRouter and identifies that Router in the event; under the supported standard USDG model that
  amount reached the Router. It does not mean
  the USDG reached Resonance or entered the seven-day stream in that transaction. A failed transfer into the Router
  still reverts the paid replacement, but later Router or Resonance failure is isolated from Mine.
- Mine is a direct, non-upgradeable `Ownable2Step` contract with exactly one custom owner action:
  `setResonanceRouter`. The setter changes only where future protocol-share deposits go. It must reject the current
  Router and validate that the deployed candidate reports Mine's immutable USDG, points to a deployed Resonance that
  reciprocally identifies the candidate Router, same USDG, and Mine's immutable Fund, and uses a SignalGBX that
  identifies Mine's immutable GBX and reciprocally identifies that Resonance. These reciprocal getters prove
  consistency, not honest bytecode. Do not add a balance sweep, state copy, forced signal move, claim redirect, pause,
  emissions control, or call into the old graph. Governance must deploy and bind the complete replacement graph first
  and switch Mine last.
- GBX starts with zero supply and zero lifetime minted when its constructor returns. Its temporary setup minter cannot
  mint; deployment permanently hands its sole mint authority to one deployed `Mine`, after which Mine is the only
  lifetime issuer. The handover is one-time and cannot be replaced or reopened. Mine may be constructed with a zero
  `genesisAuthority`, which permanently disables genesis issuance, or with the canonical launcher as a narrow authority
  that may direct exactly one fixed `1,000 ether` mint to a deployed pair after the permanent GBX binding. A successful
  genesis mint clears that authority. There is no protocol-defined economic supply cap, and supply reconciles as
  `totalSupply == lifetimeMinted - lifetimeBurned`.
  GBX retains ERC-2612 permit approvals but does not carry ERC20Votes checkpoints or governance weight.
- Deployment must verify `GBX.minter() == Mine`, `GBX.minterLocked() == true`, `Mine.gbx() == GBX`,
  `Mine.usdg() == USDG`, `Mine.fund() == Fund`, `Mine.resonanceRouter() == ResonanceRouter`, and the complete reciprocal
  Router/Resonance/SignalGBX identity graph before exposing the market. Mine does not validate the initial Router's USDG
  identity in its constructor or repeatedly read permanent graph facts on each replacement; it validates a candidate
  graph only when governance changes the Router. GBX itself continues to enforce the permanent minter binding whenever
  Mine mints. A completed canonical launch additionally requires `Mine.genesisLiquidityMinted() == true`,
  `Mine.genesisAuthority() == address(0)`, and
  `GBX.lifetimeMinted() == Mine.totalMined() + Mine.GENESIS_LIQUIDITY_GBX()`.
- Mine has exactly 16 immutable slots. Each slot uses an independent hourly reverse Dutch replacement auction and may
  begin a new tenure at any time, including with the same miner. Mine has no capacity or all-slot checkpoint operation,
  and its owner cannot alter slots, prices, emissions, claims, mint authority, USDG, GBX, or Fund.
- Every Mine replacement may attach an event-only message of at most 280 raw bytes. The message is emitted unindexed in
  `Mined` and is never written to Mine storage. Empty messages are permitted.
- A slot's assigned GBX tokens-per-second (`tps`) rate is locked for that miner's complete tenure. Redemptions and
  time-based halving boundaries must not reprice or dilute an occupied slot. Only a newly occupied or replaced
  slot receives `current global tps / 16`. Accept that aggregate issuance can exceed the current global rate for as
  long as legacy-rate miners remain; turnover is not guaranteed.
- Mine must maintain `aggregateTps` and a timestamped `storedPendingEmission` so total pending emission is available in
  constant time. Before one slot changes rate, accrue the old aggregate through the current timestamp; settle and mint
  only the replaced slot; then replace its contribution to `aggregateTps`. Pending emission does not select the
  prospective global rate.
- Global rates use a hard-coded time-based halving schedule anchored to Mine deployment: `INITIAL_TPS = 64 ether`,
  `HALVING_PERIOD = 69 days`, and `TAIL_TPS = 1 ether`. These are provisional development constants pending
  independent economic review. Do not add a rate setter, emissions controller, asset or signal migration authority,
  oracle, entropy source, team fee, or claim redirection. ADR 0055's future-revenue Router setter is the only migration
  exception.
- `SignalGBX` is the non-transferable, one-for-one GBX escrow receipt, the ERC20Votes governance token on the default
  block-number clock, and the sole public signal coordinator. Idle sGBX is forbidden: every successful raw-unit mint
  must atomically deposit the same GBX amount, assign the same amount to one live Strategy through Resonance, and give
  the account the same virtual balance in the paired Bribe. The public user operations are scalar `addSignal` and
  `removeSignal` plus struct-array `addSignalMany` and `removeSignalMany`, where each `Allocation` contains one Strategy
  and raw amount. A signal made while the holder has no current delegate self-delegates. Each scalar removal performs
  the exact inverse of one scalar addition. A batch addition transfers and mints its checked aggregate once before
  applying every allocation; a batch removal applies every allocation before burning and returning its checked
  aggregate once. An empty batch or any zero amount reverts. Duplicate Strategies are allowed and execute
  sequentially, with the existing per-allocation SignalGBX and Resonance events emitted for each entry. Batch length is
  caller-controlled and scalar removals remain the bounded liveness fallback. Do not add `signalWithPermit`,
  `moveSignal`, a dedicated `Resonance.moveSignalFor` hook, a shared write-through signal Router, operator approvals,
  or signed periphery intents. Smart accounts may atomically batch a GBX approval with direct SignalGBX calls while
  remaining `msg.sender`. SignalGBX has no ERC-2612 approval permit, staking withdrawal lock, signal cooldown, epoch
  restriction, or once-per-period allocation rule. Standalone `stake`/`unstake`, allocation from an idle receipt,
  removal into an idle receipt, and the redundant `stakeAndSignal`, `stakeAndSignalWithPermit`, and
  `removeSignalAndUnstake` workflows are not permitted.
- `Resonance` holds received USDG in one global seven-day Bribe-style stream and allocates each elapsed interval among
  live Strategies according to the SignalGBX weights active during that interval. Every signal change checkpoints
  elapsed revenue before changing weights, and every Strategy purchase checkpoints and pulls that Strategy's released
  USDG. Resonance uses the Synthetix schedule: a notification during an active period combines the new amount with
  `remainingSeconds * revenueRate`, applies ordinary integer division over seven days, and restarts the period. There is
  no front-loaded rate remainder. ResonanceRouter buffers until its complete balance is at least `REWARD_DURATION` raw
  USDG units and, during an active period, at least `remainingRevenue()`, then forwards the complete balance.
  The global revenue-per-signal index uses `1e36` precision. Cumulative fresh Resonance notifications must never exceed
  `floor(type(uint256).max / 1e36)` raw USDG units; the cap is monotonic and rejects excess before checkpointing or
  token interaction so signal exits remain usable. Rate, global-index, and per-Strategy floors are accepted surplus
  rather than explicit carry. Revenue that elapses while active signal supply is zero, and direct USDG donations, also
  remain unscheduled or unclaimable surplus in Resonance. Strategy and Bribe deployment follows the Liquid Signal
  shape: Resonance uses `StrategyFactory` and `BribeFactory`, and each Strategy has a corresponding Bribe-only buffer
  `BribeRouter` and `Bribe`.
- Resonance is permanently USDG-only. Keep its revenue schedule and per-Strategy accrual scalar: do not add a Resonance
  reward-token registry, token-keyed Resonance reward mappings, token parameters on its reward views, or another
  Resonance reward asset. This specialization does not apply to paired Bribes, which remain bounded multi-token
  rewarders.
- Signal state has one canonical owner at each level: `SignalGBX.balanceOf(account)` is the account's aggregate signal,
  each Strategy's paired Bribe stores `signalWeightOf(account)` and its complete `totalSignalWeight`, and Resonance
  stores only the active live-Strategy total. Do not maintain a separate `SignalGBX.allocatedBalance` value that must
  duplicate `balanceOf`. Resonance's `addSignalFor` and `removeSignalFor` hooks are callable only by SignalGBX; do not
  restore a dedicated move hook, direct user signaling on Resonance, a shared write-through Router, or duplicate these
  ledgers. Subgraph positions and read-only Lens/SDK results are replaceable discovery aids; state-sensitive writes must
  refresh canonical Bribe and Strategy state onchain.
- Killing a Strategy is irreversible. The kill checkpoints and preserves its accrued Resonance claim, excludes its
  complete weight from active revenue allocation, rejects later signal additions, and lets existing signalers remove their
  allocations without subtracting the excluded weight again. The killed Strategy earns no later Resonance revenue.
  Resonance tracks `liveStrategyCount`: before bootstrap it may be zero, but after the first Strategy is registered,
  `killStrategy` must not remove the final live Strategy. Governance replaces the final Strategy by atomically batching
  an addition before the old Strategy's kill. Do not add a fake abstain Strategy. Killed-Strategy positions must remain
  removable through either scalar or batch exit even after the Strategy is killed.
- Each Bribe may register at most sixteen append-only reward tokens. The cap is fixed in code and is not governable.
- Each Bribe uses a `1e36` reward-per-signal index so low-decimal rewards remain useful over 18-decimal signal weight.
  For each reward token in each Bribe, cumulative accepted notifications must never exceed
  `floor(type(uint256).max / 1e36)` raw units. Track this lifetime amount monotonically; it has no reset, setter, or
  escape hatch. Reject an over-cap notification before checkpointing or token transfer so cap exhaustion cannot block
  claims or scalar/batched signal removal. Direct token donations do not consume notification capacity.
- Bribes use the Synthetix schedule and ordinary floor semantics. A permissionless notification must be at least
  `REWARD_DURATION` raw token units and at least the stream's current `remainingReward` amount; it combines with
  `remainingSeconds * rewardRate` and restarts the seven-day period. Streams do not pause at zero signal supply and
  notifications do not queue. Rate, index, and account floors remain unallocated token surplus; do not add carry
  buckets, Fund rounding liabilities, exact-remainder scheduling, or surplus telemetry. Bribe claims are authorized
  only for the beneficiary itself or the Bribe's immutable Resonance. Keep the all-token claim and one scalar-token
  claim for broken-token isolation. Resonance may provide the narrow caller-owned cross-Bribe convenience batch: it
  accepts caller-selected registered Strategy addresses, always claims for `msg.sender`, supports live and killed
  Strategies, and adds no operator or arbitrary-beneficiary authority. Batch length is caller-controlled; scalar direct
  claims remain the bounded broken-token and gas fallback.
- Core reward and payment accounting assumes standard, non-rebasing ERC-20 transfers. Use `SafeERC20`, but do not add
  sender/receiver balance-delta enforcement or claim support for fee-on-transfer, rebasing, or mutable-blocklist tokens
  to Mine, SignalGBX, Strategy, Resonance, Bribe, or their Routers. Fund redemption is the exception:
  its caller-selected arbitrary assets retain exact payout deltas and basket guards.
- Every Strategy is the same bounded reverse Dutch acquisition mechanism. Resonance stores one global prospective
  automatic-Bribe rate: `BPS = 10_000`,
  `DEFAULT_BRIBE_BPS = 1_000`, and `MAX_BRIBE_BPS = 2_000`. The Resonance owner may set `bribeBps` from 0 through
  2,000 inclusive; the Fund rate is always the complement and no per-Strategy override is permitted. Before payment-
  token interaction, Strategy snapshots the current rate and computes `bribeAmount = floor(payment * bribeBps / BPS)`.
  It pulls the complete payment, transfers the complement directly to Fund, and transfers any nonzero Bribe amount to
  its paired BribeRouter. There is no cumulative split carry or deferred Fund liability. The acquired payment asset,
  not USDG, is the automatic Bribe reward. `minimumPrice` resets the next epoch's starting price; it is not a fill-time
  floor. Because an initial Strategy epoch begins at deployment, its first nonempty inventory may be bought for zero if
  no purchase occurs before the full 24-hour decay.
- BribeRouter is only a Bribe buffer. Its permissionless `route()` operation notifies its complete payment-token balance
  once that balance satisfies the Bribe's minimum-notification and current-remaining thresholds. Bribe failure leaves
  the buffered tokens retryable without reverting the completed Strategy purchase. Compatible direct donations join
  the next notification. Additional independently funded Bribe rewards remain permitted within the fixed token and
  lifetime caps. A 0% automatic rate must not disable Strategies, Bribes, signaling, exit, existing rewards, or
  independently funded rewards.
- A Strategy priced in GBX does not burn during settlement. Its Fund share reaches `Fund` atomically with the purchase
  and may then be burned permissionlessly through `Fund.burnGBX`; any nonzero Bribe share funds the paired GBX reward
  buffer. Users should burn Fund-held GBX before calculating a redemption.
- Before every redemption denominator snapshot, Fund must read Mine's constant-time effective supply so accrued
  unminted GBX is included without a checkpoint or any slot iteration.

## Fund behavior

- `Fund` is a permissionless raw-token treasury, not a curated asset registry. Any ERC-20 sent to it may become GBX
  backing. Official protocol/index membership is represented by Strategies registered in Resonance, not by a Fund
  asset list.
- Anyone may burn GBX already held by `Fund` through the dedicated burn function. GBX may accumulate there until a
  permissionless caller burns it; burning before redemption removes Fund-held GBX from the payout denominator.
- Redemption is unpausable and does not enumerate Fund assets. A redeemer supplies `gbxAmount`, a receiver, and a
  caller-selected array of unique non-GBX token addresses. For every selected token, transfer:

  `floor(Fund token balance * gbxAmount / (GBX total supply + pending mining emission) before the burn)`

- Take the supply and balance snapshots before burning, and make the burn and every selected transfer atomic. A failed
  selected-token transfer reverts the entire redemption, including the burn.
- A redeemer may omit any token, including a broken or unwanted token. Claims for omitted tokens are permanently
  forfeited and remain for the post-redemption GBX supply. There is no asset-count cap beyond transaction gas and no
  general recovery function for unsolicited tokens.
- Reject GBX, the zero address, and duplicate addresses in redemption arrays. Duplicate detection should use
  EIP-1153 transient storage so arrays may be in any order without permanent registration, IDs, nonce mappings, or
  persistent writes. Clear transient marks before a successful call returns so multiple redemptions in one transaction
  remain independent. Keep redemption non-reentrant.

## External liquidity

- The continuing core creates, seeds, owns, custodies, prices, rebalances, compounds, harvests, or swaps no liquidity
  position and makes no liquidity guarantee. Do not add liquidity callbacks, continuing custody, fee routing, oracle,
  or market-making logic to the core.
- The development-only canonical launcher is the narrow exception. In one authorized protocol-graph launch transaction
  on Robinhood Chain mainnet (`chainid == 4663`), it uses the pinned Uniswap V2 Factory
  `0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f` directly, creates a new reviewed-USDG/GBX pair, deposits
  exactly `1e6` raw six-decimal USDG and `1,000 ether` GBX, and mints the complete genesis LP supply to `address(0)`.
  The recorded Router `0x89e5DB8B5aA49aA85AC63f691524311AEB649eba` is not called during genesis.
- The fixed seed must produce exactly `31,622,776,601,683` raw total LP supply, of which `31,622,776,600,683` is the
  provider-liquidity return after the pair's `1,000` minimum liquidity. All genesis LP is permanently locked. An
  existing Factory pair for that launcher's deterministic GBX makes the transaction revert. The operator must abandon
  that unused launcher and deploy a fresh launcher whose caller-scoped CREATE2 outputs produce a different GBX and Pair.
- During that same transaction the launcher registers exactly two initial Strategies, first GBX at initial and minimum
  price `100,000 ether`, then the actual LP at initial and minimum price `50 * pair.totalSupply()`. Both use a 24-hour
  epoch and `1.2e18` price multiplier.
- LP minted later by independent liquidity providers receives no special treatment. The normal global Fund/Bribe split
  applies, and LP held by Fund is an ordinary caller-selectable redemption asset. External liquidity remains neither a
  continuing core action nor a protocol liveness guarantee.

## Immutability and administration

- The protocol targets maximum decentralization with minimal governance, per ADR 0016, ADR 0017, and ADR 0055. Do not
  add an upgrade path, proxy, pause switch, rescue or sweep function, arbitrary-call executor, state migration, forced
  signal move, or any owner role beyond the recorded Mine and Resonance owners. Mine's narrow validated
  `setResonanceRouter` may redirect only future protocol revenue. When a design choice trades governance flexibility
  against immutability outside that exception, choose immutability and record the accepted consequence.
- `Fund` is ownerless. Its non-GBX backing assets move only when a GBX holder burns their own tokens through
  redemption; assets that redeemers omit stay in `Fund` for the remaining GBX supply indefinitely. GBX held by `Fund`
  is burnable by anyone through the dedicated burn function.
- The continuing custom administration surface is `Mine.setResonanceRouter`, `Resonance.addStrategy`,
  `Resonance.killStrategy`, `Resonance.addBribeRewardToken`, and bounded global `Resonance.setBribeBps`. Mine and
  Resonance use OpenZeppelin `Ownable2Step`, including inherited two-step transfer, current-owner replacement or
  cancellation of a pending transfer, and immediate renunciation. Do not add another owner-gated protocol method.
  Resonance's separate setup-only `setResonanceRouter` call is consumed once while the launcher owns it and cannot
  replace or clear that binding later.
- SignalGBX, StrategyFactory, and BribeFactory retain setup-only plain-`Ownable` shells around their one-time Resonance
  bindings. After those bindings are consumed, their owners have no custom protocol action but still expose inherited
  ownership transfer and renunciation. Production evidence must explicitly remove the temporary owner from those
  three shells rather than describing Resonance as the only Ownable deployment.
- SignalGBX retains ERC20Votes checkpoints for a separately reviewed external governance system. Do not implement or
  vendor a DAO, Governor, Timelock, generic executor, governance adapter, or provider-specific plugin in the core until
  an ADR selects its exact architecture and version.
- Create every reviewed initial Strategy while the temporary setup owner controls Resonance. The canonical launcher
  must then begin two-step transfers of both Mine and Resonance to the exact external governance executor selected by a
  later ADR and remove the three setup-only owners. Governance must accept both pending transfers after launch. Until
  that integration's code provenance, voting token, permissions, parameters, admin/upgrade paths, execution delay,
  cancellation rules, two-step compatibility, and both ownership receipts are reviewed and recorded, deployment
  remains blocked.
- The canonical launcher performs both initial Strategy registrations, renounces the consumed SignalGBX,
  StrategyFactory, and BribeFactory ownership shells, and sets the passed reviewed governance contract as pending owner
  of both Mine and Resonance before returning. Any launch failure reverts the complete protocol-graph transaction. The
  single-use launcher remains the formal Mine and Resonance owner until the pending governance contract accepts, but it
  exposes no post-launch path that can exercise those owner methods. Production evidence must verify both acceptances
  and zero pending owners before exposure.
- A Router change affects future Mine deposits only. The old Router, Resonance, SignalGBX, Strategies, Bribes, balances,
  streams, claims, and signal positions remain in place. Users claim and unsignal through the old graph, then may signal
  the returned GBX into the new graph. Do not describe this as a balance migration or claim that the switch rescues an
  already broken old exit path.
- CI must never broadcast mainnet transactions.

## Source and generated artifacts

- Keep Solidity contract bodies in this order: types, constants, immutables/state, events, errors, modifiers,
  constructor, external/public state-changing functions, external/public view or pure functions, internal/private
  state-changing helpers, then internal/private view or pure helpers. Keep overloads adjacent and related functions in
  execution order within each section rather than sorting alphabetically.
- Edit Solidity under `packages/contracts/src`, then run Forge and Hardhat against the same source. Do not hand-edit
  compiler output under `artifacts`, `cache`, `out`, or `typechain-types`.
- SDK ABI files are generated from Foundry artifacts with `pnpm sdk:abi:generate`; verify with
  `pnpm sdk:abi:check`. Synchronize subgraph ABIs with `pnpm --filter @gumball-6900/subgraph abi:sync` after every
  relevant event or ABI change.
- Economic JSON fixtures and SVGs are committed reproducibility evidence. Change the independent models first, then
  regenerate and run `pnpm simulations:fixtures:check`; never patch expected numbers to hide a model mismatch.
- Files under `packages/config/deployments` are dated candidates or evidence unless a signed manifest explicitly
  clears every gate. Never invent an unresolved canonical address, signer, code hash, legal approval, or review.
- Raw audit output belongs in `packages/contracts/audit/reports` and is ignored. Reviewed dispositions belong in
  `packages/contracts/audit/FINDINGS.md`.

## Required checks

Run narrow package checks while iterating, then the applicable repository gates before handoff:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm sdk:abi:check
pnpm subgraph:build
pnpm web:test:e2e
```

Contract changes additionally require `forge fmt --check`, `forge build --sizes`, the configured Foundry suite, and
Hardhat tests. Event changes require subgraph codegen/build/Matchstick tests. Economic changes require both Python and
TypeScript models. Fork results count only when the exact RPC capability and block pin are recorded; a skipped fork is
not a pass.

## Safety and release language

- Never commit or print secrets, credential-bearing URLs, private keys, signer material, or private legal artifacts.
- Never deploy, verify live contracts, sign a manifest, transfer roles, fund genesis, publish packages, or release a
  public site unless the user explicitly authorizes that external action and all documented prerequisites are met.
- Preserve provisional, unresolved, demo, preview, and stale-state labels. Do not use “live,” “launched,” “audited,”
  “verified,” or “release-ready” unless the exact signed manifest and external evidence support the statement.
- Preserve user work in a dirty tree. Do not overwrite deployment state or rerun a partially broadcast Foundry phase;
  reconcile receipts and onchain state first.
- Any implementation/prose mismatch blocks production until it is resolved, tested, and recorded in an ADR when the
  protocol or trust model changes.
