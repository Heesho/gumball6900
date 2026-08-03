# GUM BALL 6900 Access Control

Status: normative authority baseline. Contract implementation and deployment scripts must make these restrictions
machine-checkable; multisig policy alone is not an adequate control.

## Model

GUM BALL 6900 has maintenance and emergency administration, but no conventional DAO governance. GBX holders may
stake, signal relative weights among approved strategies, reset signals, unstake, redeem, and claim. They cannot
submit proposals, execute calls, add assets, change code, change the supply cap, sweep the vault, add leverage, or
pause redemption.

Core contracts are non-upgradeable. Authority is divided among immutable/set-once protocol peers, a delayed
ProtocolTimelock multisig for bounded maintenance, and an EmergencyGuardian multisig for immediate defensive stops.

## Authority matrix

Legend: **yes** is an intended capability, **bounded** requires the listed preconditions, and **never** must be
impossible in code.

<!-- prettier-ignore -->
| Operation | User / keeper | Protocol peer | Guardian | Timelock | Deployer after launch |
|---|---:|---:|---:|---:|---:|
| Contribute for beneficiary | yes | — | pause new only | never | never |
| Permissionless epoch settlement | yes | explicit MiningPool mint request | pause only if refund remains possible | never | never |
| Claim settled GBX for beneficiary | yes | claims contract transfer | never pause | never | never |
| Stake, signal, reset, unstake | yes | StakedGBX/Voter checkpoint | pause new activations only | never | never |
| Claim accrued manager reward | yes | associated rewards contract | never pause | never | never |
| Sweep queued manager terminal dust | yes | ManagerRewards routes only to fixed GumBallVault | never pause | never redirect | never |
| Redeem GBX pro rata | yes | Vault/token burn path | never pause | never pause | never |
| Notify newly deposited USDG | — | allowlisted bootstrap/mining/router/liquidity sources | never | never | never |
| Release USDG for acquisition | auction taker initiates | live strategy, bounded by recorded budget and fill state | can pause fills | never directly | never |
| Disable broken acquisition | — | registry/voter cleanup | bounded immediate | bounded delayed | never |
| Deploy exact acquisition/rewards bytecode | never | typed StrategyDeployer only | never | bounded, seven-day delay | never |
| Register validated asset/provenance | never | — | never | bounded, separate seven-day delay | never |
| Reset stale auction reference | never | — | pause only | bounded, 48-hour delay and hard rate bounds | never |
| Initialize canonical pool | permissionless only through guarded flow | LiquidityManager during atomic launch | pause additions | never directly | never |
| Collect/sweep completed LP range | permissionless trigger | LiquidityManager routes to vault/burn | never block vault routing | never redirect | never |
| Migrate canonical liquidity | never | constrained LiquidityManager | can pause | bounded, seven-day delay, precommitted PoolKey | never |
| Register unsupported rescue token | never | non-vault contract only | never | bounded rescue | never |
| Sweep GumBallVault | never | never | never | never | never |
| Mint generic GBX / alter cap | never | never | never | never | never |
| Upgrade core contract | never | never | never | never | never |

When GBX has a nonzero eligibility module, genesis and recurring contribution entrypoints check the recorded
beneficiary before taking USDG, and StakedGBX checks the staker before taking GBX. A reverting eligibility registry
fails these new-entry paths closed. Claims, refunds, burns, signal reductions, and unstaking retain their independent
liveness rules; the GBX transfer hook still enforces receiver eligibility when a claim or unstake transfers GBX.

## Immutable and set-once peers

The following relationships are constructor immutables whenever deployment ordering permits:

- GBXToken → EmissionController minter.
- EmissionController → GenesisBootstrap and MiningPool role-specific callers.
- StakedGBX → GBXToken and AllocationVoter.
- GumBallRouter → GBXToken, StakedGBX, and GumBallVault.
- GumBallVault → GBXToken, USDG, AllocationVoter, and AssetRegistry.
- AssetRegistry → USDG, ProtocolTimelock, EmergencyGuardian, and StrategyDeployer.
- StrategyDeployer → ProtocolTimelock, EmergencyGuardian, and GBXToken, followed by one-time binding to the
  AssetRegistry, AllocationVoter, GumBallVault, and eligibility module graph.
