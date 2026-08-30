# Trust assumptions

- USDG, GBX, Strategy payment tokens, and registered Bribe reward tokens are standard non-rebasing ERC-20s.
  `SafeERC20` checks call success and conventional optional returns but does not prove balance movement. Canonical
  Mine and SignalGBX transfers deliberately trust the reviewed GBX/USDG implementations; Fund
  retains stricter checks only for caller-selected arbitrary assets.
- Users and integrators account for each Bribe's immutable per-token lifetime notification cap of
  `floor(type(uint256).max / 1e36)` raw units. It cannot be reset or bypassed; an exhausted pool must be replaced with a
  new Strategy and Bribe while incumbent positions remain removable from the old pool. Reallocation uses direct
  removal from the old Strategy and addition to the replacement.
- SignalGBX holders understand that its non-transferable ERC20Votes checkpoints and delegation remain available to a
  future external governance integration, but the core assigns them no proposal threshold, quorum, delay, cancellation,
  or execution semantics.
- No external governance system or production Mine/Resonance owner has been selected. Deployment remains blocked until a
  later ADR pins and reviews the provider release, deployed code, plugins, SignalGBX compatibility, permission and admin
  graph, upgrade paths, proposal rules, batching, delay, cancellation behavior, two-step compatibility, and both
  ownership handoffs.
- Users understand that a compromised external Resonance owner can misuse Strategy membership or Bribe reward-token
  registration, and a compromised Mine owner can redirect future protocol revenue to a structurally consistent but
  malicious graph. Mine and Resonance use two-step ownership transfer but retain immediate renunciation. Fund remains
  ownerless and outside that authority.
- Users understand that Mine has exactly sixteen immutable slots and a halving never reprices an occupied tenure. Mine's
  owner cannot change that behavior; its only custom authority is the future-revenue Router setter.
- Interfaces derive the next boundary from Mine `startTime` and use a pre-boundary replacement deadline when a quoted TPS
  must remain valid; the contract has no separate TPS-slippage parameter.
- Mine's hard-coded initial rate, time-based halving period, positive tail, price multiplier, and minimum initial price
  are independently reviewed before deployment. The provisional 64 GBX-per-second, 69-day, 1 GBX-per-second schedule
  is not economic approval.
- Deployment verifies the permanent reciprocal GBX/Mine binding before exposing Mine. Mine does not spend gas
  re-reading that immutable deployment fact on each replacement; GBX still rejects every unauthorized mint.
- Miners understand rollover risk: only a positive-price replacement produces a nonzero 80% claim for the outgoing
  tenure miner. The current miner may replace its own slot, including for zero USDG after one hour.
- Users understand that a paid Mine replacement ends after Mine's successful `SafeERC20` transfer request for the nominal
  protocol share into ResonanceRouter. Under the supported USDG model the requested amount arrives; Mine does not
  inspect transfer deltas. Permissionless `route()` has no designated keeper, bounty, or liveness guarantee, so the
  balance may wait indefinitely until a manual, frontend, volunteer-keeper, or cron caller acts.
- Miners realize accrued GBX when their slot is replaced and may self-replace for zero USDG after one hour.
- Interfaces treat Mine messages as untrusted payer-authored event data, escape them before display, and enforce the
  280-byte limit in bytes rather than assuming 280 Unicode characters. Mine does not validate UTF-8 or store messages.
- GBX construction begins at zero supply and the temporary setup minter cannot mint before Mine is permanently bound
  as the sole lifetime issuer. The canonical completed graph instead has exactly `1,000 ether` lifetime-minted GBX:
  Mine's fixed one-time genesis issue to the validated Pair. `Mine.totalMined()` excludes that amount, while
  `totalSupply == lifetimeMinted - lifetimeBurned` remains exact.
- The canonical launcher, four stateless component deployers, immutable launch authority, reviewed six-decimal USDG,
  and final governance owner are independently reviewed at their exact addresses and bytecode. Public calls to the
  stateless deployers can create unrelated graphs but grant no authority over canonical GBX.
- Reviewers account for predictable-address USDG prefunding. Launcher-held USDG is forwarded to Fund; future
  ResonanceRouter and Resonance balances follow ordinary buffer and direct-surplus semantics. These transfers create no
  depositor claim. They do not extend to the Pair, which the launcher must create anew and seed with exact balances.
- The launch authority approves the launcher for exactly `1e6` raw USDG and understands that a prior approval survives
  a reverted launch. A rejected launch plan revokes that allowance. The authority does not treat transaction atomicity
  as protection against wrong reviewed inputs or malicious final-owner code.
- The pinned Robinhood Chain mainnet Factory and resulting USDG/GBX Pair implement the reviewed Uniswap V2 semantics,
  including exclusive `createPair`, canonical token identities, reserves, first-mint square-root math, and zero-address
  LP minting. The launcher never adopts or skims an existing Pair; a collision requires a fresh launcher whose
  caller-scoped CREATE2 outputs produce a different GBX and Pair.
  Source constants and code-presence checks do not replace pinned runtime-code hashes and provenance review.
- The fixed `1e6` raw USDG plus `1,000 ether` GBX seed is economically accepted, and permanent loss of control over all
  genesis LP is intended. That tiny locked seed makes no liquidity, price, execution, USDG-value, or market-availability
  guarantee. LP minted later remains ordinary fungible property and Fund-held LP is redeemable when selected.
- The two initial Strategies and their exact order and parameters are reviewed: GBX at `100,000 ether`, LP at
  `50 * pair.totalSupply()`, equal initial/minimum prices, a 24-hour epoch, and `1.2e18` multiplier. Interfaces disclose
  that a first epoch with no timely inventory can decay to a zero-price fill before the configured minimum starts the
  following epoch.
- After both Strategies are registered, the launcher renounces SignalGBX, StrategyFactory, and BribeFactory ownership,
  clears Mine's genesis authority, and atomically makes the exact reviewed external governance executor pending owner
  of Mine and Resonance. Governance separately accepts both ownerships before public exposure; a successful launch is
  not by itself a completed handoff.
- Every later Mine Router switch is a prospective revenue cutover only. The complete replacement graph is deployed and
  bound first, exact bytecode is independently authenticated, and Mine is switched last. Old Router and Resonance
  balances, Strategy claims, Bribe rewards, and signal positions remain in the old graph; users claim and unsignal there
  before optionally signaling returned GBX into the new graph.
- The selected external governance system explicitly handles the new SignalGBX address created by every replacement
  graph. Old checkpoints and new checkpoints are separate; Mine's Router setter does not migrate voting power or update
  governance configuration.
- Interfaces discover Fund assets offchain because Fund deliberately has no registry.
- The target chain supports EIP-1153 transient storage; deployment evidence repeats the pinned-chain capability check.
- donut-miner provenance and distribution rights are cleared before public distribution or deployment.

These assumptions are design inputs, not evidence of audit, deployment, or production safety.
