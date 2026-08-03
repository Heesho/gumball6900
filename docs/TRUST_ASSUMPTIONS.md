# Trust assumptions

> No production deployment, audit, legal approval, or signed manifest is established by this repository.

## Enforced without governance discretion

The current contracts enforce:

- cumulative GBX minting can never exceed one billion;
- burns never restore mint capacity;
- redemption burns against pre-burn supply and returns the raw fraction of every registered vault balance;
- a live strategy can release no more USDG than its current virtual budget;
- the guardian cannot resume, mint, move assets, or block exit functions; and
- the timelock exposes named parameter-bound operations rather than a generic executor.

These bounds do not make all admitted code trustworthy.

## Three delayed code/value trust surfaces

### 1. Emission-controller replacement

The proposer can schedule a replacement controller. After seven days, anyone can execute it. The token checks that
the candidate is deployed code and reports the same GBX and the canonical mining pool cached during initial
controller binding. Replacement validation never calls the current controller and deliberately does not enforce an
epoch or schedule checkpoint, which could become stale while permissionless settlement continues during the delay.
Those getters do not prove schedule behavior or the mint receiver. A malicious compatible controller can mint all
remaining lifetime capacity to any address. The one-billion cap survives; the canonical four-year curve does not.

### 2. Exact position-NFT transfer

The proposer can schedule transfer of the one recorded Uniswap v4 NFT to any nonzero deployed-code recipient. The
recipient is not constrained to a known interface or runtime hash. Code that accepts the NFT can control the complete
position after transfer. The original custodian's fee-routing and no-principal-withdrawal rules then cease to protect
that position.

### 3. Strategy-code admission

The proposer can schedule an acquisition tuple or standalone strategy registration. The registry checks selected
wiring getters—for example target, rewards, and registry—but does not attest runtime bytecode or prove the code's
semantics. Once live, the strategy itself selects the receiver passed to `GumBallVault.releaseUSDG`. The vault limits
it to the strategy's current signaled budget, but cannot require a target payment, GBX burn, or honest auction.

Every candidate must therefore be reviewed as value-moving code even when its getters match. A malicious contract
can also implement expected getters solely to pass registration.

The acquisition tuple also admits rewards code called during voter weight changes. While the strategy is live, a
reverting hook can block signal updates and reset, temporarily preventing unstake. Guardian or timelock terminal
disablement removes the strategy from allocation; after that, the voter never calls its rewards code during
zero-weight reset and still clears the user's voter weight. This prevents reverting or gas-burning admitted code from
blocking exit. Honest rewards retain a terminal weight snapshot and already indexed claims remain claimable because a
canonical disabled strategy cannot create new notifications. Malicious strategy or reward accounting is not repaired.

The seven-day delay provides public notice for all three surfaces. It is not a veto or safety proof. Scheduled
operations have no cancellation or expiry in the current timelock; once mature they remain permissionlessly
executable until consumed.

## Initially inactive strategies

The deployment script creates one acquisition/rewards pair and one buyback strategy, verifies their configured
getters, and leaves them unregistered and inactive. The registry initially contains only USDG. Each registration is a
separate typed seven-day operation. Before registration, fills and signals to those strategies fail and their auction
clocks are unset. Successful typed registration atomically starts the relevant first auction at its full initial price;
the seven-day admission delay does not age it.

Revenue received with zero active weight becomes `idleUSDG`. Registration or signaling later does not assign that
revenue retroactively.

## Roles

- The proposer is trusted to schedule only reviewed controllers, NFT recipients, strategies, team addresses, and
  resume actions.
- Anyone executing a mature operation is not trusted; execution is parameter-bound and permissionless.
- The guardian operator is trusted for availability. Compromise can stop new exposure or terminally disable live
  strategies, but cannot steal backing or block exits.
- The deployment operator is trusted during graph setup. A local rehearsal is atomic, but an authorized Foundry
  broadcast would be a non-atomic transaction sequence that requires receipt-by-receipt reconciliation. The completed
  graph must end with zero deployer GBX and no retained initializer or mint authority.
- The team address receives the fixed mining fee when nonzero. A delayed update can redirect only future fees.

## Token compatibility and issuer trust

USDG and every acquisition or registered asset must be reviewed standard ERC-20 code, non-rebasing and
non-fee-on-transfer. Exact debit/receipt assertions fail closed when required equality differs; other measured deltas
are accounting guards. Neither supports taxed, rebasing, callback, blocklist-changing, or otherwise exotic tokens.

Token issuers and administrators remain external trust dependencies. A freeze, blacklist, upgrade, pause, seizure,
or incompatible behavior change can block deposits, fills, fee routing, rewards, or the vault's atomic all-asset
redemption. The protocol has no privileged asset substitution or skip path.

## External systems

- The selected chain must provide ordinary EVM ordering and finality assumptions documented in the signed evidence.
- The configured USDG, target-token, Uniswap v4 PositionManager, Permit2, and pool code must match reviewed runtime
  code at the pinned block.
- The initial price and range are deployment judgments, not protocol-derived values.
- Indexers, SDKs, displays, and web interfaces are conveniences; users must be able to verify contract state directly.

## Economic assumptions

- Users understand that a tiny non-empty epoch still receives the complete scheduled emission.
- Users understand that auction price becomes exactly zero at and after its endpoint.
- Immediate, unlocked signals can be changed around known revenue notifications; the system intentionally has no
  time-weighting or lock.
- Strategy budgets are accounting claims against vault USDG, not segregated balances.
- The canonical position is outside the raw vault redemption basket.

## Release assumptions

Production requires resolved addresses and economic inputs, independent security review, exact fork evidence, legal
and issuer approval, a signed manifest, operational monitoring, and resolution of the licensing blocker in `NOTICE`.
Local tests do not satisfy those requirements.