- Each AcquisitionStrategy → target token, vault, voter/budget source, registry, timelock, guardian,
  StrategyDeployer initializer, and associated ManagerRewards.
- Each ManagerRewards → its one strategy, voter, and reward token.
- LiquidityManager → GBX, USDG, canonical v4 contracts, vault, voter, and launch guard.

Where a construction cycle makes an immutable impossible, initialization is one-time, caller-constrained, rejects
zero/code-less/wrong-type targets, emits the finalized wiring, and permanently closes. No operational role can later
replace a voter, vault, token, minter, strategy, or rewards reference.

Terminal manager-dust finalization is an accounting-only voter callback with no reward-token transfer. Any address
may later trigger a sweep for a recorded generation and remainder cycle, but ManagerRewards fixes both the complete
pending amount and GumBallVault destination. No keeper, guardian, timelock, deployer, or manager can redirect or
partially withdraw it. A failed exact transfer preserves the pending queue and cannot block signal reduction, reset,
voting changes, or unstaking.

## Emission authority

EmissionController is the only GBX minter. It exposes separate methods for the one-time `(80m, 20m)` genesis mint
and recurring settled emissions. Callers are fixed peers, amounts are independently capped, and the controller
advances schedule/cumulative state itself. It exposes no `mint(address,uint256)` role, owner bypass, cap setter, or
minter rotation.

Claims contracts custody already-minted GBX. Their only GBX outflows are beneficiary claims and real burn of expired
claims; GBX is excluded from rescue.

## Vault authority

GumBallVault is not an executor. It has no owner withdrawal, rescue, generic approval, generic call, delegatecall,
lending, borrowing, leverage, or LP management method.

An approved strategy may request USDG release only during its valid fill. The vault checks the immutable strategy
identity and its recorded virtual budget, decrements/debits state before transfer, enforces physical balance, and
pays only the fill recipient supplied through the constrained strategy path. No administrator can call release or
select a recipient outside a fill.

Redemption is public and non-reentrant. No guardian, timelock, compliance operator, or deployer has a global pause
bit for it. Production eligibility can reject an ineligible account or receiver, but it does not create asset
withdrawal or basket-substitution authority.

## ProtocolTimelock

The timelock is controlled by a multisig and has two minimum delay classes:

- 48 hours for bounded maintenance, including a reference-rate reset within immutable safety bounds around the
  explicitly supplied, schedule-time baseline.
- Seven days for an exact acquisition/rewards deployment, a separate validated asset/strategy registration, or a
  canonical liquidity migration.

Permitted actions are limited to purpose-specific endpoints:

- deploy one exact `AcquisitionStrategy` and `ManagerRewards` pair through StrategyDeployer;
- register one manifest-validated asset with the exact emitted and provenance-checked pair within the asset cap;
- reset one auction reference within 50%–200% of the baseline read and committed at scheduling;
- commit and execute a constrained position migration to the predeclared canonical PoolKey;
- update non-economic metadata pointers, if present; and
- rotate the guardian through delayed action.

Registry disable and voter-cleanup selectors are deliberately absent from the timelock allowlist. Only the guardian's
atomic disable coordinator may perform those paired changes, so permissionless execution ordering cannot leave dead
weight receiving new allocation.

A generic timelock executor must not be granted roles on GumBallVault, GBXToken, EmissionController, claims,
ManagerRewards, or LiquidityManager. If an underlying timelock implementation supports arbitrary `execute`, each
privileged target must independently restrict the exact selector and arguments it accepts. An operator runbook is
not a substitute for target-side enforcement.

The timelock can never mint, change supply limits, pause redemption, alter past claims, redirect rewards, seize user
balances, transfer LP NFTs to an EOA, or execute arbitrary vault calls.

