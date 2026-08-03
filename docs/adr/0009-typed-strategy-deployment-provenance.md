# ADR-0009: Typed Strategy Deployment and Provenance Admission

- Status: Accepted
- Date: 2026-08-02
- Decision owners: protocol engineering and security review

## Context

A live acquisition strategy has narrow but economically material authority. An auction fill can cause GumBallVault to
release the strategy's recorded virtual USDG budget. Registration based only on code presence, interface-shaped
getters, or operator-reviewed addresses would allow a malicious contract to imitate the expected surface while
redirecting its allocation, skipping target delivery, corrupting reward handling, or making emergency cleanup
unreliable.

The protocol must support reviewed acquisition additions after launch while retaining direct, non-upgradeable
contracts. It must not introduce a public factory, arbitrary vault execution, a generic timelock call surface, a
mutable implementation allowlist, or guessed child addresses that can drift with a deployer nonce.

## Decision

One direct, non-upgradeable `StrategyDeployer` is part of the canonical protocol graph. Its constructor stores
immutable hashes and byte lengths of the exact compiler creation bytecode for `AcquisitionStrategy`, `ManagerRewards`,
`HoldUSDGStrategy`, and `BuybackBurnStrategy`, plus the exact count and ABI hash of the reviewed ordered bootstrap
target list. Deployment and manifest verification derive those commitments from the compiled artifacts and deployment
configuration. A caller supplies only the matching compiler creation bytecode and typed economic parameters;
StrategyDeployer rejects a byte-length or hash mismatch and appends the canonical bound dependency graph itself.

Only ProtocolTimelock can call StrategyDeployer. The contract has three typed deployment functions and one private
assembly `CREATE` helper. It has no arbitrary init-code endpoint, arbitrary constructor tail, generic external call,
`delegatecall`, upgrade, or owner-controlled implementation list. Every created strategy and rewards contract is a
direct, non-proxy deployment. The isolated use of `CREATE` is therefore a construction mechanism, not a general
factory or executor capability.

StrategyDeployer's one-time initialization validates and binds the reciprocal AssetRegistry, AllocationVoter,
GumBallVault, eligibility module, ProtocolTimelock, EmergencyGuardian, and GBX identities. For each acquisition it
atomically deploys the strategy/rewards pair, initializes their association, records the target and complete graph,
records both runtime code hashes, and emits both actual child addresses. A failed child deployment or initialization
reverts the complete transaction and provenance update. At most one acquisition strategy may be deployed for each
target token.

The prelaunch deployment initializer can reach StrategyDeployer only through typed ProtocolTimelock bootstrap
endpoints. That window creates the one canonical HoldUSDG singleton, reviewed initial acquisition pairs, and the one
canonical buyback-and-burn singleton. HoldUSDG and buyback each reject duplicates. Bootstrap finalization requires
both singletons, the constructor-committed target count/hash, and exact equality between the supplied and enumerated
deployment-order target list. It persists the finalized count/hash and permanently closes those initializer paths.
After finalization, the timelock permits only an
exact, canonically ABI-encoded `deployAcquisition` call whose two creation-bytecode hashes and economic bounds pass
onchain validation; both creation-code lengths must also match their immutable commitments.

Postlaunch acquisition admission uses two serial critical-change operations:

1. Schedule and, after seven days, execute the typed acquisition/rewards deployment on StrategyDeployer.
2. Resolve the actual child addresses from the deployment receipt/event and onchain provenance, verify their runtime
   code and graph, then schedule the corresponding AssetRegistry registration. No process may pre-register or rely on
   a guessed nonce-derived `CREATE` address.
3. After a separate seven days, execute registration. AssetRegistry atomically rechecks StrategyDeployer's configured
   graph, the target/strategy/rewards association, every recorded dependency, and the current runtime code hashes.

AssetRegistry treats HoldUSDG and buyback as special singletons: USDG may reference only the recorded HoldUSDG address
and runtime hash, while standalone strategy admission may reference only the recorded buyback and its complete
graph/runtime record. No other standalone strategy is admissible.