A reset operation encodes both `expectedReferenceRate` and `newReferenceRate`. Scheduling and public delay preflight
require the expected value to equal the strategy's live reference rate. Execution deliberately does not repeat that
equality check: a fill or permissionless auction restart during the 48-hour window cannot censor a mature reviewed
reset. The strategy instead bounds the new value to 50%–200% of the supplied expected baseline. Concurrently queued
resets are therefore all bounded to the same reviewed baseline and cannot compound 2x changes into 4x or 8x after one
delay. Reset execution is non-reentrant, so a token callback during a fill cannot consume an operation that the outer
fill would later overwrite.

### Typed strategy deployment and provenance

StrategyDeployer is a direct, non-upgradeable, purpose-specific provenance component, not a public factory. Only the
canonical ProtocolTimelock contract can call its deployment functions. It exposes no generic bytecode, constructor,
target-call, `delegatecall`, upgrade, ownership, or vault-execution endpoint.

The StrategyDeployer constructor commits immutable hashes and byte lengths of the exact compiler creation bytecode for
`AcquisitionStrategy`, `ManagerRewards`, `HoldUSDGStrategy`, and `BuybackBurnStrategy`, plus the exact count and ABI
hash of the reviewed ordered bootstrap target list. Deployment calldata supplies the corresponding unlinked compiler
artifact; the contract rejects any byte sequence whose length or hash differs, then appends only the typed constructor
graph and auction parameters. A single private assembly helper contains the isolated EVM `CREATE`. This keeps every
child a direct, non-proxy deployment without turning `CREATE` into a reusable execution primitive. Deployment and
release verification must rederive all commitments from compiled artifacts and deployment configuration and reject
any manifest mismatch or hidden bootstrap pair.

StrategyDeployer binds the registry, voter, vault, eligibility module, timelock, guardian, and GBX graph exactly once
and validates their reciprocal identities. Before launch, the one-use deployment initializer may call typed
ProtocolTimelock bootstrap endpoints to deploy the canonical inert HoldUSDG singleton, reviewed acquisition/reward
pairs, and canonical buyback-and-burn singleton. HoldUSDG and buyback each reject a second deployment. Finalization
requires both singletons, the immutable target count/hash, and exact deployment-order enumeration to match before it
persists the sealed count/hash and permanently closes every bootstrap endpoint. After finalization, the
ProtocolTimelock allowlist admits only the exact `deployAcquisition` selector on StrategyDeployer; it does not admit a
postlaunch HoldUSDG or buyback deployment.

A postlaunch asset addition is deliberately two serial operations:

1. The proposer schedules canonical `deployAcquisition` calldata against StrategyDeployer. The timelock rejects
   non-canonical ABI encoding, wrong compiler-bytecode hashes or lengths, a zero target, invalid lot bounds, or a zero
   initial reference rate. Execution is available only after seven days.
2. Operators obtain the actual strategy and rewards addresses from the deployment event and StrategyDeployer
   provenance mappings, verify their runtime code and complete immutable graph, and only then schedule
   `registerAsset` or `registerStockAsset` against AssetRegistry. They must not pre-register or rely on a guessed
   nonce-derived `CREATE` address.
3. The independent registration operation executes only after its own seven-day delay. AssetRegistry rechecks the
   current deployer graph, the exact target/strategy/rewards association, every recorded dependency, and both runtime
   code hashes atomically with admission.

The canonical HoldUSDG registration accepts only the recorded singleton and its recorded runtime hash. Standalone
registration accepts only the recorded buyback singleton and its complete graph/runtime provenance. Code presence,
interface-shaped getters, or a manifest claim alone never grants a contract live-strategy authority. The rationale
and rejected alternatives are recorded in
[ADR-0009](adr/0009-typed-strategy-deployment-provenance.md).

### Protocol-admin and emergency-guardian Safe evidence

The ProtocolTimelock proposer and EmergencyGuardian operator multisigs are treated as separate onchain control
planes, not merely addresses. Every nonlocal deployment config pins each Safe's proxy runtime hash, singleton address
and runtime hash, ordered owner set, threshold, guard, enabled modules, and fallback handler. The two Safe addresses
must be distinct. Each Safe must have at least two owners and threshold two or greater; enabled modules are forbidden
and guard/fallback must be zero. Its singleton and proxy runtime must match the fixed committed Safe control-plane
policy, which is currently an explicit unconfigured release blocker. Each protected phase authorization adds each
Safe's exact nonce and block number/hash/timestamp,
signs both evidence records, and requires the configured addresses to equal their respective onchain roles.

Preflight re-observes all of those surfaces at the signed historical block and at the current head. The unsigned Safe
schedule bundle must use the same protocol-admin Safe address, nonce, and evidence hash as the signed authorization;
its metadata also binds the reviewed guardian evidence. Release evidence is likewise bound to the signed release
observation block and reverified for both roles there and at the current head. Any singleton, bytecode, owner,
threshold, guard, module, fallback-handler, nonce, role, network, or block drift blocks the phase or release. Both
role records must use the same exact block number, hash, and timestamp. This
evidence does not broaden either Safe's authority: the typed target restrictions above remain the actual capability
boundary.

## EmergencyGuardian

The guardian may immediately reduce new exposure by:

- pausing new mining contributions;
- pausing an unsettled epoch only when contributors retain permissionless refunds;
- pausing acquisition fills or disabling acquisition for a broken asset;
- pausing new signal activations; and
- pausing liquidity additions or migrations.

During the timelock's one-shot target initialization, EmergencyGuardian permanently binds the canonical AssetRegistry
and AllocationVoter and validates their mutual role wiring. Disabling an asset or standalone strategy then updates the
registry and removes its live allocation weight/budget in one transaction. A cleanup failure reverts the registry
change, so emergency action cannot leave a disabled strategy as dead weight in the allocation denominator.

It cannot pause redemption, GBX burns, settled GBX claims, accrued reward claims, unstaking, signal reductions and
resets, refunds, or routing already-collected fees into the vault. Guardian actions emit complete events and do not
move assets.

EmergencyGuardian rejects a code-less operator in its constructor and during delayed rotation. That is only the
minimum contract-address check; runtime code presence alone does not prove that an address is a Safe or that its
owners, threshold, modules, guard, fallback handler, or singleton are approved. Before any future timelocked guardian
rotation is scheduled, operators must capture and review typed, block-pinned Safe evidence for the candidate, bind it
to the intended operator role and network, update the fixed singleton/proxy-runtime policy, and retain that evidence
with the rotation review.

## Revenue notification authority

Only GenesisBootstrap, MiningPool, RevenueRouter, and LiquidityManager may notify USDG revenue. A notification is
valid only for USDG newly and observably deposited into GumBallVault. Source is event metadata and never changes
allocation math. The handshake must prevent duplicate notification and preserve
`sum(strategy budgets) <= vault USDG balance`.

## Asset registration and rescue

Asset registration requires its own seven-day timelock operation, maximum-asset bound, unique token and strategy
addresses, official manifest verification, live bytecode, exact StrategyDeployer provenance, expected
metadata/UID/decimals, supported transfer behavior, and stock-token status checks. Every asset, including USDG and a
stock token, must have a nonzero `assetId` and `symbolHash`. At execution, `symbol()` must return canonical dynamic
string ABI data for a nonempty symbol of at most 32 bytes; every byte must be printable ASCII `0x21..0x7e` (space and
control/non-ASCII bytes are rejected), and `keccak256(bytes(symbol))` must equal the committed hash. Malformed or
reverting metadata therefore fails registration atomically rather than poisoning registry and client reads. The
guardian can disable future acquisition; neither guardian nor timelock can disable redemption while the vault holds
the asset.

Acquisition registration also requires the token's live decimals to equal both the manifest value and the exact
strategy's constructor-cached target decimals; its current USDG decimals must equal the strategy's cached USDG
decimals. Buyback admission performs the analogous USDG/GBX checks. Acquisition and buyback fills repeat the decimal
checks before value flow and after every callback-capable transfer/release boundary, so post-registration or
mid-transfer decimal drift reverts the entire fill rather than changing raw-unit economics.