Every asset registration also commits a nonzero asset identifier and symbol hash. The token must return canonical
dynamic-string ABI data for a symbol between one and 32 bytes, every byte must be printable ASCII `0x21..0x7e`, and
the exact symbol bytes must hash to the committed value. The check applies to ordinary assets, USDG, and stock tokens
at registration execution time.

## Invariant impact

- No public caller, EOA deployer, guardian, or arbitrary timelock target can arbitrarily create or admit a live
  strategy; the temporary initializer can trigger only the typed, committed prelaunch paths.
- A live strategy's target, rewards peer, vault, voter, registry, timelock, guardian, eligibility module, and runtime
  bytecode must match StrategyDeployer's recorded provenance at registration.
- HoldUSDG and buyback remain unique prelaunch singletons, and their bootstrap deployment authority disappears
  permanently at finalization.
- The initial acquisition set cannot contain an unreviewed or hidden pair: immutable count/hash, live enumeration,
  persisted finalization state, and exact finalizer receipt/events all bind the same ordered target list.
- Postlaunch deployment cannot make a strategy live; a second, independently delayed registry operation is required.
- Strategy deployment introduces no upgrade, proxy, generic call, arbitrary vault call, NAV oracle, or new custody
  path.
- Malformed, empty, non-printable, oversized, or hash-mismatched token symbols cannot enter the canonical registry.

## Consequences

Postlaunch asset additions require two complete public review windows rather than one. Artifact bytecode is included
in deployment calldata, increasing calldata cost, and the immutable commitments intentionally prevent a later
compiler or implementation change from being silently substituted. A different implementation requires a separately
reviewed successor protocol decision; it cannot be added by mutating an allowlist.

Child addresses are not treated as deterministic configuration inputs. Tooling must consume the successful receipt,
typed events, and StrategyDeployer provenance before constructing the registration operation. This avoids stale or
incorrect nonce assumptions and makes the reviewed pair explicit.

The prelaunch initializer remains a temporary construction authority, but it can select only committed contract
types and typed parameters. Production authorization remains blocked until bootstrap finalization, complete manifest
and receipt verification, role scans, tests, and independent review all succeed.

## Rejected alternatives

### Admit any contract that implements the strategy interface

Rejected because getter-shaped behavior does not prove fill ordering, target delivery, reward routing, or immutable
dependency identity.

### Use a public or owner-configurable factory

Rejected because arbitrary bytecode, mutable implementations, generic constructor data, or public creation would add
an unnecessary authority surface and weaken manifest provenance.

### Predict child addresses and queue deployment and registration together

Rejected because a `CREATE` address depends on deployer nonce and transaction ordering. Registration must use the
addresses actually emitted and recorded after successful deployment, and must receive its own seven-day review
period.

### Let AssetRegistry deploy strategies during registration

Rejected because it would combine code creation and admission in one critical operation, complicate rollback and
review, and enlarge the registry's authority.

### Make compiler-bytecode commitments mutable

Rejected because a timelocked hash update would become an implementation upgrade mechanism for contracts that are
specified as direct and non-upgradeable.

## Verification

- Foundry unit and integration coverage must reject non-timelock callers, wrong or empty creation bytecode, duplicate
  singleton/target deployments, malformed dynamic calldata, alternate dependency graphs, and bootstrap calls after
  finalization.
- Lifecycle coverage must exercise a postlaunch seven-day deployment, provenance-derived address resolution, and a
  separate seven-day registration before any fill can use the new strategy.
- Deployment and release verification must recompute creation-bytecode hashes and lengths from compiled artifacts,
  bind child contracts to their enclosing successful receipt, validate exact bootstrap-finalizer calldata and both
  closure events, compare immutable/persisted target count/hash/order, and compare current runtime code and onchain
  provenance at both the signed observation and a fresh head.
- Release verification must reconstruct every ProtocolTimelock schedule/cancel/execute lifecycle from its deployment
  block, bind reviewed operations to their successful receipts and exact event commitments, and reject every
  unreviewed operation or outstanding queue entry at either verification head.
- Registry tests must cover malformed ABI returns and every symbol identity rejection boundary.