Non-vault contracts may expose a timelock-only rescue for unsupported accidental tokens. Rescue rejects GBX, USDG,
registered targets, reward tokens, tokens owed to users, and LP position NFTs. GumBallVault has no rescue method, and
unexpected tokens sent there are not automatically registered.

## Liquidity authority

LiquidityManager owns the canonical position NFTs. It can initialize the guarded PoolKey, mint the configured
one-sided ladder, collect fees, route USDG to GumBallVault/allocation, burn GBX fees, sweep completed ranges to the
vault, and execute a precommitted migration after seven days.

Every principal and fee recipient is constrained in code. Position NFTs cannot move to an EOA. Removed USDG and GBX
can go only to GumBallVault or a replacement canonical position; any GBX not redeposited is burned. LiquidityManager
cannot redeem its GBX against GumBallVault or approve arbitrary spenders. No sequence of migrations can leave more than
16 canonical positions active at once; completed-range sweeps reduce the same onchain counter.

Integer v4 liquidity can leave a bounded, explicitly recorded genesis GBX residual. LiquidityManager custodies that
fully backed residual with ERC-20 and Permit2 approvals revoked; observed-delta fee and sweep paths cannot touch it.
The immutable GenesisLiquidityCalculator is stateless and has no token, callback, storage, or authority surface. A
later seven-day-timelocked migration may burn residual GBX only under the existing canonical migration rules.

## Eligibility authority

Local and testnet deployments use a NoopEligibilityModule. Mainnet must explicitly select a reviewed production
module after legal and issuer approval. If permissioning is required, it applies to GBX transfer, mining, staking,
reward receipt, redemption receipt, and canonical-pool trading.

The production registry owner, update delay, signer threshold, fail-open/fail-closed behavior, and account-level
appeal/recovery process must be documented in the final deployment manifest and threat model. Eligibility authority
does not receive mint, vault, reward-redirection, or liquidity authority.

Before bootstrap funding, deployment tooling checks live code and `canHold` for every contract that receives GBX in
the pinned flow: GenesisClaims, MiningClaims, LiquidityManager, StakedGBX, BuybackBurnStrategy, GumBallRouter, and
either the unrestricted PoolManager or the permissioned adapter that custodies underlying GBX. The signed deployment
state records the exact unique addresses and canonical rationale. PositionManager and Permit2 are transfer operators,
not GBX custodians. A permissioned-production release also requires explicit architecture review; an incomplete
holder set or missing code record blocks release approval.

ADR-0011's successor makes `PermissionedPoolController` the adapter owner from birth. Its only ongoing controls are
typed checker, fixed-wrapper, canonical-hook, and swap settings through ProtocolTimelock, plus guardian stop-only swap
and liquidity actions. Those controls can censor pool access but cannot mint, call the vault, redirect rewards or
positions, transfer assets, or execute arbitrary calldata. The hook resolves the actual account only through an
adapter-approved wrapper. The controller, checker, `PermissionedLiquidityManager`, Permissioned Position Manager,
Universal Router, both quoters, and fixed verification escrow are recorded individually; the escrow can recycle only
one wei to its immutable LiquidityManager. Schema v1 still does not release-authorize this authority graph; schema v2
requires the signed, raw-hash-bound graph, official-source build, and fresh Robinhood fork evidence before evaluating
the remaining release gates.

## Deployment role lifecycle

1. Deployment scripts create contracts with deterministic, reviewed wiring and derive StrategyDeployer's immutable
   creation-bytecode hash/length commitments from the exact compiled artifacts.
2. Scripts verify code at every external and newly deployed address, including child addresses obtained from typed
   deployment receipts and provenance rather than guessed `CREATE` addresses.
3. A deployment rehearsal asserts every role and forbidden role.
4. Timelock and guardian roles transfer to the intended multisigs.
5. Temporary deployer roles are renounced or proven irrelevant.
6. A public manifest records role holders, delays, code hashes, salts, constructors, transactions, and verification.
7. Independent reviewers reproduce the role scan before launch authorization.

Production remains blocked if any EOA, deployer, generic executor, or undocumented registry can mint GBX, move vault
assets, redirect rewards, seize user balances, or transfer canonical positions.
