# Contract API reference

> Generated from Foundry artifacts by `packages/contracts/scripts/generate-contract-docs.mjs`. Do not edit by
> hand. Run `pnpm docs:generate` after changing a public Solidity surface or NatSpec.

Compiler artifact versions: `0.8.26+commit.8a97fa7a`.

Documented source surfaces: 80. Documented ABI entries: 1558. Documented public ABI functions: 884.

## EmergencyGuardian

Source: [`src/access/EmergencyGuardian.sol`](../../packages/contracts/src/access/EmergencyGuardian.sol)

Artifact: `out/EmergencyGuardian.sol/EmergencyGuardian.json`

Public ABI: 19 functions, 12 events, 10 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(address protocolTimelock, address initialOperator);
```

Wires the purpose-limited timelock and initial incident-response signer.

**Parameters**

- `initialOperator`: The initial incident-response signer or multisig.
- `protocolTimelock`: The deployed ProtocolTimelock contract.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Purpose-limited timelock that binds targets and rotates the operator.

### `allocationVoter()`

```solidity
function allocationVoter() external view returns (contract IEmergencyAllocationVoter arg0);
```

Canonical one-shot-bound allocation voter.

### `assetRegistry()`

```solidity
function assetRegistry() external view returns (contract IEmergencyAssetRegistry arg0);
```

Canonical one-shot-bound asset registry.

### `disableAssetAcquisition(address)`

```solidity
function disableAssetAcquisition(address token) external;
```

Atomically disables future acquisition and removes the strategy from allocation accounting.
Voter cleanup is in the same transaction so a failed cleanup also rolls back the registry disable.

**Parameters**

- `token`: The registered target token whose acquisition path is disabled.

### `disableStandaloneStrategy(address)`

```solidity
function disableStandaloneStrategy(address strategy) external;
```

Atomically disables a standalone strategy and removes it from allocation accounting.
Voter cleanup is in the same transaction so a failed cleanup also rolls back the registry disable.

**Parameters**

- `strategy`: The registered standalone strategy to disable.

### `finalizePermissionedPoolController(address)`

```solidity
function finalizePermissionedPoolController(address controller) external;
```

Permanently binds the optional permissioned-pool stop target, or records unrestricted test mode.
Only ProtocolTimelock's one-use deployment initialization path can call this.

### `initializeTargets(address,address)`

```solidity
function initializeTargets(address registry, address voter) external;
```

Binds the canonical registry and allocation voter exactly once through ProtocolTimelock setup.
The target contracts must identify this guardian, this timelock, and each other consistently.

**Parameters**

- `registry`: The canonical AssetRegistry contract.
- `voter`: The canonical AllocationVoter contract.

### `invalidateMiningEpoch(address)`

```solidity
function invalidateMiningEpoch(address miningPool) external;
```

Invalidates the unsettled current epoch so every recorded contributor can refund.

**Parameters**

- `miningPool`: The canonical MiningPool contract.

### `operator()`

```solidity
function operator() external view returns (address arg0);
```

Current incident-response signer or multisig.

### `pauseLiquidityMigrations(address)`

```solidity
function pauseLiquidityMigrations(address liquidityManager) external;
```

Stops timelocked liquidity migrations without blocking fee collection or range sweeping.

**Parameters**

- `liquidityManager`: The canonical LiquidityManager contract.

### `pauseMiningContributions(address)`

```solidity
function pauseMiningContributions(address miningPool) external;
```

Stops new recurring mining contributions without affecting claims, refunds, or settlement.

**Parameters**

- `miningPool`: The canonical MiningPool contract.

### `pausePermissionedPoolLiquidity()`

```solidity
function pausePermissionedPoolLiquidity() external;
```

Stops future canonical permissioned liquidity additions without blocking position exits.

### `pausePermissionedPoolSwaps()`

```solidity
function pausePermissionedPoolSwaps() external;
```

Stops canonical permissioned-pool swaps without affecting redemption or liquidity exits.

### `pauseSignalActivations()`

```solidity
function pauseSignalActivations() external;
```

Stops matured signal increases; reductions, resets, and immediate unstaking stay available.

### `pauseStrategyFills(address)`

```solidity
function pauseStrategyFills(address strategy) external;
```

Stops new fills on one directly deployed acquisition or buyback strategy.

**Parameters**

- `strategy`: The directly deployed strategy contract.

### `permissionedPoolController()`

```solidity
function permissionedPoolController() external view returns (contract IEmergencyPermissionedPoolController arg0);
```

Optional canonical permissioned-pool stop target.

### `permissionedPoolControllerFinalized()`

```solidity
function permissionedPoolControllerFinalized() external view returns (bool arg0);
```

Whether the optional permissioned-pool target has been permanently declared.

### `rotateOperator(address)`

```solidity
function rotateOperator(address newOperator) external;
```

Rotates the incident-response signer only after a ProtocolTimelock operation matures.

**Parameters**

- `newOperator`: The replacement incident-response signer or multisig.

### `targetsInitialized()`

```solidity
function targetsInitialized() external view returns (bool arg0);
```

Whether the canonical registry and voter have been permanently bound.

### Events

#### `EmergencyGuardian__AssetAcquisitionDisabled(address,address,address,address)`

```solidity
event EmergencyGuardian__AssetAcquisitionDisabled(address indexed registry, address indexed allocationVoter, address indexed token, address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__LiquidityMigrationsPaused(address)`

```solidity
event EmergencyGuardian__LiquidityMigrationsPaused(address indexed liquidityManager);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__MiningContributionsPaused(address)`

```solidity
event EmergencyGuardian__MiningContributionsPaused(address indexed miningPool);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__MiningEpochInvalidated(address)`

```solidity
event EmergencyGuardian__MiningEpochInvalidated(address indexed miningPool);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__OperatorRotated(address,address)`

```solidity
event EmergencyGuardian__OperatorRotated(address indexed previousOperator, address indexed newOperator);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__PermissionedPoolControllerFinalized(address)`

```solidity
event EmergencyGuardian__PermissionedPoolControllerFinalized(address indexed controller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__PermissionedPoolLiquidityDisabled(address)`

```solidity
event EmergencyGuardian__PermissionedPoolLiquidityDisabled(address indexed controller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__PermissionedPoolSwappingDisabled(address)`

```solidity
event EmergencyGuardian__PermissionedPoolSwappingDisabled(address indexed controller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__SignalActivationsPaused(address)`

```solidity
event EmergencyGuardian__SignalActivationsPaused(address indexed allocationVoter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__StandaloneStrategyDisabled(address,address,address)`

```solidity
event EmergencyGuardian__StandaloneStrategyDisabled(address indexed registry, address indexed allocationVoter, address indexed strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__StrategyFillsPaused(address)`

```solidity
event EmergencyGuardian__StrategyFillsPaused(address indexed strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__TargetsInitialized(address,address)`

```solidity
event EmergencyGuardian__TargetsInitialized(address indexed registry, address indexed allocationVoter);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `EmergencyGuardian__AssetHasNoStrategy(address)`

```solidity
error EmergencyGuardian__AssetHasNoStrategy(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__InvalidTargetWiring(address)`

```solidity
error EmergencyGuardian__InvalidTargetWiring(address target);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__NotOperator(address)`

```solidity
error EmergencyGuardian__NotOperator(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__NotProtocolTimelock(address)`

```solidity
error EmergencyGuardian__NotProtocolTimelock(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__PermissionedPoolControllerAlreadyFinalized()`

```solidity
error EmergencyGuardian__PermissionedPoolControllerAlreadyFinalized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__PermissionedPoolControllerNotConfigured()`

```solidity
error EmergencyGuardian__PermissionedPoolControllerNotConfigured();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__TargetMustBeContract(address)`

```solidity
error EmergencyGuardian__TargetMustBeContract(address target);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__TargetsAlreadyInitialized()`

```solidity
error EmergencyGuardian__TargetsAlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__TargetsNotInitialized()`

```solidity
error EmergencyGuardian__TargetsNotInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__ZeroAddress()`

```solidity
error EmergencyGuardian__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

## NoopEligibilityModule

Source: [`src/access/NoopEligibilityModule.sol`](../../packages/contracts/src/access/NoopEligibilityModule.sol)

Artifact: `out/NoopEligibilityModule.sol/NoopEligibilityModule.json`

Public ABI: 3 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `canHold(address)`

```solidity
function canHold(address arg0) external pure returns (bool arg0);
```

Returns whether an account may hold GBX and basket assets.

**Parameters**

- `account`: The candidate holder.

**Returns**

- `_0`: Whether the account may hold protocol assets.

### `canRedeem(address)`

```solidity
function canRedeem(address arg0) external pure returns (bool arg0);
```

Returns whether an account may receive an in-kind basket redemption.

**Parameters**

- `account`: The proposed redemption receiver.

**Returns**

- `_0`: Whether the account may redeem.

### `canTransfer(address,address,uint256)`

```solidity
function canTransfer(address arg0, address arg1, uint256 arg2) external pure returns (bool arg0);
```

Returns whether a GBX transfer is permitted.

**Parameters**

- `amount`: The raw token amount.
- `from`: The token sender.
- `to`: The token receiver.

**Returns**

- `_0`: Whether the transfer is permitted.

## IReferenceRateStrategy

Source: [`src/access/ProtocolTimelock.sol`](../../packages/contracts/src/access/ProtocolTimelock.sol)

Artifact: `out/ProtocolTimelock.sol/IReferenceRateStrategy.json`

Public ABI: 1 function, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `referenceRate()`

```solidity
function referenceRate() external view returns (uint256 arg0);
```

Returns the live human-normalized auction reference rate committed by a reset schedule.

**Returns**

- `_0`: rate The current reference rate scaled by 1e18.

## ProtocolTimelock

Source: [`src/access/ProtocolTimelock.sol`](../../packages/contracts/src/access/ProtocolTimelock.sol)

Artifact: `out/ProtocolTimelock.sol/ProtocolTimelock.json`

Public ABI: 27 functions, 6 events, 25 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(address proposerMultisig, address deploymentInitializer);
```

Sets immutable scheduling authority and a one-use prelaunch target initializer.

**Parameters**

- `deploymentInitializer`: The one-use account permitted to bind protocol targets before launch.
- `proposerMultisig`: The only account permitted to schedule or cancel operations.

### `BOUNDED_MAINTENANCE_DELAY()`

```solidity
function BOUNDED_MAINTENANCE_DELAY() external view returns (uint256 arg0);
```

Delay for bounded maintenance operations such as unpausing or rate reset.

### `CRITICAL_CHANGE_DELAY()`

```solidity
function CRITICAL_CHANGE_DELAY() external view returns (uint256 arg0);
```

Delay for asset registration and canonical liquidity migration.

### `DEPLOYMENT_INITIALIZER()`

```solidity
function DEPLOYMENT_INITIALIZER() external view returns (address arg0);
```

One-use prelaunch account permitted to bind the canonical target graph.

### `EXECUTION_GRACE_PERIOD()`

```solidity
function EXECUTION_GRACE_PERIOD() external view returns (uint256 arg0);
```

Window after maturity during which a scheduled operation remains executable.

### `PROPOSER_MULTISIG()`

```solidity
function PROPOSER_MULTISIG() external view returns (address arg0);
```

Immutable multisig permitted to schedule and cancel maintenance operations.

### `allocationVoter()`

```solidity
function allocationVoter() external view returns (address arg0);
```

Canonical allocation voter after target initialization.

### `assetRegistry()`

```solidity
function assetRegistry() external view returns (contract IAssetRegistry arg0);
```

Canonical bounded asset and strategy registry after target initialization.

### `bootstrapDeployAcquisition(bytes,bytes,address,uint256,uint256,uint256)`

```solidity
function bootstrapDeployAcquisition(bytes strategyCreationCode, bytes rewardsCreationCode, address targetToken, uint256 minimumLotUSDG, uint256 maximumLotUSDG, uint256 initialReferenceRate) external returns (address strategy, address rewards);
```

Prelaunch-only typed deployment of one exact acquisition/reward pair.
Only the immutable deployment initializer may use this path, and only before bootstrap finalization. StrategyDeployer authenticates both creation-code commitments and permanently binds the returned pair.

**Parameters**

- `initialReferenceRate`: Initial target-token-units-per-USDG auction reference rate.
- `maximumLotUSDG`: Largest USDG lot the strategy may release in one fill.
- `minimumLotUSDG`: Smallest USDG lot the strategy may release in one fill.
- `rewardsCreationCode`: Exact committed ManagerRewards compiler creation bytecode.
- `strategyCreationCode`: Exact committed AcquisitionStrategy compiler creation bytecode.
- `targetToken`: Canonical target asset for the new acquisition strategy.

**Returns**

- `rewards`: The directly deployed and reciprocally bound ManagerRewards address.
- `strategy`: The directly deployed AcquisitionStrategy address.

### `bootstrapDeployBuyback(bytes,uint256,uint256,uint256)`

```solidity
function bootstrapDeployBuyback(bytes creationCode, uint256 minimumLotUSDG, uint256 maximumLotUSDG, uint256 initialReferenceRate) external returns (address strategy);
```

Prelaunch-only typed deployment of the one canonical GBX buyback-and-burn strategy.
Only the immutable deployment initializer may use this path, and only before bootstrap finalization. StrategyDeployer authenticates the exact compiler creation bytecode and rejects a second singleton.

**Parameters**

- `creationCode`: Exact committed BuybackBurnStrategy compiler creation bytecode.
- `initialReferenceRate`: Initial GBX-units-per-USDG auction reference rate.
- `maximumLotUSDG`: Largest USDG lot the strategy may release in one fill.
- `minimumLotUSDG`: Smallest USDG lot the strategy may release in one fill.

**Returns**

- `strategy`: The directly deployed canonical BuybackBurnStrategy address.

### `bootstrapDeployHoldUSDG(bytes)`

```solidity
function bootstrapDeployHoldUSDG(bytes creationCode) external returns (address strategy);
```

Prelaunch-only typed deployment of the one inert USDG-hold signal target.
Only the immutable deployment initializer may use this path, and only before bootstrap finalization. StrategyDeployer authenticates the exact compiler creation bytecode and rejects a second singleton.

**Parameters**

- `creationCode`: Exact committed HoldUSDGStrategy compiler creation bytecode.

**Returns**

- `strategy`: The directly deployed canonical HoldUSDGStrategy address.

### `cancel(bytes32)`

```solidity
function cancel(bytes32 operationId) external;
```

Cancels a queued operation through the same immutable multisig.

**Parameters**

- `operationId`: The identifier returned by `schedule` or `hashOperation`.

### `emergencyGuardian()`

```solidity
function emergencyGuardian() external view returns (address arg0);
```

Canonical stop-only guardian after target initialization.

### `execute(address,bytes,bytes32)`

```solidity
function execute(address target, bytes data, bytes32 salt) external returns (bytes returnData);
```

Permissionlessly executes one mature, non-expired, still-authorized maintenance operation.

**Parameters**

- `data`: The exact calldata committed when the operation was scheduled.
- `salt`: The exact salt committed when the operation was scheduled.
- `target`: The exact target committed when the operation was scheduled.

**Returns**

- `returnData`: The raw bytes returned by the target call.

### `finalizePermissionedPoolController(address)`

```solidity
function finalizePermissionedPoolController(address controller) external;
```

Permanently binds the optional permissioned-pool controller, or commits to unrestricted test mode.
Closing this slot before strategy-bootstrap finalization makes DEPLOYMENT_INITIALIZER irrelevant afterward.

### `finalizeStrategyBootstrap(address[])`

```solidity
function finalizeStrategyBootstrap(address[] expectedAcquisitionTargets) external;
```

Permanently closes the prelaunch deployment window after both singleton strategies exist.
Revalidates the singleton runtime hashes and complete dependency graph before closing both the ProtocolTimelock and StrategyDeployer bootstrap paths. The transition is irreversible.

**Parameters**

- `expectedAcquisitionTargets`: Exact reviewed acquisition-target list in deployment order.

### `hashOperation(address,bytes,bytes32)`

```solidity
function hashOperation(address target, bytes data, bytes32 salt) external view returns (bytes32 operationId);
```

Returns the chain-bound operation identifier.

**Parameters**

- `data`: The complete selector and ABI-encoded arguments.
- `salt`: A caller-selected operation discriminator.
- `target`: The intended operation target.

**Returns**

- `operationId`: The deterministic chain- and timelock-bound identifier.

### `initializeTargets(address,address,address,address,address,address)`

```solidity
function initializeTargets(address assetRegistryAddress, address emergencyGuardianAddress, address allocationVoterAddress, address miningPoolAddress, address liquidityManagerAddress, address strategyDeployerAddress) external;
```

Fixes the complete set of non-strategy maintenance targets exactly once before launch.

**Parameters**

- `allocationVoterAddress`: The canonical AllocationVoter contract.
- `assetRegistryAddress`: The canonical AssetRegistry contract.
- `emergencyGuardianAddress`: The canonical EmergencyGuardian contract.
- `liquidityManagerAddress`: The canonical LiquidityManager contract.
- `miningPoolAddress`: The canonical MiningPool contract.
- `strategyDeployerAddress`: The canonical typed exact-bytecode StrategyDeployer contract.

### `liquidityManager()`

```solidity
function liquidityManager() external view returns (address arg0);
```

Canonical protocol-owned v4 liquidity manager after target initialization.

### `miningPool()`

```solidity
function miningPool() external view returns (address arg0);
```

Canonical recurring mining pool after target initialization.

### `operationReadyAt(bytes32)`

```solidity
function operationReadyAt(bytes32 operationId) external view returns (uint64 readyAt);
```

Maturity timestamp for each scheduled operation ID, or zero when unscheduled.

### `permissionedPoolController()`

```solidity
function permissionedPoolController() external view returns (contract IPermissionedPoolController arg0);
```

Optional typed permissioned-pool maintenance target.

### `permissionedPoolControllerFinalized()`

```solidity
function permissionedPoolControllerFinalized() external view returns (bool arg0);
```

Whether the optional permissioned-pool target has been permanently declared.

### `requiredDelay(address,bytes)`

```solidity
function requiredDelay(address target, bytes data) external view returns (uint256 delay);
```

Returns the enforced delay for an operation, reverting if the target or selector is unsupported.

**Parameters**

- `data`: The proposed complete operation calldata.
- `target`: The proposed canonical protocol target.

**Returns**

- `delay`: The minimum number of seconds the operation must remain queued.

### `schedule(address,bytes,bytes32)`

```solidity
function schedule(address target, bytes data, bytes32 salt) external returns (bytes32 operationId);
```

Queues one hard-coded maintenance operation under its enforced minimum delay.

**Parameters**

- `data`: The complete selector and ABI-encoded arguments committed by the schedule.
- `salt`: A caller-selected value that distinguishes otherwise identical operations.
- `target`: The canonical protocol contract that will receive the operation.

**Returns**

- `operationId`: The chain- and timelock-bound identifier for the scheduled operation.

### `strategyBootstrapFinalized()`

```solidity
function strategyBootstrapFinalized() external view returns (bool arg0);
```

Whether the one-use prelaunch strategy deployment window has been permanently closed.

### `strategyDeployer()`

```solidity
function strategyDeployer() external view returns (contract IStrategyDeployer arg0);
```

Canonical typed exact-bytecode strategy deployer after target initialization.

### `targetsInitialized()`

```solidity
function targetsInitialized() external view returns (bool arg0);
```

Whether every fixed maintenance target has been bound exactly once.

### Events

#### `ProtocolTimelock__OperationCancelled(bytes32)`

```solidity
event ProtocolTimelock__OperationCancelled(bytes32 indexed operationId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__OperationExecuted(bytes32,address,bytes4,bytes32,bytes32)`

```solidity
event ProtocolTimelock__OperationExecuted(bytes32 indexed operationId, address indexed target, bytes4 indexed selector, bytes32 dataHash, bytes32 salt);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__OperationScheduled(bytes32,address,bytes4,bytes32,bytes32,uint256,uint256)`

```solidity
event ProtocolTimelock__OperationScheduled(bytes32 indexed operationId, address indexed target, bytes4 indexed selector, bytes32 dataHash, bytes32 salt, uint256 readyAt, uint256 delay);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__PermissionedPoolControllerFinalized(address)`

```solidity
event ProtocolTimelock__PermissionedPoolControllerFinalized(address indexed controller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__StrategyBootstrapFinalized(address,address)`

```solidity
event ProtocolTimelock__StrategyBootstrapFinalized(address indexed holdUSDG, address indexed buybackBurn);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__TargetsInitialized(address,address,address,address,address,address)`

```solidity
event ProtocolTimelock__TargetsInitialized(address indexed assetRegistry, address indexed emergencyGuardian, address indexed allocationVoter, address miningPool, address liquidityManager, address strategyDeployer);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `ProtocolTimelock__AlreadyScheduled(bytes32)`

```solidity
error ProtocolTimelock__AlreadyScheduled(bytes32 operationId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__DataLengthMismatch(bytes4,uint256)`

```solidity
error ProtocolTimelock__DataLengthMismatch(bytes4 selector, uint256 actualLength);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__ExecutionExpired(bytes32,uint256)`

```solidity
error ProtocolTimelock__ExecutionExpired(bytes32 operationId, uint256 expiresAt);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__ExecutionFailed(bytes32,bytes)`

```solidity
error ProtocolTimelock__ExecutionFailed(bytes32 operationId, bytes reason);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__InvalidMigrationCalldata()`

```solidity
error ProtocolTimelock__InvalidMigrationCalldata();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__InvalidMigrationPoolKey(bytes32,bytes32)`

```solidity
error ProtocolTimelock__InvalidMigrationPoolKey(bytes32 expected, bytes32 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__InvalidStrategyDeploymentCalldata()`

```solidity
error ProtocolTimelock__InvalidStrategyDeploymentCalldata();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__InvalidStrategyRegistrationProvenance(address)`

```solidity
error ProtocolTimelock__InvalidStrategyRegistrationProvenance(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__InvalidTarget(address)`

```solidity
error ProtocolTimelock__InvalidTarget(address target);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__NotReady(bytes32,uint256)`

```solidity
error ProtocolTimelock__NotReady(bytes32 operationId, uint256 readyAt);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__NotScheduled(bytes32)`

```solidity
error ProtocolTimelock__NotScheduled(bytes32 operationId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__PermissionedPoolControllerAlreadyFinalized()`

```solidity
error ProtocolTimelock__PermissionedPoolControllerAlreadyFinalized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__PermissionedPoolControllerNotFinalized()`

```solidity
error ProtocolTimelock__PermissionedPoolControllerNotFinalized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__ReferenceRateBaselineMismatch(address,uint256,uint256)`

```solidity
error ProtocolTimelock__ReferenceRateBaselineMismatch(address strategy, uint256 expected, uint256 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__StrategyBootstrapAlreadyFinalized()`

```solidity
error ProtocolTimelock__StrategyBootstrapAlreadyFinalized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__StrategyBootstrapIncomplete()`

```solidity
error ProtocolTimelock__StrategyBootstrapIncomplete();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__StrategyBootstrapNotFinalized()`

```solidity
error ProtocolTimelock__StrategyBootstrapNotFinalized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__TargetsAlreadyInitialized()`

```solidity
error ProtocolTimelock__TargetsAlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__TargetsNotInitialized()`

```solidity
error ProtocolTimelock__TargetsNotInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__UnauthorizedInitializer(address)`

```solidity
error ProtocolTimelock__UnauthorizedInitializer(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__UnauthorizedProposer(address)`

```solidity
error ProtocolTimelock__UnauthorizedProposer(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__UnsupportedOperation(address,bytes4)`

```solidity
error ProtocolTimelock__UnsupportedOperation(address target, bytes4 selector);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__ZeroAddress()`

```solidity
error ProtocolTimelock__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeCastOverflowedUintDowncast(uint8,uint256)`

```solidity
error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

## RegistryEligibilityModule

Source: [`src/access/RegistryEligibilityModule.sol`](../../packages/contracts/src/access/RegistryEligibilityModule.sol)

Artifact: `out/RegistryEligibilityModule.sol/RegistryEligibilityModule.json`

Public ABI: 4 functions, 0 events, 2 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address)`

```solidity
constructor(address registry_);
```

Wires the production registry once at deployment.

**Parameters**

- `registry_`: Counsel- and issuer-approved registry contract.

### `ELIGIBILITY_REGISTRY()`

```solidity
function ELIGIBILITY_REGISTRY() external view returns (contract IEligibilityRegistry arg0);
```

Immutable external compliance registry queried by every eligibility decision.

### `canHold(address)`

```solidity
function canHold(address account) external view returns (bool arg0);
```

Returns whether an account may hold GBX and basket assets.

**Parameters**

- `account`: The candidate holder.

**Returns**

- `_0`: Whether the account may hold protocol assets.

### `canRedeem(address)`

```solidity
function canRedeem(address account) external view returns (bool arg0);
```

Returns whether an account may receive an in-kind basket redemption.

**Parameters**

- `account`: The proposed redemption receiver.

**Returns**

- `_0`: Whether the account may redeem.

### `canTransfer(address,address,uint256)`

```solidity
function canTransfer(address from, address to, uint256 amount) external view returns (bool arg0);
```

Returns whether a GBX transfer is permitted.

**Parameters**

- `amount`: The raw token amount.
- `from`: The token sender.
- `to`: The token receiver.

**Returns**

- `_0`: Whether the transfer is permitted.

### Custom errors

#### `RegistryEligibilityModule__RegistryHasNoCode(address)`

```solidity
error RegistryEligibilityModule__RegistryHasNoCode(address registry);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RegistryEligibilityModule__ZeroRegistry()`

```solidity
error RegistryEligibilityModule__ZeroRegistry();
```

_No additional NatSpec notice is present in the compiled artifact._

## IAcquisitionAllocationVoter

Source: [`src/interfaces/IAcquisitionAllocationVoter.sol`](../../packages/contracts/src/interfaces/IAcquisitionAllocationVoter.sol)

Artifact: `out/IAcquisitionAllocationVoter.sol/IAcquisitionAllocationVoter.json`

Public ABI: 2 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `checkpointStrategyBudget(address)`

```solidity
function checkpointStrategyBudget(address strategy) external returns (uint256 budget);
```

Materializes and returns one strategy's current virtual USDG budget.

**Parameters**

- `strategy`: The strategy whose budget is checkpointed.

**Returns**

- `budget`: The raw USDG virtual budget after checkpointing.

### `strategyBudget(address)`

```solidity
function strategyBudget(address strategy) external view returns (uint256 budget);
```

Returns one strategy's last materialized virtual USDG budget.

**Parameters**

- `strategy`: The strategy whose stored budget is queried.

**Returns**

- `budget`: The raw stored USDG virtual budget.

## IAllocationVoter

Source: [`src/interfaces/IAllocationVoter.sol`](../../packages/contracts/src/interfaces/IAllocationVoter.sol)

Artifact: `out/IAllocationVoter.sol/IAllocationVoter.json`

Public ABI: 4 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `consumeStrategyBudget(address,uint256)`

```solidity
function consumeStrategyBudget(address strategy, uint256 amount) external;
```

Consumes a strategy's virtual USDG budget before the vault releases physical USDG.
Must only be callable by the immutable GumBallVault.

**Parameters**

- `amount`: The raw USDG budget amount consumed.
- `strategy`: The live strategy spending its budget.

### `onStake(address)`

```solidity
function onStake(address user) external;
```

Checkpoints a user's matured signals and rewards immediately before sGBX is minted.
Must only be called by the immutable StakedGBX contract.

**Parameters**

- `user`: The account receiving newly staked sGBX.

### `onUnstake(address,uint256)`

```solidity
function onUnstake(address user, uint256 amount) external;
```

Removes enough pending and active signal weight before sGBX is burned.
Must only be called by StakedGBX and must leave assigned weight within the post-unstake balance.

**Parameters**

- `amount`: The amount of sGBX being burned.
- `user`: The account unstaking sGBX.

### `scaleBudgetsAfterRedemption(uint256,uint256)`

```solidity
function scaleBudgetsAfterRedemption(uint256 shares, uint256 supplyBefore) external;
```

Scales every virtual budget by (supplyBefore - shares) / supplyBefore before a redemption burn.
The strategy universe is bounded, so the implementation may checkpoint and iterate over all live strategies.

**Parameters**

- `shares`: The GBX shares being redeemed.
- `supplyBefore`: The total GBX supply before the redemption burn.

## IAllocationVoterRewards

Source: [`src/interfaces/IAllocationVoterRewards.sol`](../../packages/contracts/src/interfaces/IAllocationVoterRewards.sol)

Artifact: `out/IAllocationVoterRewards.sol/IAllocationVoterRewards.json`

Public ABI: 4 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `activeWeight(address,address)`

```solidity
function activeWeight(address user, address strategy) external view returns (uint256 arg0);
```

Returns the user's current effective active signal weight for one strategy.

**Parameters**

- `strategy`: The directly deployed strategy address.
- `user`: The signal account.

**Returns**

- `_0`: The user's effective active weight.

### `checkpointUser(address)`

```solidity
function checkpointUser(address user) external;
```

Activates matured pending signals and checkpoints every associated reward accumulator for a user.

**Parameters**

- `user`: The signal account to checkpoint.

### `rewardWeight(address,address)`

```solidity
function rewardWeight(address user, address strategy) external view returns (uint256 weight, uint64 generation);
```

Returns the stored weight and generation still entitled to an uncheckpointed reward index.
Unlike `activeWeight`, this view deliberately exposes stale pre-disable weight until it is checkpointed.

**Parameters**

- `strategy`: The directly deployed strategy address.
- `user`: The signal account.

**Returns**

- `generation`: The generation in which that weight was active.
- `weight`: The stored current- or prior-generation weight used for reward settlement.

### `strategyWeight(address)`

```solidity
function strategyWeight(address strategy) external view returns (uint256 arg0);
```

Returns the current effective aggregate signal weight for a strategy.

**Parameters**

- `strategy`: The directly deployed strategy address.

**Returns**

- `_0`: The aggregate active sGBX weight.

## IAssetRegistry

Source: [`src/interfaces/IAssetRegistry.sol`](../../packages/contracts/src/interfaces/IAssetRegistry.sol)

Artifact: `out/IAssetRegistry.sol/IAssetRegistry.json`

Public ABI: 9 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `assetAt(uint256)`

```solidity
function assetAt(uint256 index) external view returns (address arg0);
```

Returns the registered token address at a bounded index.

**Parameters**

- `index`: The zero-based asset index.

**Returns**

- `_0`: The registered token address.

### `assetCount()`

```solidity
function assetCount() external view returns (uint256 arg0);
```

Returns the number of registered assets.

**Returns**

- `_0`: The bounded asset count.

### `configFor(address)`

```solidity
function configFor(address token) external view returns (struct IAssetRegistry.AssetConfig arg0);
```

Returns the full configuration for a registered token.

**Parameters**

- `token`: The registered token address.

**Returns**

- `_0`: The asset configuration.

### `isLiveStrategy(address)`

```solidity
function isLiveStrategy(address strategy) external view returns (bool arg0);
```

Returns whether a directly deployed strategy is registered and acquisition-enabled.

**Parameters**

- `strategy`: The candidate strategy address.

**Returns**

- `_0`: Whether the strategy is live.

### `isRegisteredAsset(address)`

```solidity
function isRegisteredAsset(address token) external view returns (bool arg0);
```

Returns whether the address is a registered asset token.

**Parameters**

- `token`: The candidate token address.

**Returns**

- `_0`: Whether the token is registered.

### `stockTokenDependencyFor(address)`

```solidity
function stockTokenDependencyFor(address token) external view returns (struct IAssetRegistry.StockTokenDependency arg0);
```

Returns the immutable registration-time beacon identity for a stock token.

**Parameters**

- `token`: The registered stock-token proxy address.

**Returns**

- `_0`: The registration-time token, beacon, implementation, and multiplier identity.

### `strategyAt(uint256)`

```solidity
function strategyAt(uint256 index) external view returns (address arg0);
```

Returns a directly deployed strategy at a bounded index.

**Parameters**

- `index`: The zero-based strategy index.

**Returns**

- `_0`: The directly deployed strategy address.

### `strategyCount()`

```solidity
function strategyCount() external view returns (uint256 arg0);
```

Returns the number of directly deployed signal strategies, including standalone buyback.

**Returns**

- `_0`: The bounded strategy count.

### `tokenForStrategy(address)`

```solidity
function tokenForStrategy(address strategy) external view returns (address arg0);
```

Returns the registered asset token associated with a directly deployed strategy.

**Parameters**

- `strategy`: The directly deployed strategy address.

**Returns**

- `_0`: The associated token, or zero for a standalone strategy.

## IBuybackAllocationVoter

Source: [`src/interfaces/IBuybackAllocationVoter.sol`](../../packages/contracts/src/interfaces/IBuybackAllocationVoter.sol)

Artifact: `out/IBuybackAllocationVoter.sol/IBuybackAllocationVoter.json`

Public ABI: 2 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `checkpointStrategyBudget(address)`

```solidity
function checkpointStrategyBudget(address strategy) external returns (uint256 budget);
```

Materializes and returns one strategy's current virtual USDG budget.

**Parameters**

- `strategy`: The strategy whose budget is checkpointed.

**Returns**

- `budget`: The raw USDG virtual budget after checkpointing.

### `strategyBudget(address)`

```solidity
function strategyBudget(address strategy) external view returns (uint256 budget);
```

Returns one strategy's last materialized virtual USDG budget.

**Parameters**

- `strategy`: The strategy whose stored budget is queried.

**Returns**

- `budget`: The raw stored USDG virtual budget.

## IClaimsSource

Source: [`src/interfaces/IClaimsSource.sol`](../../packages/contracts/src/interfaces/IClaimsSource.sol)

Artifact: `out/IClaimsSource.sol/IClaimsSource.json`

Public ABI: 1 function, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `claimData(uint256,address)`

```solidity
function claimData(uint256 distributionId, address beneficiary) external view returns (uint256 entitlement, uint256 totalAllocation, uint64 settledAt, bool settled);
```

Returns one beneficiary's settled entitlement and distribution metadata.

**Parameters**

- `beneficiary`: The recorded contribution beneficiary.
- `distributionId`: Zero for genesis or the post-genesis mining epoch ID.

**Returns**

- `entitlement`: The beneficiary's pro-rata GBX entitlement.
- `settled`: Whether the distribution has settled and its allocation is final.
- `settledAt`: The settlement timestamp used for claim expiry.
- `totalAllocation`: The complete GBX allocation minted for the distribution.

## IEligibilityModule

Source: [`src/interfaces/IEligibilityModule.sol`](../../packages/contracts/src/interfaces/IEligibilityModule.sol)

Artifact: `out/IEligibilityModule.sol/IEligibilityModule.json`

Public ABI: 3 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `canHold(address)`

```solidity
function canHold(address account) external view returns (bool arg0);
```

Returns whether an account may hold GBX and basket assets.

**Parameters**

- `account`: The candidate holder.

**Returns**

- `_0`: Whether the account may hold protocol assets.

### `canRedeem(address)`

```solidity
function canRedeem(address account) external view returns (bool arg0);
```

Returns whether an account may receive an in-kind basket redemption.

**Parameters**

- `account`: The proposed redemption receiver.

**Returns**

- `_0`: Whether the account may redeem.

### `canTransfer(address,address,uint256)`

```solidity
function canTransfer(address from, address to, uint256 amount) external view returns (bool arg0);
```

Returns whether a GBX transfer is permitted.

**Parameters**

- `amount`: The raw token amount.
- `from`: The token sender.
- `to`: The token receiver.

**Returns**

- `_0`: Whether the transfer is permitted.

## IEligibilityRegistry

Source: [`src/interfaces/IEligibilityRegistry.sol`](../../packages/contracts/src/interfaces/IEligibilityRegistry.sol)

Artifact: `out/IEligibilityRegistry.sol/IEligibilityRegistry.json`

Public ABI: 3 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `canHold(address)`

```solidity
function canHold(address account) external view returns (bool arg0);
```

Returns whether an account is permitted to hold regulated assets.

**Parameters**

- `account`: The candidate holder.

**Returns**

- `_0`: Whether the account may hold regulated assets.

### `canRedeem(address)`

```solidity
function canRedeem(address account) external view returns (bool arg0);
```

Returns whether an account is permitted to receive redemption assets.

**Parameters**

- `account`: The proposed redemption receiver.

**Returns**

- `_0`: Whether the account may redeem.

### `canTransfer(address,address,uint256)`

```solidity
function canTransfer(address from, address to, uint256 amount) external view returns (bool arg0);
```

Returns whether a transfer between two accounts is permitted.

**Parameters**

- `amount`: The raw token amount.
- `from`: The token sender.
- `to`: The token receiver.

**Returns**

- `_0`: Whether the transfer is permitted.

## IEmergencyAllocationVoter

Source: [`src/interfaces/IEmergencyAllocationVoter.sol`](../../packages/contracts/src/interfaces/IEmergencyAllocationVoter.sol)

Artifact: `out/IEmergencyAllocationVoter.sol/IEmergencyAllocationVoter.json`

Public ABI: 5 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `ASSET_REGISTRY()`

```solidity
function ASSET_REGISTRY() external view returns (address arg0);
```

Returns the voter's immutable asset registry.

**Returns**

- `_0`: The asset registry address.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Returns the voter's immutable emergency guardian.

**Returns**

- `_0`: The emergency guardian address.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Returns the voter's immutable protocol timelock.

**Returns**

- `_0`: The protocol timelock address.

### `disableStrategy(address)`

```solidity
function disableStrategy(address strategy) external;
```

Removes a registry-disabled strategy from live allocation accounting.

**Parameters**

- `strategy`: The disabled strategy address.

### `pauseSignalActivations()`

```solidity
function pauseSignalActivations() external;
```

Pauses maturation of pending signal increases.

## IEmergencyAssetRegistry

Source: [`src/interfaces/IEmergencyAssetRegistry.sol`](../../packages/contracts/src/interfaces/IEmergencyAssetRegistry.sol)

Artifact: `out/IEmergencyAssetRegistry.sol/IEmergencyAssetRegistry.json`

Public ABI: 5 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Returns the registry's immutable emergency guardian.

**Returns**

- `_0`: The emergency guardian address.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Returns the registry's immutable protocol timelock.

**Returns**

- `_0`: The protocol timelock address.

### `configFor(address)`

```solidity
function configFor(address token) external view returns (struct IAssetRegistry.AssetConfig arg0);
```

Returns the immutable registry metadata for a token.

**Parameters**

- `token`: The registered token address.

**Returns**

- `_0`: The asset configuration.

### `disableAcquisition(address)`

```solidity
function disableAcquisition(address token) external;
```

Disables new acquisition for a registered token.

**Parameters**

- `token`: The registered token whose acquisition strategy is disabled.

### `disableStandaloneStrategy(address)`

```solidity
function disableStandaloneStrategy(address strategy) external;
```

Disables a registered standalone strategy.

**Parameters**

- `strategy`: The standalone strategy address.

## IEmergencyGuardianTargetInitializer

Source: [`src/interfaces/IEmergencyGuardianTargetInitializer.sol`](../../packages/contracts/src/interfaces/IEmergencyGuardianTargetInitializer.sol)

Artifact: `out/IEmergencyGuardianTargetInitializer.sol/IEmergencyGuardianTargetInitializer.json`

Public ABI: 2 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `finalizePermissionedPoolController(address)`

```solidity
function finalizePermissionedPoolController(address controller) external;
```

Permanently binds the permissioned-pool stop target, or records that this deployment has none.

**Parameters**

- `controller`: Canonical PermissionedPoolController, or zero for unrestricted test mode.

### `initializeTargets(address,address)`

```solidity
function initializeTargets(address registry, address allocationVoter) external;
```

Binds the guardian's canonical registry and voter.

**Parameters**

- `allocationVoter`: The canonical AllocationVoter contract.
- `registry`: The canonical AssetRegistry contract.

## IEmergencyLiquidityManager

Source: [`src/interfaces/IEmergencyLiquidityManager.sol`](../../packages/contracts/src/interfaces/IEmergencyLiquidityManager.sol)

Artifact: `out/IEmergencyLiquidityManager.sol/IEmergencyLiquidityManager.json`

Public ABI: 1 function, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `pauseMigrations()`

```solidity
function pauseMigrations() external;
```

Pauses new timelocked liquidity migrations.

## IEmergencyMiningPool

Source: [`src/interfaces/IEmergencyMiningPool.sol`](../../packages/contracts/src/interfaces/IEmergencyMiningPool.sol)

Artifact: `out/IEmergencyMiningPool.sol/IEmergencyMiningPool.json`

Public ABI: 2 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `invalidateCurrentEpoch()`

```solidity
function invalidateCurrentEpoch() external;
```

Invalidates the current unsettled epoch so contributors can refund.

### `pauseContributions()`

```solidity
function pauseContributions() external;
```

Pauses new contributions while preserving settlement, claims, and refunds.

## IEmergencyPermissionedPoolController

Source: [`src/interfaces/IEmergencyPermissionedPoolController.sol`](../../packages/contracts/src/interfaces/IEmergencyPermissionedPoolController.sol)

Artifact: `out/IEmergencyPermissionedPoolController.sol/IEmergencyPermissionedPoolController.json`

Public ABI: 3 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Returns the guardian contract authorized for stop-only actions.

### `emergencyDisableLiquidity()`

```solidity
function emergencyDisableLiquidity() external;
```

Disables future liquidity additions through the canonical permissioned hook.

### `emergencyDisableSwapping()`

```solidity
function emergencyDisableSwapping() external;
```

Disables permissioned swaps without changing custody or eligibility.

## IEmergencyStrategy

Source: [`src/interfaces/IEmergencyStrategy.sol`](../../packages/contracts/src/interfaces/IEmergencyStrategy.sol)

Artifact: `out/IEmergencyStrategy.sol/IEmergencyStrategy.json`

Public ABI: 1 function, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `pauseFills()`

```solidity
function pauseFills() external;
```

Pauses new auction fills.

## IEmissionController

Source: [`src/interfaces/IEmissionController.sol`](../../packages/contracts/src/interfaces/IEmissionController.sol)

Artifact: `out/IEmissionController.sol/IEmissionController.json`

Public ABI: 16 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `GENESIS_LIQUIDITY_ALLOCATION()`

```solidity
function GENESIS_LIQUIDITY_ALLOCATION() external view returns (uint256 arg0);
```

Returns the exact genesis allocation reserved for protocol-owned liquidity.

**Returns**

- `_0`: The genesis liquidity allocation in raw GBX units.

### `GENESIS_MINER_ALLOCATION()`

```solidity
function GENESIS_MINER_ALLOCATION() external view returns (uint256 arg0);
```

Returns the exact genesis allocation reserved for mining claims.

**Returns**

- `_0`: The genesis miner allocation in raw GBX units.

### `INITIAL_DAILY_SCHEDULED_EMISSION()`

```solidity
function INITIAL_DAILY_SCHEDULED_EMISSION() external view returns (uint256 arg0);
```

Returns the first daily post-genesis scheduled emission.

**Returns**

- `_0`: The epoch-zero scheduled emission in raw GBX units.

### `callerInitializer()`

```solidity
function callerInitializer() external view returns (address arg0);
```

Returns the one-time deployment initializer.

**Returns**

- `_0`: The initializer address.

### `callersInitialized()`

```solidity
function callersInitialized() external view returns (bool arg0);
```

Returns whether the two mint callers have been initialized.

**Returns**

- `_0`: Whether initialization is complete.

### `currentScheduledEmission()`

```solidity
function currentScheduledEmission() external view returns (uint256 arg0);
```

Returns the scheduled emission for the next post-genesis epoch.

**Returns**

- `_0`: The next scheduled emission in raw GBX units.

### `gbx()`

```solidity
function gbx() external view returns (contract IGBXToken arg0);
```

Returns the GBX token controlled by this contract.

**Returns**

- `_0`: The canonical GBX token.

### `genesisBootstrap()`

```solidity
function genesisBootstrap() external view returns (address arg0);
```

Returns the set-once GenesisBootstrap caller.

**Returns**

- `_0`: The GenesisBootstrap address.

### `genesisMinted()`

```solidity
function genesisMinted() external view returns (bool arg0);
```

Returns whether the exact genesis allocations have been minted.

**Returns**

- `_0`: Whether genesis minting is complete.

### `initializeCallers(address,address)`

```solidity
function initializeCallers(address genesisBootstrap_, address miningPool_) external;
```

Sets the only two contracts allowed to request GBX minting.

**Parameters**

- `genesisBootstrap_`: The directly deployed GenesisBootstrap contract.
- `miningPool_`: The directly deployed MiningPool contract.

### `miningPool()`

```solidity
function miningPool() external view returns (address arg0);
```

Returns the set-once MiningPool caller.

**Returns**

- `_0`: The MiningPool address.

### `mintGenesis(address,address)`

```solidity
function mintGenesis(address claimsReceiver, address liquidityReceiver) external;
```

Mints the fixed genesis miner and liquidity allocations exactly once.

**Parameters**

- `claimsReceiver`: The GenesisClaims receiver for 80 million GBX.
- `liquidityReceiver`: The LiquidityManager receiver for 20 million GBX.

### `mintMiningEpoch(uint256,address,uint256)`

```solidity
function mintMiningEpoch(uint256 epochId, address claimsReceiver, uint256 amount) external;
```

Advances one daily epoch and mints its demand-scaled emission.

**Parameters**

- `amount`: The actual demand-scaled emission, which may be zero.
- `claimsReceiver`: The MiningClaims receiver for the complete epoch emission.
- `epochId`: The sequential post-genesis epoch ID.

### `nextMiningEpochId()`

```solidity
function nextMiningEpochId() external view returns (uint256 arg0);
```

Returns the next sequential post-genesis epoch ID.

**Returns**

- `_0`: The next epoch ID.

### `remainingMintCapacity()`

```solidity
function remainingMintCapacity() external view returns (uint256 arg0);
```

Returns GBX mint capacity remaining under the lifetime cap.

**Returns**

- `_0`: The remaining lifetime capacity in raw GBX units.

### `scheduledEmission(uint256)`

```solidity
function scheduledEmission(uint256 epochId) external pure returns (uint256 arg0);
```

Returns the exact sequentially floor-rounded emission for a post-genesis epoch.

**Parameters**

- `epochId`: The zero-based post-genesis epoch ID.

**Returns**

- `_0`: The scheduled emission in raw GBX units.

## IGBXToken

Source: [`src/interfaces/IGBXToken.sol`](../../packages/contracts/src/interfaces/IGBXToken.sol)

Artifact: `out/IGBXToken.sol/IGBXToken.json`

Public ABI: 18 functions, 2 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `DOMAIN_SEPARATOR()`

```solidity
function DOMAIN_SEPARATOR() external view returns (bytes32 arg0);
```

Returns the domain separator used in the encoding of the signature for {permit}, as defined by {EIP712}.

### `MAX_CUMULATIVE_MINT()`

```solidity
function MAX_CUMULATIVE_MINT() external view returns (uint256 arg0);
```

Returns the maximum amount of GBX that may ever be minted.

**Returns**

- `_0`: The immutable lifetime mint cap.

### `allowance(address,address)`

```solidity
function allowance(address owner, address spender) external view returns (uint256 arg0);
```

Returns the remaining number of tokens that `spender` will be allowed to spend on behalf of `owner` through {transferFrom}. This is zero by default. This value changes when {approve} or {transferFrom} are called.

### `approve(address,uint256)`

```solidity
function approve(address spender, uint256 value) external returns (bool arg0);
```

Sets a `value` amount of tokens as the allowance of `spender` over the caller's tokens. Returns a boolean value indicating whether the operation succeeded. IMPORTANT: Beware that changing an allowance with this method brings the risk that someone may use both the old and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards: https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729 Emits an {Approval} event.

### `balanceOf(address)`

```solidity
function balanceOf(address account) external view returns (uint256 arg0);
```

Returns the value of tokens owned by `account`.

### `burn(uint256)`

```solidity
function burn(uint256 amount) external;
```

Burns GBX owned by the caller.

**Parameters**

- `amount`: The amount of GBX to burn.

### `burnFrom(address,uint256)`

```solidity
function burnFrom(address account, uint256 amount) external;
```

Burns GBX from an account after spending the caller's allowance.

**Parameters**

- `account`: The account whose GBX is burned.
- `amount`: The amount of GBX to burn.

### `cumulativeBurned()`

```solidity
function cumulativeBurned() external view returns (uint256 arg0);
```

Returns the total amount of GBX burned over the token's lifetime.

**Returns**

- `_0`: The cumulative burned amount.

### `cumulativeMinted()`

```solidity
function cumulativeMinted() external view returns (uint256 arg0);
```

Returns the total amount of GBX minted over the token's lifetime.

**Returns**

- `_0`: The cumulative minted amount.

### `eligibilityModule()`

```solidity
function eligibilityModule() external view returns (contract IEligibilityModule arg0);
```

Returns the optional immutable transfer-eligibility module.

**Returns**

- `_0`: The configured eligibility module, or the zero address for permissionless mode.

### `emissionController()`

```solidity
function emissionController() external view returns (address arg0);
```

Returns the address authorized to mint GBX.

**Returns**

- `_0`: The EmissionController address.

### `initializeEmissionController(address)`

```solidity
function initializeEmissionController(address controller) external;
```

Assigns the sole GBX minter exactly once.

**Parameters**

- `controller`: The deployed EmissionController address.

### `mint(address,uint256)`

```solidity
function mint(address receiver, uint256 amount) external;
```

Mints GBX without allowing burns to restore mint capacity.

**Parameters**

- `amount`: The amount of GBX to mint.
- `receiver`: The account receiving newly minted GBX.

### `nonces(address)`

```solidity
function nonces(address owner) external view returns (uint256 arg0);
```

Returns the current nonce for `owner`. This value must be included whenever a signature is generated for {permit}. Every successful call to {permit} increases `owner`'s nonce by one. This prevents a signature from being used multiple times.

### `permit(address,address,uint256,uint256,uint8,bytes32,bytes32)`

```solidity
function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
```

Sets `value` as the allowance of `spender` over `owner`'s tokens, given `owner`'s signed approval. IMPORTANT: The same issues {IERC20-approve} has related to transaction ordering also applies here. Emits an {Approval} event. Requirements: - `spender` cannot be the zero address. - `deadline` must be a timestamp in the future. - `v`, `r` and `s` must be a valid `secp256k1` signature from `owner` over the EIP712-formatted function arguments. - the signature must use `owner`'s current nonce (see {nonces}). For more information on the signature format, see the https://eips.ethereum.org/EIPS/eip-2612#specification[relevant EIP section]. CAUTION: See Security Considerations above.

### `totalSupply()`

```solidity
function totalSupply() external view returns (uint256 arg0);
```

Returns the value of tokens in existence.

### `transfer(address,uint256)`

```solidity
function transfer(address to, uint256 value) external returns (bool arg0);
```

Moves a `value` amount of tokens from the caller's account to `to`. Returns a boolean value indicating whether the operation succeeded. Emits a {Transfer} event.

### `transferFrom(address,address,uint256)`

```solidity
function transferFrom(address from, address to, uint256 value) external returns (bool arg0);
```

Moves a `value` amount of tokens from `from` to `to` using the allowance mechanism. `value` is then deducted from the caller's allowance. Returns a boolean value indicating whether the operation succeeded. Emits a {Transfer} event.

### Events

#### `Approval(address,address,uint256)`

```solidity
event Approval(address indexed owner, address indexed spender, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Transfer(address,address,uint256)`

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

## IGenesisClaims

Source: [`src/interfaces/IGenesisClaims.sol`](../../packages/contracts/src/interfaces/IGenesisClaims.sol)

Artifact: `out/IGenesisClaims.sol/IGenesisClaims.json`

Public ABI: 5 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `burnExpired()`

```solidity
function burnExpired() external returns (uint256 amountBurned);
```

Burns the complete unclaimed genesis remainder after expiry.

**Returns**

- `amountBurned`: The GBX amount burned.

### `claim(address)`

```solidity
function claim(address beneficiary) external returns (uint256 amount);
```

Claims a beneficiary's genesis GBX to that beneficiary.

**Parameters**

- `beneficiary`: The recorded contribution beneficiary.

**Returns**

- `amount`: The claimed GBX amount.

### `claimBatch(address[])`

```solidity
function claimBatch(address[] beneficiaries) external returns (uint256 totalAmount);
```

Claims a bounded list of genesis entitlements to their recorded beneficiaries.
Anyone may submit the batch, but every payment is fixed to its corresponding beneficiary.

**Parameters**

- `beneficiaries`: The bounded list of recorded contribution beneficiaries.

**Returns**

- `totalAmount`: The aggregate claimed GBX amount.

### `initializeSource(address)`

```solidity
function initializeSource(address source) external;
```

Assigns the immutable GenesisBootstrap claim source exactly once.

**Parameters**

- `source`: The GenesisBootstrap contract.

### `previewClaim(address)`

```solidity
function previewClaim(address beneficiary) external view returns (uint256 amount);
```

Returns the beneficiary's currently claimable genesis GBX.

**Parameters**

- `beneficiary`: The recorded contribution beneficiary.

**Returns**

- `amount`: The currently claimable GBX amount.

## IGenesisLiquidityManager

Source: [`src/interfaces/IGenesisLiquidityManager.sol`](../../packages/contracts/src/interfaces/IGenesisLiquidityManager.sol)

Artifact: `out/IGenesisLiquidityManager.sol/IGenesisLiquidityManager.json`

Public ABI: 1 function, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `initializeAndSeed(uint256,uint160)`

```solidity
function initializeAndSeed(uint256 communityUSDG, uint160 sqrtPriceX96) external returns (uint160 initializedSqrtPriceX96);
```

Initializes the canonical pool and seeds the complete 20 million GBX ladder.

**Parameters**

- `communityUSDG`: Raw community USDG used to derive the genesis clearing price.
- `sqrtPriceX96`: The official Uniswap SDK encoding of the exact raw genesis ratio.

**Returns**

- `initializedSqrtPriceX96`: The initialized Uniswap v4 square-root price.

## IGumBallVault

Source: [`src/interfaces/IGumBallVault.sol`](../../packages/contracts/src/interfaces/IGumBallVault.sol)

Artifact: `out/IGumBallVault.sol/IGumBallVault.json`

Public ABI: 3 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `USDG()`

```solidity
function USDG() external view returns (contract IERC20 arg0);
```

Returns the one immutable USDG quote token used for budgets and strategy fills.

**Returns**

- `_0`: The canonical USDG token.

### `redeem(uint256,address)`

```solidity
function redeem(uint256 shares, address receiver) external returns (uint256[] amountsOut);
```

Burns shares and sends the receiver the same pro-rata fraction of every registered asset.

**Parameters**

- `receiver`: The eligible account receiving every redemption asset.
- `shares`: The GBX amount to burn.

**Returns**

- `amountsOut`: The raw amount of each registered asset transferred in registry order.

### `releaseUSDG(address,uint256)`

```solidity
function releaseUSDG(address receiver, uint256 amount) external;
```

Releases budgeted USDG during a fill initiated by an approved live strategy.

**Parameters**

- `amount`: The raw USDG amount released.
- `receiver`: The fill-selected USDG receiver.

## IManagerRewards

Source: [`src/interfaces/IManagerRewards.sol`](../../packages/contracts/src/interfaces/IManagerRewards.sol)

Artifact: `out/IManagerRewards.sol/IManagerRewards.json`

Public ABI: 5 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `advanceGeneration(uint64)`

```solidity
function advanceGeneration(uint64 nextGeneration) external;
```

Closes the prior reward generation before a disabled strategy can later be reactivated.
Must only be called by the immutable AllocationVoter as it increments the strategy generation.

**Parameters**

- `nextGeneration`: The consecutive generation that follows the just-closed reward index.

### `checkpointUser(address,uint256,uint64)`

```solidity
function checkpointUser(address user, uint256 activeWeight, uint64 weightGeneration) external;
```

Accrues rewards using the user's generation-bound weight immediately before a voter transition.
Must only be called by the immutable AllocationVoter.

**Parameters**

- `activeWeight`: The user's effective strategy weight before the transition.
- `user`: The signal account being checkpointed.
- `weightGeneration`: The strategy generation in which `activeWeight` earned rewards.

### `notifyReward(uint256)`

```solidity
function notifyReward(uint256 amount) external;
```

Accounts an observed reward-token deposit from the immutable associated strategy.

**Parameters**

- `amount`: The observed reward-token amount deposited.

### `settleTerminalDust()`

```solidity
function settleTerminalDust() external;
```

Finalizes fractional accounting after the voter has individually checkpointed the last live weight.
Must only be called by the immutable AllocationVoter after the strategy weight reaches zero naturally. Finalization queues terminal dust without calling the reward token.

### `sweepTerminalDust(uint64,uint64)`

```solidity
function sweepTerminalDust(uint64 generation, uint64 remainderCycle) external returns (uint256 amount);
```

Retries delivery of one finalized terminal-dust cycle to GumBallVault.
Permissionless and exact: failed token delivery leaves every pending liability unchanged.

**Parameters**

- `generation`: The reward generation containing the finalized cycle.
- `remainderCycle`: The finalized fractional-remainder cycle to sweep.

**Returns**

- `amount`: The raw reward-token dust delivered to GumBallVault.

## IMiningAllocationVoter

Source: [`src/interfaces/IMiningAllocationVoter.sol`](../../packages/contracts/src/interfaces/IMiningAllocationVoter.sol)

Artifact: `out/IMiningAllocationVoter.sol/IMiningAllocationVoter.json`

Public ABI: 1 function, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `notifyRevenue(uint256,uint8)`

```solidity
function notifyRevenue(uint256 amount, enum IMiningAllocationVoter.RevenueSource source) external;
```

Accounts newly deposited physical vault USDG against active strategy weights.

**Parameters**

- `amount`: The observed raw USDG deposit.
- `source`: The fixed revenue-source metadata value.

## IMiningClaims

Source: [`src/interfaces/IMiningClaims.sol`](../../packages/contracts/src/interfaces/IMiningClaims.sol)

Artifact: `out/IMiningClaims.sol/IMiningClaims.json`

Public ABI: 5 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `burnExpired(uint256)`

```solidity
function burnExpired(uint256 epochId) external returns (uint256 amountBurned);
```

Burns one epoch's complete unclaimed remainder after expiry.

**Parameters**

- `epochId`: The expired settled epoch ID.

**Returns**

- `amountBurned`: The unclaimed GBX amount burned.

### `claim(address,uint256)`

```solidity
function claim(address beneficiary, uint256 epochId) external returns (uint256 amount);
```

Claims one settled epoch entitlement to the recorded beneficiary.

**Parameters**

- `beneficiary`: The recorded contribution beneficiary.
- `epochId`: The settled epoch ID.

**Returns**

- `amount`: The claimed GBX amount.

### `claimBatch(address,uint256[])`

```solidity
function claimBatch(address beneficiary, uint256[] epochIds) external returns (uint256 totalAmount);
```

Claims a bounded list of settled epochs to the recorded beneficiary.

**Parameters**

- `beneficiary`: The recorded contribution beneficiary.
- `epochIds`: The bounded list of settled epoch IDs.

**Returns**

- `totalAmount`: The aggregate claimed GBX amount.

### `initializeSource(address)`

```solidity
function initializeSource(address source) external;
```

Assigns the immutable MiningPool claim source exactly once.

**Parameters**

- `source`: The MiningPool contract.

### `previewClaim(address,uint256)`

```solidity
function previewClaim(address beneficiary, uint256 epochId) external view returns (uint256 amount);
```

Returns the beneficiary's currently claimable GBX for an epoch.

**Parameters**

- `beneficiary`: The recorded contribution beneficiary.
- `epochId`: The settled epoch ID.

**Returns**

- `amount`: The currently claimable GBX amount.

## IMiningPool

Source: [`src/interfaces/IMiningPool.sol`](../../packages/contracts/src/interfaces/IMiningPool.sol)

Artifact: `out/IMiningPool.sol/IMiningPool.json`

Public ABI: 3 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `claim(address,uint256)`

```solidity
function claim(address beneficiary, uint256 epochId) external returns (uint256 amount);
```

Claims a settled epoch entitlement to its recorded beneficiary.

**Parameters**

- `beneficiary`: The recorded contribution beneficiary.
- `epochId`: The settled epoch ID.

**Returns**

- `amount`: The claimed GBX amount.

### `initializeGenesisBootstrap(address)`

```solidity
function initializeGenesisBootstrap(address genesisBootstrap) external;
```

Assigns GenesisBootstrap exactly once after deployment cycles are resolved.

**Parameters**

- `genesisBootstrap`: The canonical GenesisBootstrap contract.

### `initializeReferencePrice(uint256)`

```solidity
function initializeReferencePrice(uint256 genesisPriceWad) external;
```

Sets the first endogenous mining reference price during atomic genesis settlement.

**Parameters**

- `genesisPriceWad`: The genesis clearing price scaled by 1e18.

## IPermissionedPoolController

Source: [`src/interfaces/IPermissionedPoolController.sol`](../../packages/contracts/src/interfaces/IPermissionedPoolController.sol)

Artifact: `out/IPermissionedPoolController.sol/IPermissionedPoolController.json`

Public ABI: 9 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Returns the guardian authorized only for stop actions.

**Returns**

- `_0`: emergencyGuardian The immutable emergency guardian address.

### `PERMISSIONED_HOOK()`

```solidity
function PERMISSIONED_HOOK() external view returns (address arg0);
```

Returns the canonical permissioned hook bound to the successor graph.

**Returns**

- `_0`: permissionedHook The hook address, or zero before graph initialization.

### `PERMISSIONS_ADAPTER()`

```solidity
function PERMISSIONS_ADAPTER() external view returns (address arg0);
```

Returns the canonical GBX permissions adapter owned by the controller.

**Returns**

- `_0`: permissionsAdapter The permissions-adapter address, or zero before creation.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Returns the protocol timelock authorized for typed maintenance actions.

**Returns**

- `_0`: protocolTimelock The immutable protocol timelock address.

### `graphInitialized()`

```solidity
function graphInitialized() external view returns (bool arg0);
```

Returns whether the complete canonical permissioned-pool graph was initialized.

**Returns**

- `_0`: initialized True only after the controller validated and bound the graph.

### `setAllowedWrapper(address,bool)`

```solidity
function setAllowedWrapper(address wrapper, bool allowed) external;
```

Changes authorization for one fixed official identity-reporting wrapper.

**Parameters**

- `allowed`: Whether the wrapper should be authorized.
- `wrapper`: One of the controller's immutable canonical wrappers.

### `setCanonicalHookAllowed(bool)`

```solidity
function setCanonicalHookAllowed(bool allowed) external;
```

Changes whether the canonical hook is approved for permissioned liquidity actions.

**Parameters**

- `allowed`: Whether the immutable canonical hook should be approved.

### `setSwappingEnabled(bool)`

```solidity
function setSwappingEnabled(bool enabled) external;
```

Changes permissioned swap availability through the protocol timelock.

**Parameters**

- `enabled`: Whether permissioned swaps should be enabled.

### `updateAllowListChecker(address)`

```solidity
function updateAllowListChecker(address newChecker) external;
```

Replaces the eligibility checker through the protocol timelock.

**Parameters**

- `newChecker`: New ERC-165-compatible allowlist checker.

## IStrategyDeployer

Source: [`src/interfaces/IStrategyDeployer.sol`](../../packages/contracts/src/interfaces/IStrategyDeployer.sol)

Artifact: `out/IStrategyDeployer.sol/IStrategyDeployer.json`

Public ABI: 34 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `ACQUISITION_STRATEGY_CREATION_CODE_HASH()`

```solidity
function ACQUISITION_STRATEGY_CREATION_CODE_HASH() external view returns (bytes32 arg0);
```

Immutable hash of the exact AcquisitionStrategy compiler creation bytecode.

**Returns**

- `_0`: The committed creation-code hash.

### `ACQUISITION_STRATEGY_CREATION_CODE_LENGTH()`

```solidity
function ACQUISITION_STRATEGY_CREATION_CODE_LENGTH() external view returns (uint256 arg0);
```

Exact byte length of the committed AcquisitionStrategy compiler creation bytecode.

**Returns**

- `_0`: The committed creation-code byte length.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (address arg0);
```

Canonical strategy allocation voter.

**Returns**

- `_0`: The immutable AllocationVoter address.

### `ASSET_REGISTRY()`

```solidity
function ASSET_REGISTRY() external view returns (address arg0);
```

Canonical bounded asset and strategy registry.

**Returns**

- `_0`: The immutable AssetRegistry address.

### `BUYBACK_BURN_STRATEGY_CREATION_CODE_HASH()`

```solidity
function BUYBACK_BURN_STRATEGY_CREATION_CODE_HASH() external view returns (bytes32 arg0);
```

Immutable hash of the exact BuybackBurnStrategy compiler creation bytecode.

**Returns**

- `_0`: The committed creation-code hash.

### `BUYBACK_BURN_STRATEGY_CREATION_CODE_LENGTH()`

```solidity
function BUYBACK_BURN_STRATEGY_CREATION_CODE_LENGTH() external view returns (uint256 arg0);
```

Exact byte length of the committed BuybackBurnStrategy compiler creation bytecode.

**Returns**

- `_0`: The committed creation-code byte length.

### `ELIGIBILITY_MODULE()`

```solidity
function ELIGIBILITY_MODULE() external view returns (address arg0);
```

Canonical manager reward receiver eligibility module.

**Returns**

- `_0`: The immutable eligibility-module address.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Canonical stop-only strategy guardian.

**Returns**

- `_0`: The immutable EmergencyGuardian address.

### `EXPECTED_BOOTSTRAP_ACQUISITION_TARGETS_HASH()`

```solidity
function EXPECTED_BOOTSTRAP_ACQUISITION_TARGETS_HASH() external view returns (bytes32 arg0);
```

Immutable hash of the exact reviewed ordered bootstrap acquisition target list.

**Returns**

- `_0`: The expected ordered target-list hash.

### `EXPECTED_BOOTSTRAP_ACQUISITION_TARGET_COUNT()`

```solidity
function EXPECTED_BOOTSTRAP_ACQUISITION_TARGET_COUNT() external view returns (uint256 arg0);
```

Immutable reviewed number of acquisition targets permitted before bootstrap finalization.

**Returns**

- `_0`: The expected bootstrap acquisition-target count.

### `GBX()`

```solidity
function GBX() external view returns (address arg0);
```

Canonical cumulatively capped GBX token.

**Returns**

- `_0`: The immutable GBX token address.

### `GUM_BALL_VAULT()`

```solidity
function GUM_BALL_VAULT() external view returns (address arg0);
```

Canonical raw-balance basket vault.

**Returns**

- `_0`: The immutable GumBallVault address.

### `HOLD_USDG_STRATEGY_CREATION_CODE_HASH()`

```solidity
function HOLD_USDG_STRATEGY_CREATION_CODE_HASH() external view returns (bytes32 arg0);
```

Immutable hash of the exact HoldUSDGStrategy compiler creation bytecode.

**Returns**

- `_0`: The committed creation-code hash.

### `HOLD_USDG_STRATEGY_CREATION_CODE_LENGTH()`

```solidity
function HOLD_USDG_STRATEGY_CREATION_CODE_LENGTH() external view returns (uint256 arg0);
```

Exact byte length of the committed HoldUSDGStrategy compiler creation bytecode.

**Returns**

- `_0`: The committed creation-code byte length.

### `MANAGER_REWARDS_CREATION_CODE_HASH()`

```solidity
function MANAGER_REWARDS_CREATION_CODE_HASH() external view returns (bytes32 arg0);
```

Immutable hash of the exact ManagerRewards compiler creation bytecode.

**Returns**

- `_0`: The committed creation-code hash.

### `MANAGER_REWARDS_CREATION_CODE_LENGTH()`

```solidity
function MANAGER_REWARDS_CREATION_CODE_LENGTH() external view returns (uint256 arg0);
```

Exact byte length of the committed ManagerRewards compiler creation bytecode.

**Returns**

- `_0`: The committed creation-code byte length.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Canonical purpose-limited timelock and sole strategy deployment caller.

**Returns**

- `_0`: The immutable ProtocolTimelock address.

### `USDG()`

```solidity
function USDG() external view returns (address arg0);
```

Canonical quote token shared by the registry, voter, and vault graph.

**Returns**

- `_0`: The immutable USDG token address.

### `acquisitionPair(address)`

```solidity
function acquisitionPair(address strategy) external view returns (struct IStrategyDeployer.AcquisitionPair pair);
```

Returns the full immutable graph and runtime provenance for an acquisition strategy.

**Parameters**

- `strategy`: The recorded AcquisitionStrategy address.

**Returns**

- `pair`: The recorded reciprocal acquisition/rewards graph and runtime identities.

### `acquisitionStrategyForToken(address)`

```solidity
function acquisitionStrategyForToken(address targetToken) external view returns (address strategy);
```

Returns the one deployed acquisition strategy reserved for a target token.

**Parameters**

- `targetToken`: The canonical target-token address.

**Returns**

- `strategy`: The recorded AcquisitionStrategy address, or zero before deployment.

### `acquisitionTargetAt(uint256)`

```solidity
function acquisitionTargetAt(uint256 index) external view returns (address targetToken);
```

Returns a deployed acquisition target in immutable deployment order.

**Parameters**

- `index`: The zero-based deployment-order index.

**Returns**

- `targetToken`: The target-token address at the requested index.

### `acquisitionTargetCount()`

```solidity
function acquisitionTargetCount() external view returns (uint256 count);
```

Number of target tokens for which an acquisition pair has been successfully deployed.

**Returns**

- `count`: The number of deployed acquisition targets.

### `bootstrapAcquisitionTargetCount()`

```solidity
function bootstrapAcquisitionTargetCount() external view returns (uint256 arg0);
```

Finalized acquisition target count, permanently zero until successful bootstrap closure.

**Returns**

- `_0`: The finalized bootstrap target count.

### `bootstrapAcquisitionTargetsHash()`

```solidity
function bootstrapAcquisitionTargetsHash() external view returns (bytes32 arg0);
```

Finalized ordered acquisition target hash, permanently zero until successful bootstrap closure.

**Returns**

- `_0`: The finalized ordered target-list hash.

### `canonicalBuybackBurnStrategy()`

```solidity
function canonicalBuybackBurnStrategy() external view returns (address arg0);
```

One canonical buyback-and-burn strategy.

**Returns**

- `_0`: The deployed BuybackBurnStrategy address, or zero before deployment.

### `canonicalBuybackDeployment()`

```solidity
function canonicalBuybackDeployment() external view returns (struct IStrategyDeployer.BuybackDeployment deployment);
```

Returns the full immutable graph and runtime provenance for the canonical buyback.

**Returns**

- `deployment`: The recorded buyback graph and runtime identity.

### `canonicalHoldUSDGRuntimeCodeHash()`

```solidity
function canonicalHoldUSDGRuntimeCodeHash() external view returns (bytes32 arg0);
```

Registration-time runtime code hash of the canonical hold target.

**Returns**

- `_0`: The recorded runtime code hash, or zero before deployment.

### `canonicalHoldUSDGStrategy()`

```solidity
function canonicalHoldUSDGStrategy() external view returns (address arg0);
```

One canonical inert hold-USDG signal target.

**Returns**

- `_0`: The deployed HoldUSDGStrategy address, or zero before deployment.

### `dependenciesConfigured()`

```solidity
function dependenciesConfigured() external view returns (bool arg0);
```

Whether the complete canonical dependency graph has been permanently bound.

**Returns**

- `_0`: Whether dependency initialization has completed.

### `deployAcquisition(bytes,bytes,address,uint256,uint256,uint256)`

```solidity
function deployAcquisition(bytes strategyCreationCode, bytes rewardsCreationCode, address targetToken, uint256 minimumLotUSDG, uint256 maximumLotUSDG, uint256 initialReferenceRate) external returns (address strategy, address rewards);
```

Deploys and binds one exact acquisition/reward pair for a target token.

**Parameters**

- `initialReferenceRate`: Initial target-token-units-per-USDG auction reference rate.
- `maximumLotUSDG`: Largest USDG lot the strategy may release in one fill.
- `minimumLotUSDG`: Smallest USDG lot the strategy may release in one fill.
- `rewardsCreationCode`: Exact committed ManagerRewards compiler creation bytecode.
- `strategyCreationCode`: Exact committed AcquisitionStrategy compiler creation bytecode.
- `targetToken`: Canonical target asset for the new strategy.

**Returns**

- `rewards`: The directly deployed and reciprocally bound ManagerRewards address.
- `strategy`: The directly deployed AcquisitionStrategy address.

### `deployBuyback(bytes,uint256,uint256,uint256)`

```solidity
function deployBuyback(bytes creationCode, uint256 minimumLotUSDG, uint256 maximumLotUSDG, uint256 initialReferenceRate) external returns (address strategy);
```

Deploys the one exact buyback-and-burn implementation from committed compiler creation code.

**Parameters**

- `creationCode`: Exact committed BuybackBurnStrategy compiler creation bytecode.
- `initialReferenceRate`: Initial GBX-units-per-USDG auction reference rate.
- `maximumLotUSDG`: Largest USDG lot the strategy may release in one fill.
- `minimumLotUSDG`: Smallest USDG lot the strategy may release in one fill.

**Returns**

- `strategy`: The directly deployed canonical BuybackBurnStrategy address.

### `deployHoldUSDG(bytes)`

```solidity
function deployHoldUSDG(bytes creationCode) external returns (address strategy);
```

Deploys the one exact hold-USDG implementation from committed compiler creation code.

**Parameters**

- `creationCode`: Exact committed HoldUSDGStrategy compiler creation bytecode.

**Returns**

- `strategy`: The directly deployed canonical HoldUSDGStrategy address.

### `finalizeBootstrap(address[])`

```solidity
function finalizeBootstrap(address[] expectedAcquisitionTargets) external;
```

Seals the prelaunch deployment set after matching every reviewed target in deployment order.
This irreversible transition rejects any count, order, singleton, or dependency-graph mismatch.

**Parameters**

- `expectedAcquisitionTargets`: Exact reviewed target list in deployment order.

### `strategyBootstrapFinalized()`

```solidity
function strategyBootstrapFinalized() external view returns (bool arg0);
```

Whether the reviewed prelaunch acquisition set and singleton window are permanently sealed.

**Returns**

- `_0`: Whether strategy bootstrap has been finalized.

## IAdapterVerificationEscrow

Source: [`src/interfaces/IUniswapPermissionedPools.sol`](../../packages/contracts/src/interfaces/IUniswapPermissionedPools.sol)

Artifact: `out/IUniswapPermissionedPools.sol/IAdapterVerificationEscrow.json`

Public ABI: 8 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `DEPENDENCY_INITIALIZER()`

```solidity
function DEPENDENCY_INITIALIZER() external view returns (address arg0);
```

Returns the one-use dependency initializer.

**Returns**

- `_0`: dependencyInitializer Address authorized for dependency initialization.

### `LIQUIDITY_MANAGER()`

```solidity
function LIQUIDITY_MANAGER() external view returns (address arg0);
```

Returns the bound protocol liquidity manager.

**Returns**

- `_0`: manager LiquidityManager address, or zero before dependency initialization.

### `PERMISSIONED_HOOK()`

```solidity
function PERMISSIONED_HOOK() external view returns (address arg0);
```

Returns the canonical permissioned hook.

**Returns**

- `_0`: permissionedHook Canonical permissioned hook address.

### `PERMISSIONS_ADAPTER()`

```solidity
function PERMISSIONS_ADAPTER() external view returns (contract IUniswapPermissionsAdapter arg0);
```

Returns the permission adapter whose verification wei is recycled.

**Returns**

- `_0`: permissionsAdapter Canonical GBX permissions adapter.

### `PERMISSIONS_ADAPTER_FACTORY()`

```solidity
function PERMISSIONS_ADAPTER_FACTORY() external view returns (contract IUniswapPermissionsAdapterFactory arg0);
```

Returns the adapter factory used for verification.

**Returns**

- `_0`: permissionsAdapterFactory Canonical permissions-adapter factory.

### `POOL_MANAGER()`

```solidity
function POOL_MANAGER() external view returns (address arg0);
```

Returns the bound v4 PoolManager.

**Returns**

- `_0`: poolManager Canonical v4 PoolManager address.

### `POSITION_MANAGER()`

```solidity
function POSITION_MANAGER() external view returns (address arg0);
```

Returns the bound Permissioned Position Manager.

**Returns**

- `_0`: positionManager Canonical permissioned Position Manager address.

### `recoverVerificationDeposit()`

```solidity
function recoverVerificationDeposit() external;
```

Verifies the adapter and recycles the fixed verification deposit to LiquidityManager.

## IGumBallPermissionedHook

Source: [`src/interfaces/IUniswapPermissionedPools.sol`](../../packages/contracts/src/interfaces/IUniswapPermissionedPools.sol)

Artifact: `out/IUniswapPermissionedPools.sol/IGumBallPermissionedHook.json`

Public ABI: 8 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `DEPENDENCY_INITIALIZER()`

```solidity
function DEPENDENCY_INITIALIZER() external view returns (address arg0);
```

Returns the one-use dependency initializer.

**Returns**

- `_0`: dependencyInitializer Address authorized for dependency initialization.

### `PERMISSIONS_ADAPTER_FACTORY()`

```solidity
function PERMISSIONS_ADAPTER_FACTORY() external view returns (contract IUniswapPermissionsAdapterFactory arg0);
```

Returns the adapter factory used by the hook.

**Returns**

- `_0`: permissionsAdapterFactory Canonical permissions-adapter factory.

### `POOL_FEE()`

```solidity
function POOL_FEE() external view returns (uint24 arg0);
```

Returns the canonical pool fee.

**Returns**

- `_0`: poolFee Fee tier encoded in the canonical pool key.

### `TICK_SPACING()`

```solidity
function TICK_SPACING() external view returns (int24 arg0);
```

Returns the canonical pool tick spacing.

**Returns**

- `_0`: tickSpacing Tick spacing encoded in the canonical pool key.

### `TOKEN0()`

```solidity
function TOKEN0() external view returns (address arg0);
```

Returns the canonical sorted first currency.

**Returns**

- `_0`: token0 Lower-address currency in the canonical pool key.

### `TOKEN1()`

```solidity
function TOKEN1() external view returns (address arg0);
```

Returns the canonical sorted second currency.

**Returns**

- `_0`: token1 Higher-address currency in the canonical pool key.

### `canonicalPoolInitialized()`

```solidity
function canonicalPoolInitialized() external view returns (bool arg0);
```

Returns whether the one canonical initialization has completed.

**Returns**

- `_0`: initialized Whether the canonical pool was initialized.

### `liquidityManager()`

```solidity
function liquidityManager() external view returns (address arg0);
```

Returns the bound protocol liquidity manager.

**Returns**

- `_0`: manager LiquidityManager address, or zero before dependency initialization.

## IUniswapAllowlistChecker

Source: [`src/interfaces/IUniswapPermissionedPools.sol`](../../packages/contracts/src/interfaces/IUniswapPermissionedPools.sol)

Artifact: `out/IUniswapPermissionedPools.sol/IUniswapAllowlistChecker.json`

Public ABI: 2 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `checkAllowlist(address,address)`

```solidity
function checkAllowlist(address account, address tokenAddress) external view returns (PermissionFlag arg0);
```

Returns the permission flags granted to an account for one permissioned token.

**Parameters**

- `account`: Account whose permissions are queried.
- `tokenAddress`: Underlying permissioned token being queried.

**Returns**

- `_0`: permissions Permission flags granted to the account.

### `supportsInterface(bytes4)`

```solidity
function supportsInterface(bytes4 interfaceId) external view returns (bool arg0);
```

Returns true if this contract implements the interface defined by `interfaceId`. See the corresponding https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[ERC section] to learn more about how these ids are created. This function call must use less than 30 000 gas.

## IUniswapPermissionedMsgSender

Source: [`src/interfaces/IUniswapPermissionedPools.sol`](../../packages/contracts/src/interfaces/IUniswapPermissionedPools.sol)

Artifact: `out/IUniswapPermissionedPools.sol/IUniswapPermissionedMsgSender.json`

Public ABI: 1 function, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `msgSender()`

```solidity
function msgSender() external view returns (address arg0);
```

Returns the end-user identity reported by an approved wrapper.

**Returns**

- `_0`: sender End-user identity for the active wrapper call.

## IUniswapPermissionedPositionManager

Source: [`src/interfaces/IUniswapPermissionedPools.sol`](../../packages/contracts/src/interfaces/IUniswapPermissionedPools.sol)

Artifact: `out/IUniswapPermissionedPools.sol/IUniswapPermissionedPositionManager.json`

Public ABI: 3 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `PERMISSIONS_ADAPTER_FACTORY()`

```solidity
function PERMISSIONS_ADAPTER_FACTORY() external view returns (contract IUniswapPermissionsAdapterFactory arg0);
```

Returns the factory used to recognize verified permission adapters.

**Returns**

- `_0`: permissionsAdapterFactory Bound adapter factory.

### `isAllowedHooks(address,address)`

```solidity
function isAllowedHooks(address currency, address hooks) external view returns (bool arg0);
```

Returns whether a hook is approved for a permissioned currency.

**Parameters**

- `currency`: Permission-adapter currency.
- `hooks`: Hook address being queried.

**Returns**

- `_0`: allowed Whether the hook is approved for the currency.

### `setAllowedHook(address,address,bool)`

```solidity
function setAllowedHook(address currency, address hooks, bool allowed) external;
```

Changes the one hook allowance for a permissioned adapter currency.

**Parameters**

- `allowed`: Whether the hook should be approved.
- `currency`: Permission-adapter currency.
- `hooks`: Hook whose allowance changes.

## IUniswapPermissionsAdapter

Source: [`src/interfaces/IUniswapPermissionedPools.sol`](../../packages/contracts/src/interfaces/IUniswapPermissionedPools.sol)

Artifact: `out/IUniswapPermissionedPools.sol/IUniswapPermissionsAdapter.json`

Public ABI: 18 functions, 2 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `PERMISSIONED_TOKEN()`

```solidity
function PERMISSIONED_TOKEN() external view returns (contract IERC20 arg0);
```

Returns the permissioned underlying token.

**Returns**

- `_0`: permissionedToken Underlying token represented by this adapter.

### `POOL_MANAGER()`

```solidity
function POOL_MANAGER() external view returns (address arg0);
```

Returns the bound v4 PoolManager.

**Returns**

- `_0`: poolManager Canonical v4 PoolManager address.

### `allowListChecker()`

```solidity
function allowListChecker() external view returns (contract IUniswapAllowlistChecker arg0);
```

Returns the checker currently used for account permissions.

**Returns**

- `_0`: checker Active allowlist checker.

### `allowance(address,address)`

```solidity
function allowance(address owner, address spender) external view returns (uint256 arg0);
```

Returns the remaining number of tokens that `spender` will be allowed to spend on behalf of `owner` through {transferFrom}. This is zero by default. This value changes when {approve} or {transferFrom} are called.

### `allowedWrappers(address)`

```solidity
function allowedWrappers(address wrapper) external view returns (bool arg0);
```

Returns whether a wrapper may report user identity and wrap underlying tokens.

**Parameters**

- `wrapper`: Wrapper address being queried.

**Returns**

- `_0`: allowed Whether the wrapper is authorized.

### `approve(address,uint256)`

```solidity
function approve(address spender, uint256 value) external returns (bool arg0);
```

Sets a `value` amount of tokens as the allowance of `spender` over the caller's tokens. Returns a boolean value indicating whether the operation succeeded. IMPORTANT: Beware that changing an allowance with this method brings the risk that someone may use both the old and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards: https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729 Emits an {Approval} event.

### `balanceOf(address)`

```solidity
function balanceOf(address account) external view returns (uint256 arg0);
```

Returns the value of tokens owned by `account`.

### `depositForVerification(uint256)`

```solidity
function depositForVerification(uint256 amount) external;
```

Deposits underlying tokens used by the factory's one-time verification check.

**Parameters**

- `amount`: Underlying-token amount to deposit.

### `isAllowed(address,bytes2)`

```solidity
function isAllowed(address account, PermissionFlag permission) external view returns (bool arg0);
```

Returns whether an account has the requested permission flags.

**Parameters**

- `account`: Account whose permissions are queried.
- `permission`: Permission flags required by the caller.

**Returns**

- `_0`: allowed Whether every requested permission is granted.

### `owner()`

```solidity
function owner() external view returns (address arg0);
```

Returns the adapter administrator.

**Returns**

- `_0`: adapterOwner Current adapter owner.

### `swappingEnabled()`

```solidity
function swappingEnabled() external view returns (bool arg0);
```

Returns whether permissioned swaps are enabled.

**Returns**

- `_0`: enabled Whether swaps are enabled.

### `totalSupply()`

```solidity
function totalSupply() external view returns (uint256 arg0);
```

Returns the value of tokens in existence.

### `transfer(address,uint256)`

```solidity
function transfer(address to, uint256 value) external returns (bool arg0);
```

Moves a `value` amount of tokens from the caller's account to `to`. Returns a boolean value indicating whether the operation succeeded. Emits a {Transfer} event.

### `transferFrom(address,address,uint256)`

```solidity
function transferFrom(address from, address to, uint256 value) external returns (bool arg0);
```

Moves a `value` amount of tokens from `from` to `to` using the allowance mechanism. `value` is then deducted from the caller's allowance. Returns a boolean value indicating whether the operation succeeded. Emits a {Transfer} event.

### `updateAllowListChecker(address)`

```solidity
function updateAllowListChecker(contract IUniswapAllowlistChecker newAllowListChecker) external;
```

Replaces the account-permission checker. Only the adapter owner may call this.

**Parameters**

- `newAllowListChecker`: Replacement ERC-165-compatible checker.

### `updateAllowedWrapper(address,bool)`

```solidity
function updateAllowedWrapper(address wrapper, bool allowed) external;
```

Changes one wrapper authorization. Only the adapter owner may call this.

**Parameters**

- `allowed`: Whether the wrapper should be authorized.
- `wrapper`: Wrapper whose authorization changes.

### `updateSwappingEnabled(bool)`

```solidity
function updateSwappingEnabled(bool enabled) external;
```

Changes swap availability. Only the adapter owner may call this.

**Parameters**

- `enabled`: Whether permissioned swaps should be enabled.

### `wrapToPoolManager(uint256)`

```solidity
function wrapToPoolManager(uint256 amount) external;
```

Mints adapter currency to PoolManager against available underlying custody.

**Parameters**

- `amount`: Adapter-currency amount to mint to PoolManager.

### Events

#### `Approval(address,address,uint256)`

```solidity
event Approval(address indexed owner, address indexed spender, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Transfer(address,address,uint256)`

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

## IUniswapPermissionsAdapterFactory

Source: [`src/interfaces/IUniswapPermissionedPools.sol`](../../packages/contracts/src/interfaces/IUniswapPermissionedPools.sol)

Artifact: `out/IUniswapPermissionedPools.sol/IUniswapPermissionsAdapterFactory.json`

Public ABI: 5 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `POOL_MANAGER()`

```solidity
function POOL_MANAGER() external view returns (address arg0);
```

Returns the bound v4 PoolManager.

**Returns**

- `_0`: poolManager Canonical v4 PoolManager address.

### `createPermissionsAdapter(address,address,address)`

```solidity
function createPermissionsAdapter(contract IERC20 permissionedToken, address initialOwner, contract IUniswapAllowlistChecker allowListChecker) external returns (address permissionsAdapter);
```

Creates a fresh adapter whose owner and checker are fixed by the caller.

**Parameters**

- `allowListChecker`: Checker used to resolve account permissions.
- `initialOwner`: Initial adapter administrator.
- `permissionedToken`: Underlying token represented by the new adapter.

**Returns**

- `permissionsAdapter`: Address of the newly created permissions adapter.

### `permissionsAdapterOf(address)`

```solidity
function permissionsAdapterOf(address permissionsAdapter) external view returns (address permissionedToken);
```

Returns the underlying token recorded for an adapter created by this factory.

**Parameters**

- `permissionsAdapter`: Adapter whose recorded token is queried.

**Returns**

- `permissionedToken`: Underlying token, or zero for an unknown adapter.

### `verifiedPermissionsAdapterOf(address)`

```solidity
function verifiedPermissionsAdapterOf(address permissionsAdapter) external view returns (address permissionedToken);
```

Returns the underlying token for a verified adapter, or zero before verification.

**Parameters**

- `permissionsAdapter`: Adapter whose verification state is queried.

**Returns**

- `permissionedToken`: Verified underlying token, or zero before verification.

### `verifyPermissionsAdapter(address)`

```solidity
function verifyPermissionsAdapter(address permissionsAdapter) external;
```

Verifies an adapter after it holds a nonzero amount of its underlying token.

**Parameters**

- `permissionsAdapter`: Adapter to verify.

## PermissionFlags

Source: [`src/interfaces/IUniswapPermissionedPools.sol`](../../packages/contracts/src/interfaces/IUniswapPermissionedPools.sol)

Artifact: `out/IUniswapPermissionedPools.sol/PermissionFlags.json`

Public ABI: 0 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

_This source-defined surface has no externally callable ABI functions._

## GumBallLens

Source: [`src/lens/GumBallLens.sol`](../../packages/contracts/src/lens/GumBallLens.sol)

Artifact: `out/GumBallLens.sol/GumBallLens.json`

Public ABI: 10 functions, 0 events, 2 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,address)`

```solidity
constructor(address gbx, address gumBallVault, address assetRegistry, address allocationVoter, address stakedGBX);
```

Wires the immutable read-only protocol graph.

**Parameters**

- `allocationVoter`: The canonical staking and allocation voter.
- `assetRegistry`: The canonical bounded asset and strategy registry.
- `gbx`: The canonical GBX token.
- `gumBallVault`: The canonical basket vault whose balances are reported.
- `stakedGBX`: The canonical non-transferable sGBX token.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (contract AllocationVoter arg0);
```

Canonical allocation voter queried for weights and virtual budgets.

### `ASSET_REGISTRY()`

```solidity
function ASSET_REGISTRY() external view returns (contract IAssetRegistry arg0);
```

Canonical bounded asset and strategy registry queried by the lens.

### `GBX()`

```solidity
function GBX() external view returns (contract IGBXToken arg0);
```

Canonical GBX supply token queried by the lens.

### `GUM_BALL_VAULT()`

```solidity
function GUM_BALL_VAULT() external view returns (address arg0);
```

Canonical vault whose raw basket balances are aggregated.

### `STAKED_GBX()`

```solidity
function STAKED_GBX() external view returns (contract IERC20 arg0);
```

Canonical non-transferable sGBX token queried for user stake.

### `assetViews()`

```solidity
function assetViews() external view returns (struct GumBallLens.AssetView[] results);
```

Returns every registered basket asset and its raw vault balance.

**Returns**

- `results`: One entry per bounded AssetRegistry asset, in registry order.

### `previewRedemption(uint256)`

```solidity
function previewRedemption(uint256 shares) external view returns (address[] tokens, uint256[] amountsOut);
```

Previews raw pro-rata outputs using the same floor rounding and supply denominator as GumBallVault.

**Parameters**

- `shares`: The raw GBX amount whose basket output is previewed.

**Returns**

- `amountsOut`: The floor-rounded raw output for each corresponding token.
- `tokens`: Every registered asset address, in registry order.

### `strategyViews()`

```solidity
function strategyViews() external view returns (struct GumBallLens.StrategyView[] results);
```

Returns current allocation state for every registered strategy, including standalone buyback.

**Returns**

- `results`: One entry per bounded AssetRegistry strategy, in registry order.

### `supplyView()`

```solidity
function supplyView() external view returns (struct GumBallLens.SupplyView result);
```

Returns the lifetime and live GBX supply counters in one call.

**Returns**

- `result`: The current supply, cumulative mint and burn, and remaining one-billion-cap values.

### `userSignalViews(address)`

```solidity
function userSignalViews(address user) external view returns (uint256 stakedBalance, uint64 activationTime, bool activationsPaused, struct GumBallLens.UserSignalView[] results);
```

Returns the union of one user's bounded active and pending strategy lists without duplicates.

**Parameters**

- `user`: The wallet whose stake and strategy weights are queried.

**Returns**

- `activationTime`: The timestamp when the user's queued increases become activatable.
- `activationsPaused`: Whether new signal activations are globally paused.
- `results`: The user's unique active and pending strategy entries.
- `stakedBalance`: The user's raw sGBX balance.

### Custom errors

#### `GumBallLens__InvalidShares(uint256,uint256)`

```solidity
error GumBallLens__InvalidShares(uint256 shares, uint256 supply);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallLens__ZeroAddress()`

```solidity
error GumBallLens__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

## EmissionMath

Source: [`src/libraries/EmissionMath.sol`](../../packages/contracts/src/libraries/EmissionMath.sol)

Artifact: `out/EmissionMath.sol/EmissionMath.json`

Public ABI: 0 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

_This source-defined surface has no externally callable ABI functions._

## GenesisLiquidityMath

Source: [`src/libraries/GenesisLiquidityMath.sol`](../../packages/contracts/src/libraries/GenesisLiquidityMath.sol)

Artifact: `out/GenesisLiquidityMath.sol/GenesisLiquidityMath.json`

Public ABI: 0 functions, 0 events, 2 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

_This source-defined surface has no externally callable ABI functions._

### Custom errors

#### `GenesisLiquidityMath__InvalidRange(uint160,uint160)`

```solidity
error GenesisLiquidityMath__InvalidRange(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisLiquidityMath__InvariantViolation(uint256,uint256)`

```solidity
error GenesisLiquidityMath__InvariantViolation(uint256 amountCap, uint256 principal);
```

_No additional NatSpec notice is present in the compiled artifact._

## GenesisPriceMath

Source: [`src/libraries/GenesisPriceMath.sol`](../../packages/contracts/src/libraries/GenesisPriceMath.sol)

Artifact: `out/GenesisPriceMath.sol/GenesisPriceMath.json`

Public ABI: 0 functions, 0 events, 5 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

_This source-defined surface has no externally callable ABI functions._

### Custom errors

#### `GenesisPriceMath__IdenticalTokens()`

```solidity
error GenesisPriceMath__IdenticalTokens();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisPriceMath__InvalidTickSpacing()`

```solidity
error GenesisPriceMath__InvalidTickSpacing();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisPriceMath__PriceDoesNotMatchAmounts(uint160)`

```solidity
error GenesisPriceMath__PriceDoesNotMatchAmounts(uint160 sqrtPriceX96);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisPriceMath__PriceOutsideTickBounds(uint256)`

```solidity
error GenesisPriceMath__PriceOutsideTickBounds(uint256 sqrtPriceX96);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisPriceMath__ZeroAmount()`

```solidity
error GenesisPriceMath__ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

## MiningMath

Source: [`src/libraries/MiningMath.sol`](../../packages/contracts/src/libraries/MiningMath.sol)

Artifact: `out/MiningMath.sol/MiningMath.json`

Public ABI: 0 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

_This source-defined surface has no externally callable ABI functions._

## RateMath

Source: [`src/libraries/RateMath.sol`](../../packages/contracts/src/libraries/RateMath.sol)

Artifact: `out/RateMath.sol/RateMath.json`

Public ABI: 0 functions, 0 events, 2 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

_This source-defined surface has no externally callable ABI functions._

### Custom errors

#### `RateMath__UnsupportedDecimals(uint8)`

```solidity
error RateMath__UnsupportedDecimals(uint8 decimals);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RateMath__ZeroAmount()`

```solidity
error RateMath__ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

## AdapterVerificationEscrow

Source: [`src/liquidity/AdapterVerificationEscrow.sol`](../../packages/contracts/src/liquidity/AdapterVerificationEscrow.sol)

Artifact: `out/AdapterVerificationEscrow.sol/AdapterVerificationEscrow.json`

Public ABI: 11 functions, 2 events, 11 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,address,address)`

```solidity
constructor(contract IPoolManager poolManager_, contract IUniswapPermissionsAdapter permissionsAdapter_, contract IUniswapPermissionsAdapterFactory permissionsAdapterFactory_, address positionManager_, address permissionedHook_, address dependencyInitializer_);
```

Constructs a fixed verification and recycling boundary for one successor graph.

**Parameters**

- `dependencyInitializer_`: One-use account permitted to bind LiquidityManager.
- `permissionedHook_`: Canonical GumBallPermissionedHook.
- `permissionsAdapterFactory_`: Factory that created the adapter.
- `permissionsAdapter_`: GBX permission adapter.
- `poolManager_`: Canonical v4 PoolManager.
- `positionManager_`: Permissioned Position Manager.

### `DEPENDENCY_INITIALIZER()`

```solidity
function DEPENDENCY_INITIALIZER() external view returns (address arg0);
```

One-use account allowed to bind LiquidityManager.

### `LIQUIDITY_MANAGER()`

```solidity
function LIQUIDITY_MANAGER() external view returns (address arg0);
```

LiquidityManager that receives the recycled verification wei.

### `PERMISSIONED_HOOK()`

```solidity
function PERMISSIONED_HOOK() external view returns (address arg0);
```

Canonical hook that the Position Manager must approve.

### `PERMISSIONS_ADAPTER()`

```solidity
function PERMISSIONS_ADAPTER() external view returns (contract IUniswapPermissionsAdapter arg0);
```

GBX permission adapter verified and unwrapped by this contract.

### `PERMISSIONS_ADAPTER_FACTORY()`

```solidity
function PERMISSIONS_ADAPTER_FACTORY() external view returns (contract IUniswapPermissionsAdapterFactory arg0);
```

Factory that created and verifies the adapter.

### `POOL_MANAGER()`

```solidity
function POOL_MANAGER() external view returns (contract IPoolManager arg0);
```

Canonical PoolManager used for the fixed unlock sequence.

### `POSITION_MANAGER()`

```solidity
function POSITION_MANAGER() external view returns (address arg0);
```

Permissioned Position Manager whose hook allowance is checked.

### `VERIFICATION_DEPOSIT()`

```solidity
function VERIFICATION_DEPOSIT() external view returns (uint256 arg0);
```

Exact underlying-token amount used to verify and recycle the adapter deposit.

### `initializeLiquidityManager(address)`

```solidity
function initializeLiquidityManager(address liquidityManager_) external;
```

Permanently binds the only LiquidityManager allowed to trigger verification recovery.

**Parameters**

- `liquidityManager_`: Deployed successor LiquidityManager.

### `recoverVerificationDeposit()`

```solidity
function recoverVerificationDeposit() external;
```

Verifies the adapter and atomically recycles its fixed one-wei deposit.

### `unlockCallback(bytes)`

```solidity
function unlockCallback(bytes arg0) external returns (bytes arg0);
```

Settles and takes the one adapter wei during the fixed PoolManager unlock.

**Returns**

- `_0`: Empty callback result.

### Events

#### `AdapterVerificationEscrow__LiquidityManagerInitialized(address)`

```solidity
event AdapterVerificationEscrow__LiquidityManagerInitialized(address indexed liquidityManager);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AdapterVerificationEscrow__VerificationDepositRecovered(address)`

```solidity
event AdapterVerificationEscrow__VerificationDepositRecovered(address indexed liquidityManager);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `AdapterVerificationEscrow__AlreadyInitialized()`

```solidity
error AdapterVerificationEscrow__AlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AdapterVerificationEscrow__BalanceMismatch(uint256,uint256)`

```solidity
error AdapterVerificationEscrow__BalanceMismatch(uint256 expected, uint256 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AdapterVerificationEscrow__LiquidityManagerMustBeContract(address)`

```solidity
error AdapterVerificationEscrow__LiquidityManagerMustBeContract(address manager);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AdapterVerificationEscrow__LiquidityPermissionMissing(address)`

```solidity
error AdapterVerificationEscrow__LiquidityPermissionMissing(address account);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AdapterVerificationEscrow__NotLiquidityManager(address)`

```solidity
error AdapterVerificationEscrow__NotLiquidityManager(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AdapterVerificationEscrow__NotPoolManager(address)`

```solidity
error AdapterVerificationEscrow__NotPoolManager(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AdapterVerificationEscrow__PositionManagerHookNotAllowed(address)`

```solidity
error AdapterVerificationEscrow__PositionManagerHookNotAllowed(address hook);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AdapterVerificationEscrow__SettlementMismatch(uint256,uint256)`

```solidity
error AdapterVerificationEscrow__SettlementMismatch(uint256 expected, uint256 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AdapterVerificationEscrow__UnauthorizedDependencyInitializer(address)`

```solidity
error AdapterVerificationEscrow__UnauthorizedDependencyInitializer(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AdapterVerificationEscrow__VerificationStateMismatch(address,address)`

```solidity
error AdapterVerificationEscrow__VerificationStateMismatch(address expected, address actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AdapterVerificationEscrow__ZeroAddress()`

```solidity
error AdapterVerificationEscrow__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

## EligibilityAllowlistChecker

Source: [`src/liquidity/EligibilityAllowlistChecker.sol`](../../packages/contracts/src/liquidity/EligibilityAllowlistChecker.sol)

Artifact: `out/EligibilityAllowlistChecker.sol/EligibilityAllowlistChecker.json`

Public ABI: 5 functions, 0 events, 2 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(address gbx_, contract IEligibilityModule eligibilityModule_);
```

Constructs the read-only bridge from canonical GBX eligibility to Uniswap permission flags.

**Parameters**

- `eligibilityModule_`: Canonical holding-eligibility module shared by the protocol.
- `gbx_`: Canonical GBX token queried by the permissioned adapter.

### `ALL_PERMISSIONS()`

```solidity
function ALL_PERMISSIONS() external view returns (PermissionFlag arg0);
```

Both permissions granted by this checker when canonical holding eligibility passes.

### `ELIGIBILITY_MODULE()`

```solidity
function ELIGIBILITY_MODULE() external view returns (contract IEligibilityModule arg0);
```

Read-only protocol eligibility module shared with GBX, mining, staking, and redemption.

### `GBX()`

```solidity
function GBX() external view returns (address arg0);
```

Canonical GBX token for which this checker returns permissions.

### `checkAllowlist(address,address)`

```solidity
function checkAllowlist(address account, address tokenAddress) external view returns (PermissionFlag arg0);
```

Returns the permission flags granted to an account for one permissioned token.

**Parameters**

- `account`: Account whose permissions are queried.
- `tokenAddress`: Underlying permissioned token being queried.

**Returns**

- `_0`: permissions Permission flags granted to the account.

### `supportsInterface(bytes4)`

```solidity
function supportsInterface(bytes4 interfaceId) external pure returns (bool arg0);
```

Returns true if this contract implements the interface defined by `interfaceId`. See the corresponding https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[ERC section] to learn more about how these ids are created. This function call must use less than 30 000 gas.

### Custom errors

#### `EligibilityAllowlistChecker__AddressHasNoCode(address)`

```solidity
error EligibilityAllowlistChecker__AddressHasNoCode(address account);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EligibilityAllowlistChecker__ZeroAddress()`

```solidity
error EligibilityAllowlistChecker__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

## GenesisLiquidityCalculator

Source: [`src/liquidity/GenesisLiquidityCalculator.sol`](../../packages/contracts/src/liquidity/GenesisLiquidityCalculator.sol)

Artifact: `out/GenesisLiquidityCalculator.sol/GenesisLiquidityCalculator.json`

Public ABI: 3 functions, 0 events, 6 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `maxLiquidityForAmount0(uint160,uint160,uint256)`

```solidity
function maxLiquidityForAmount0(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96, uint256 amount0Cap) external pure returns (uint128 liquidity, uint256 principal);
```

Computes the greatest v4 liquidity whose amount0 principal does not exceed a fixed cap.

**Parameters**

- `amount0Cap`: The maximum amount0 principal.
- `sqrtPriceAX96`: The first range-bound square-root price in Q64.96 form.
- `sqrtPriceBX96`: The second range-bound square-root price in Q64.96 form.

**Returns**

- `liquidity`: The greatest representable liquidity within the cap.
- `principal`: The exact amount0 principal consumed by that liquidity.

### `maxLiquidityForAmount1(uint160,uint160,uint256)`

```solidity
function maxLiquidityForAmount1(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96, uint256 amount1Cap) external pure returns (uint128 liquidity, uint256 principal);
```

Computes the greatest v4 liquidity whose amount1 principal does not exceed a fixed cap.

**Parameters**

- `amount1Cap`: The maximum amount1 principal.
- `sqrtPriceAX96`: The first range-bound square-root price in Q64.96 form.
- `sqrtPriceBX96`: The second range-bound square-root price in Q64.96 form.

**Returns**

- `liquidity`: The greatest representable liquidity within the cap.
- `principal`: The exact amount1 principal consumed by that liquidity.

### `validateGenesisSqrtPriceX96(address,address,uint256,uint256,uint160)`

```solidity
function validateGenesisSqrtPriceX96(address gbx, address usdG, uint256 communityUSDG, uint256 genesisMinerGBX, uint160 sqrtPriceX96) external pure;
```

Validates an official Uniswap SDK square-root price witness against the finalized genesis ratio.

**Parameters**

- `communityUSDG`: The raw community USDG accepted at genesis.
- `gbx`: The canonical GBX address used to determine token ordering.
- `genesisMinerGBX`: The fixed raw GBX allocation issued to genesis miners.
- `sqrtPriceX96`: The official SDK square-root price witness encoded as Q64.96.
- `usdG`: The canonical USDG address used to determine token ordering.

### Custom errors

#### `GenesisLiquidityMath__InvalidRange(uint160,uint160)`

```solidity
error GenesisLiquidityMath__InvalidRange(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisLiquidityMath__InvariantViolation(uint256,uint256)`

```solidity
error GenesisLiquidityMath__InvariantViolation(uint256 amountCap, uint256 principal);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisPriceMath__IdenticalTokens()`

```solidity
error GenesisPriceMath__IdenticalTokens();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisPriceMath__PriceDoesNotMatchAmounts(uint160)`

```solidity
error GenesisPriceMath__PriceDoesNotMatchAmounts(uint160 sqrtPriceX96);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisPriceMath__PriceOutsideTickBounds(uint256)`

```solidity
error GenesisPriceMath__PriceOutsideTickBounds(uint256 sqrtPriceX96);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisPriceMath__ZeroAmount()`

```solidity
error GenesisPriceMath__ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

## GumBallPermissionedHook

Source: [`src/liquidity/GumBallPermissionedHook.sol`](../../packages/contracts/src/liquidity/GumBallPermissionedHook.sol)

Artifact: `out/GumBallPermissionedHook.sol/GumBallPermissionedHook.json`

Public ABI: 21 functions, 3 events, 13 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,address,uint24,int24)`

```solidity
constructor(contract IPoolManager poolManager_, contract IUniswapPermissionsAdapterFactory permissionsAdapterFactory_, address dependencyInitializer_, address gbxPermissionsAdapter_, address usdG_, uint24 poolFee_, int24 tickSpacing_);
```

Constructs the canonical permissioned-pool hook and launch guard.

**Parameters**

- `dependencyInitializer_`: One-use account permitted to bind LiquidityManager.
- `gbxPermissionsAdapter_`: Pool-facing GBX permission adapter.
- `permissionsAdapterFactory_`: Factory used to identify verified adapters.
- `poolFee_`: Canonical v4 fee.
- `poolManager_`: Canonical v4 PoolManager.
- `tickSpacing_`: Canonical v4 tick spacing.
- `usdG_`: Canonical USDG currency.

### `DEPENDENCY_INITIALIZER()`

```solidity
function DEPENDENCY_INITIALIZER() external view returns (address arg0);
```

One-use account allowed to bind LiquidityManager.

### `PERMISSIONS_ADAPTER_FACTORY()`

```solidity
function PERMISSIONS_ADAPTER_FACTORY() external view returns (contract IUniswapPermissionsAdapterFactory arg0);
```

Factory used to identify verified permission adapters.

### `POOL_FEE()`

```solidity
function POOL_FEE() external view returns (uint24 arg0);
```

Canonical pool fee in hundredths of a basis point.

### `TICK_SPACING()`

```solidity
function TICK_SPACING() external view returns (int24 arg0);
```

Canonical pool tick spacing.

### `TOKEN0()`

```solidity
function TOKEN0() external view returns (address arg0);
```

Canonical sorted first pool currency.

### `TOKEN1()`

```solidity
function TOKEN1() external view returns (address arg0);
```

Canonical sorted second pool currency.

### `afterAddLiquidity(address,(address,address,uint24,int24,address),(int24,int24,int256,bytes32),int256,int256,bytes)`

```solidity
function afterAddLiquidity(address sender, struct PoolKey key, struct ModifyLiquidityParams params, BalanceDelta delta, BalanceDelta feesAccrued, bytes hookData) external returns (bytes4 arg0, BalanceDelta arg1);
```

The hook called after liquidity is added

**Parameters**

- `delta`: The caller's balance delta after adding liquidity; the sum of principal delta, fees accrued, and hook delta
- `feesAccrued`: The fees accrued since the last time fees were collected from this position
- `hookData`: Arbitrary data handed into the PoolManager by the liquidity provider to be passed on to the hook
- `key`: The key for the pool
- `params`: The parameters for adding liquidity
- `sender`: The initial msg.sender for the add liquidity call

**Returns**

- `_0`: bytes4 The function selector for the hook
- `_1`: BalanceDelta The hook's delta in token0 and token1. Positive: the hook is owed/took currency, negative: the hook owes/sent currency

### `afterDonate(address,(address,address,uint24,int24,address),uint256,uint256,bytes)`

```solidity
function afterDonate(address sender, struct PoolKey key, uint256 amount0, uint256 amount1, bytes hookData) external returns (bytes4 arg0);
```

The hook called after donate

**Parameters**

- `amount0`: The amount of token0 being donated
- `amount1`: The amount of token1 being donated
- `hookData`: Arbitrary data handed into the PoolManager by the donor to be be passed on to the hook
- `key`: The key for the pool
- `sender`: The initial msg.sender for the donate call

**Returns**

- `_0`: bytes4 The function selector for the hook

### `afterInitialize(address,(address,address,uint24,int24,address),uint160,int24)`

```solidity
function afterInitialize(address sender, struct PoolKey key, uint160 sqrtPriceX96, int24 tick) external returns (bytes4 arg0);
```

The hook called after the state of a pool is initialized

**Parameters**

- `key`: The key for the pool being initialized
- `sender`: The initial msg.sender for the initialize call
- `sqrtPriceX96`: The sqrt(price) of the pool as a Q64.96
- `tick`: The current tick after the state of a pool is initialized

**Returns**

- `_0`: bytes4 The function selector for the hook

### `afterRemoveLiquidity(address,(address,address,uint24,int24,address),(int24,int24,int256,bytes32),int256,int256,bytes)`

```solidity
function afterRemoveLiquidity(address sender, struct PoolKey key, struct ModifyLiquidityParams params, BalanceDelta delta, BalanceDelta feesAccrued, bytes hookData) external returns (bytes4 arg0, BalanceDelta arg1);
```

The hook called after liquidity is removed

**Parameters**

- `delta`: The caller's balance delta after removing liquidity; the sum of principal delta, fees accrued, and hook delta
- `feesAccrued`: The fees accrued since the last time fees were collected from this position
- `hookData`: Arbitrary data handed into the PoolManager by the liquidity provider to be be passed on to the hook
- `key`: The key for the pool
- `params`: The parameters for removing liquidity
- `sender`: The initial msg.sender for the remove liquidity call

**Returns**

- `_0`: bytes4 The function selector for the hook
- `_1`: BalanceDelta The hook's delta in token0 and token1. Positive: the hook is owed/took currency, negative: the hook owes/sent currency

### `afterSwap(address,(address,address,uint24,int24,address),(bool,int256,uint160),int256,bytes)`

```solidity
function afterSwap(address sender, struct PoolKey key, struct SwapParams params, BalanceDelta delta, bytes hookData) external returns (bytes4 arg0, int128 arg1);
```

The hook called after a swap

**Parameters**

- `delta`: The amount owed to the caller (positive) or owed to the pool (negative)
- `hookData`: Arbitrary data handed into the PoolManager by the swapper to be be passed on to the hook
- `key`: The key for the pool
- `params`: The parameters for the swap
- `sender`: The initial msg.sender for the swap call

**Returns**

- `_0`: bytes4 The function selector for the hook
- `_1`: int128 The hook's delta in unspecified currency. Positive: the hook is owed/took currency, negative: the hook owes/sent currency

### `beforeAddLiquidity(address,(address,address,uint24,int24,address),(int24,int24,int256,bytes32),bytes)`

```solidity
function beforeAddLiquidity(address sender, struct PoolKey key, struct ModifyLiquidityParams params, bytes hookData) external returns (bytes4 arg0);
```

The hook called before liquidity is added

**Parameters**

- `hookData`: Arbitrary data handed into the PoolManager by the liquidity provider to be passed on to the hook
- `key`: The key for the pool
- `params`: The parameters for adding liquidity
- `sender`: The initial msg.sender for the add liquidity call

**Returns**

- `_0`: bytes4 The function selector for the hook

### `beforeDonate(address,(address,address,uint24,int24,address),uint256,uint256,bytes)`

```solidity
function beforeDonate(address sender, struct PoolKey key, uint256 amount0, uint256 amount1, bytes hookData) external returns (bytes4 arg0);
```

The hook called before donate

**Parameters**

- `amount0`: The amount of token0 being donated
- `amount1`: The amount of token1 being donated
- `hookData`: Arbitrary data handed into the PoolManager by the donor to be be passed on to the hook
- `key`: The key for the pool
- `sender`: The initial msg.sender for the donate call

**Returns**

- `_0`: bytes4 The function selector for the hook

### `beforeInitialize(address,(address,address,uint24,int24,address),uint160)`

```solidity
function beforeInitialize(address sender, struct PoolKey key, uint160 sqrtPriceX96) external returns (bytes4 arg0);
```

The hook called before the state of a pool is initialized

**Parameters**

- `key`: The key for the pool being initialized
- `sender`: The initial msg.sender for the initialize call
- `sqrtPriceX96`: The sqrt(price) of the pool as a Q64.96

**Returns**

- `_0`: bytes4 The function selector for the hook

### `beforeRemoveLiquidity(address,(address,address,uint24,int24,address),(int24,int24,int256,bytes32),bytes)`

```solidity
function beforeRemoveLiquidity(address sender, struct PoolKey key, struct ModifyLiquidityParams params, bytes hookData) external returns (bytes4 arg0);
```

The hook called before liquidity is removed

**Parameters**

- `hookData`: Arbitrary data handed into the PoolManager by the liquidity provider to be be passed on to the hook
- `key`: The key for the pool
- `params`: The parameters for removing liquidity
- `sender`: The initial msg.sender for the remove liquidity call

**Returns**

- `_0`: bytes4 The function selector for the hook

### `beforeSwap(address,(address,address,uint24,int24,address),(bool,int256,uint160),bytes)`

```solidity
function beforeSwap(address sender, struct PoolKey key, struct SwapParams params, bytes hookData) external returns (bytes4 arg0, BeforeSwapDelta arg1, uint24 arg2);
```

The hook called before a swap

**Parameters**

- `hookData`: Arbitrary data handed into the PoolManager by the swapper to be be passed on to the hook
- `key`: The key for the pool
- `params`: The parameters for the swap
- `sender`: The initial msg.sender for the swap call

**Returns**

- `_0`: bytes4 The function selector for the hook
- `_1`: BeforeSwapDelta The hook's delta in specified and unspecified currencies. Positive: the hook is owed/took currency, negative: the hook owes/sent currency
- `_2`: uint24 Optionally override the lp fee, only used if three conditions are met: 1. the Pool has a dynamic fee, 2. the value's 2nd highest bit is set (23rd bit, 0x400000), and 3. the value is less than or equal to the maximum fee (1 million)

### `canonicalPoolInitialized()`

```solidity
function canonicalPoolInitialized() external view returns (bool arg0);
```

Whether the canonical PoolKey has completed its one permitted initialization.

### `getHookPermissions()`

```solidity
function getHookPermissions() external pure returns (struct Hooks.Permissions permissions);
```

Returns the exact v4 callback permission set implemented by this hook.

**Returns**

- `permissions`: Enabled callback flags.

### `initializeLiquidityManager(address)`

```solidity
function initializeLiquidityManager(address liquidityManager_) external;
```

Permanently binds the only LiquidityManager allowed to initialize the canonical pool.

**Parameters**

- `liquidityManager_`: Deployed successor LiquidityManager.

### `liquidityManager()`

```solidity
function liquidityManager() external view returns (address arg0);
```

Protocol LiquidityManager authorized to initialize the canonical PoolKey.

### `poolManager()`

```solidity
function poolManager() external view returns (contract IPoolManager arg0);
```

The Uniswap v4 PoolManager contract

### Events

#### `GumBallPermissionedHook__CanonicalPoolInitialized(bytes32,uint160)`

```solidity
event GumBallPermissionedHook__CanonicalPoolInitialized(bytes32 indexed poolKeyHash, uint160 sqrtPriceX96);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallPermissionedHook__LiquidityManagerInitialized(address)`

```solidity
event GumBallPermissionedHook__LiquidityManagerInitialized(address indexed liquidityManager);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)`

```solidity
event Swap(PoolId indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `GumBallPermissionedHook__AlreadyInitialized()`

```solidity
error GumBallPermissionedHook__AlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallPermissionedHook__InvalidPoolKey()`

```solidity
error GumBallPermissionedHook__InvalidPoolKey();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallPermissionedHook__LiquidityManagerAlreadyInitialized()`

```solidity
error GumBallPermissionedHook__LiquidityManagerAlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallPermissionedHook__LiquidityManagerMustBeContract(address)`

```solidity
error GumBallPermissionedHook__LiquidityManagerMustBeContract(address manager);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallPermissionedHook__NoVerifiedAdapter()`

```solidity
error GumBallPermissionedHook__NoVerifiedAdapter();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallPermissionedHook__SwappingDisabled()`

```solidity
error GumBallPermissionedHook__SwappingDisabled();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallPermissionedHook__Unauthorized()`

```solidity
error GumBallPermissionedHook__Unauthorized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallPermissionedHook__UnauthorizedDependencyInitializer(address)`

```solidity
error GumBallPermissionedHook__UnauthorizedDependencyInitializer(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallPermissionedHook__UnauthorizedInitializer(address)`

```solidity
error GumBallPermissionedHook__UnauthorizedInitializer(address sender);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallPermissionedHook__UnverifiedAdapter()`

```solidity
error GumBallPermissionedHook__UnverifiedAdapter();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallPermissionedHook__ZeroAddress()`

```solidity
error GumBallPermissionedHook__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `HookNotImplemented()`

```solidity
error HookNotImplemented();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `NotPoolManager()`

```solidity
error NotPoolManager();
```

_No additional NatSpec notice is present in the compiled artifact._

## LaunchGuardHook

Source: [`src/liquidity/LaunchGuardHook.sol`](../../packages/contracts/src/liquidity/LaunchGuardHook.sol)

Artifact: `out/LaunchGuardHook.sol/LaunchGuardHook.json`

Public ABI: 20 functions, 2 events, 9 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,uint24,int24)`

```solidity
constructor(contract IPoolManager poolManager_, address dependencyInitializer_, address gbx_, address usdG_, uint24 poolFee_, int24 tickSpacing_);
```

Wires one PoolManager, LiquidityManager, sorted GBX/USDG pair, fee, and tick spacing.

**Parameters**

- `dependencyInitializer_`: The one-use account permitted to bind LiquidityManager.
- `gbx_`: The canonical GBX token.
- `poolFee_`: The immutable canonical pool fee tier.
- `poolManager_`: The canonical Uniswap v4 PoolManager.
- `tickSpacing_`: The immutable canonical pool tick spacing.
- `usdG_`: The canonical USDG token.

### `DEPENDENCY_INITIALIZER()`

```solidity
function DEPENDENCY_INITIALIZER() external view returns (address arg0);
```

One-use account permitted to bind the canonical LiquidityManager.

### `POOL_FEE()`

```solidity
function POOL_FEE() external view returns (uint24 arg0);
```

Immutable canonical v4 pool fee tier.

### `TICK_SPACING()`

```solidity
function TICK_SPACING() external view returns (int24 arg0);
```

Immutable canonical v4 pool tick spacing.

### `TOKEN0()`

```solidity
function TOKEN0() external view returns (address arg0);
```

Lower-address currency of the canonical sorted GBX/USDG pair.

### `TOKEN1()`

```solidity
function TOKEN1() external view returns (address arg0);
```

Higher-address currency of the canonical sorted GBX/USDG pair.

### `afterAddLiquidity(address,(address,address,uint24,int24,address),(int24,int24,int256,bytes32),int256,int256,bytes)`

```solidity
function afterAddLiquidity(address sender, struct PoolKey key, struct ModifyLiquidityParams params, BalanceDelta delta, BalanceDelta feesAccrued, bytes hookData) external returns (bytes4 arg0, BalanceDelta arg1);
```

The hook called after liquidity is added

**Parameters**

- `delta`: The caller's balance delta after adding liquidity; the sum of principal delta, fees accrued, and hook delta
- `feesAccrued`: The fees accrued since the last time fees were collected from this position
- `hookData`: Arbitrary data handed into the PoolManager by the liquidity provider to be passed on to the hook
- `key`: The key for the pool
- `params`: The parameters for adding liquidity
- `sender`: The initial msg.sender for the add liquidity call

**Returns**

- `_0`: bytes4 The function selector for the hook
- `_1`: BalanceDelta The hook's delta in token0 and token1. Positive: the hook is owed/took currency, negative: the hook owes/sent currency

### `afterDonate(address,(address,address,uint24,int24,address),uint256,uint256,bytes)`

```solidity
function afterDonate(address sender, struct PoolKey key, uint256 amount0, uint256 amount1, bytes hookData) external returns (bytes4 arg0);
```

The hook called after donate

**Parameters**

- `amount0`: The amount of token0 being donated
- `amount1`: The amount of token1 being donated
- `hookData`: Arbitrary data handed into the PoolManager by the donor to be be passed on to the hook
- `key`: The key for the pool
- `sender`: The initial msg.sender for the donate call

**Returns**

- `_0`: bytes4 The function selector for the hook

### `afterInitialize(address,(address,address,uint24,int24,address),uint160,int24)`

```solidity
function afterInitialize(address sender, struct PoolKey key, uint160 sqrtPriceX96, int24 tick) external returns (bytes4 arg0);
```

The hook called after the state of a pool is initialized

**Parameters**

- `key`: The key for the pool being initialized
- `sender`: The initial msg.sender for the initialize call
- `sqrtPriceX96`: The sqrt(price) of the pool as a Q64.96
- `tick`: The current tick after the state of a pool is initialized

**Returns**

- `_0`: bytes4 The function selector for the hook

### `afterRemoveLiquidity(address,(address,address,uint24,int24,address),(int24,int24,int256,bytes32),int256,int256,bytes)`

```solidity
function afterRemoveLiquidity(address sender, struct PoolKey key, struct ModifyLiquidityParams params, BalanceDelta delta, BalanceDelta feesAccrued, bytes hookData) external returns (bytes4 arg0, BalanceDelta arg1);
```

The hook called after liquidity is removed

**Parameters**

- `delta`: The caller's balance delta after removing liquidity; the sum of principal delta, fees accrued, and hook delta
- `feesAccrued`: The fees accrued since the last time fees were collected from this position
- `hookData`: Arbitrary data handed into the PoolManager by the liquidity provider to be be passed on to the hook
- `key`: The key for the pool
- `params`: The parameters for removing liquidity
- `sender`: The initial msg.sender for the remove liquidity call

**Returns**

- `_0`: bytes4 The function selector for the hook
- `_1`: BalanceDelta The hook's delta in token0 and token1. Positive: the hook is owed/took currency, negative: the hook owes/sent currency

### `afterSwap(address,(address,address,uint24,int24,address),(bool,int256,uint160),int256,bytes)`

```solidity
function afterSwap(address sender, struct PoolKey key, struct SwapParams params, BalanceDelta delta, bytes hookData) external returns (bytes4 arg0, int128 arg1);
```

The hook called after a swap

**Parameters**

- `delta`: The amount owed to the caller (positive) or owed to the pool (negative)
- `hookData`: Arbitrary data handed into the PoolManager by the swapper to be be passed on to the hook
- `key`: The key for the pool
- `params`: The parameters for the swap
- `sender`: The initial msg.sender for the swap call

**Returns**

- `_0`: bytes4 The function selector for the hook
- `_1`: int128 The hook's delta in unspecified currency. Positive: the hook is owed/took currency, negative: the hook owes/sent currency

### `beforeAddLiquidity(address,(address,address,uint24,int24,address),(int24,int24,int256,bytes32),bytes)`

```solidity
function beforeAddLiquidity(address sender, struct PoolKey key, struct ModifyLiquidityParams params, bytes hookData) external returns (bytes4 arg0);
```

The hook called before liquidity is added

**Parameters**

- `hookData`: Arbitrary data handed into the PoolManager by the liquidity provider to be passed on to the hook
- `key`: The key for the pool
- `params`: The parameters for adding liquidity
- `sender`: The initial msg.sender for the add liquidity call

**Returns**

- `_0`: bytes4 The function selector for the hook

### `beforeDonate(address,(address,address,uint24,int24,address),uint256,uint256,bytes)`

```solidity
function beforeDonate(address sender, struct PoolKey key, uint256 amount0, uint256 amount1, bytes hookData) external returns (bytes4 arg0);
```

The hook called before donate

**Parameters**

- `amount0`: The amount of token0 being donated
- `amount1`: The amount of token1 being donated
- `hookData`: Arbitrary data handed into the PoolManager by the donor to be be passed on to the hook
- `key`: The key for the pool
- `sender`: The initial msg.sender for the donate call

**Returns**

- `_0`: bytes4 The function selector for the hook

### `beforeInitialize(address,(address,address,uint24,int24,address),uint160)`

```solidity
function beforeInitialize(address sender, struct PoolKey key, uint160 sqrtPriceX96) external returns (bytes4 arg0);
```

The hook called before the state of a pool is initialized

**Parameters**

- `key`: The key for the pool being initialized
- `sender`: The initial msg.sender for the initialize call
- `sqrtPriceX96`: The sqrt(price) of the pool as a Q64.96

**Returns**

- `_0`: bytes4 The function selector for the hook

### `beforeRemoveLiquidity(address,(address,address,uint24,int24,address),(int24,int24,int256,bytes32),bytes)`

```solidity
function beforeRemoveLiquidity(address sender, struct PoolKey key, struct ModifyLiquidityParams params, bytes hookData) external returns (bytes4 arg0);
```

The hook called before liquidity is removed

**Parameters**

- `hookData`: Arbitrary data handed into the PoolManager by the liquidity provider to be be passed on to the hook
- `key`: The key for the pool
- `params`: The parameters for removing liquidity
- `sender`: The initial msg.sender for the remove liquidity call

**Returns**

- `_0`: bytes4 The function selector for the hook

### `beforeSwap(address,(address,address,uint24,int24,address),(bool,int256,uint160),bytes)`

```solidity
function beforeSwap(address sender, struct PoolKey key, struct SwapParams params, bytes hookData) external returns (bytes4 arg0, BeforeSwapDelta arg1, uint24 arg2);
```

The hook called before a swap

**Parameters**

- `hookData`: Arbitrary data handed into the PoolManager by the swapper to be be passed on to the hook
- `key`: The key for the pool
- `params`: The parameters for the swap
- `sender`: The initial msg.sender for the swap call

**Returns**

- `_0`: bytes4 The function selector for the hook
- `_1`: BeforeSwapDelta The hook's delta in specified and unspecified currencies. Positive: the hook is owed/took currency, negative: the hook owes/sent currency
- `_2`: uint24 Optionally override the lp fee, only used if three conditions are met: 1. the Pool has a dynamic fee, 2. the value's 2nd highest bit is set (23rd bit, 0x400000), and 3. the value is less than or equal to the maximum fee (1 million)

### `canonicalPoolInitialized()`

```solidity
function canonicalPoolInitialized() external view returns (bool arg0);
```

Whether the one permitted canonical pool initialization has completed.

### `getHookPermissions()`

```solidity
function getHookPermissions() external pure returns (struct Hooks.Permissions permissions);
```

Returns a struct of permissions to signal which hook functions are to be implemented
Used at deployment to validate the address correctly represents the expected permissions

**Returns**

- `permissions`: Permissions struct

### `initializeLiquidityManager(address)`

```solidity
function initializeLiquidityManager(address liquidityManager_) external;
```

Resolves the hook-manager construction cycle exactly once before canonical pool initialization.

**Parameters**

- `liquidityManager_`: The deployed canonical LiquidityManager contract.

### `liquidityManager()`

```solidity
function liquidityManager() external view returns (address arg0);
```

Canonical LiquidityManager bound before pool initialization.

### `poolManager()`

```solidity
function poolManager() external view returns (contract IPoolManager arg0);
```

The Uniswap v4 PoolManager contract

### Events

#### `LaunchGuardHook__CanonicalPoolInitialized(bytes32,uint160)`

```solidity
event LaunchGuardHook__CanonicalPoolInitialized(bytes32 indexed poolKeyHash, uint160 sqrtPriceX96);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LaunchGuardHook__LiquidityManagerInitialized(address)`

```solidity
event LaunchGuardHook__LiquidityManagerInitialized(address indexed liquidityManager);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `HookNotImplemented()`

```solidity
error HookNotImplemented();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LaunchGuardHook__AlreadyInitialized()`

```solidity
error LaunchGuardHook__AlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LaunchGuardHook__InvalidPoolKey()`

```solidity
error LaunchGuardHook__InvalidPoolKey();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LaunchGuardHook__LiquidityManagerAlreadyInitialized()`

```solidity
error LaunchGuardHook__LiquidityManagerAlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LaunchGuardHook__LiquidityManagerMustBeContract(address)`

```solidity
error LaunchGuardHook__LiquidityManagerMustBeContract(address manager);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LaunchGuardHook__UnauthorizedDependencyInitializer(address)`

```solidity
error LaunchGuardHook__UnauthorizedDependencyInitializer(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LaunchGuardHook__UnauthorizedInitializer(address)`

```solidity
error LaunchGuardHook__UnauthorizedInitializer(address sender);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LaunchGuardHook__ZeroAddress()`

```solidity
error LaunchGuardHook__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `NotPoolManager()`

```solidity
error NotPoolManager();
```

_No additional NatSpec notice is present in the compiled artifact._

## LiquidityManager

Source: [`src/liquidity/LiquidityManager.sol`](../../packages/contracts/src/liquidity/LiquidityManager.sol)

Artifact: `out/LiquidityManager.sol/LiquidityManager.json`

Public ABI: 41 functions, 9 events, 29 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor((address,address,address,address,address,address,address,address,address,address,address,address),(uint24,int24,uint16[4],int24[4]))`

```solidity
constructor(struct LiquidityManager.Dependencies dependencies, struct LiquidityManager.LadderConfig ladder);
```

Wires canonical v4 contracts and immutable pre-launch ladder settings.

**Parameters**

- `dependencies`: Canonical protocol, Uniswap v4, bootstrap, timelock, and guardian addresses.
- `ladder`: Immutable pool fee, tick spacing, allocation shares, and cumulative range widths.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (contract AllocationVoter arg0);
```

Canonical voter notified only for USDG actually received by the vault.

### `BPS_DENOMINATOR()`

```solidity
function BPS_DENOMINATOR() external view returns (uint256 arg0);
```

Basis-point denominator used by the four-range allocation ladder.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Stop-only authority permitted to pause new migrations.

### `GBX()`

```solidity
function GBX() external view returns (contract IGBXToken arg0);
```

Canonical GBX committed to positions or burned when collected or residual.

### `GENESIS_BOOTSTRAP()`

```solidity
function GENESIS_BOOTSTRAP() external view returns (address arg0);
```

Canonical GenesisBootstrap permitted to initialize and seed liquidity once.

### `GENESIS_LIQUIDITY_ALLOCATION()`

```solidity
function GENESIS_LIQUIDITY_ALLOCATION() external view returns (uint256 arg0);
```

Fixed fully backed GBX allocation committed to protocol-owned v4 liquidity.

### `GENESIS_LIQUIDITY_CALCULATOR()`

```solidity
function GENESIS_LIQUIDITY_CALCULATOR() external view returns (contract GenesisLiquidityCalculator arg0);
```

Reviewed maximal integer-liquidity calculator used for each one-sided range.

### `GENESIS_MINER_ALLOCATION()`

```solidity
function GENESIS_MINER_ALLOCATION() external view returns (uint256 arg0);
```

Fixed GBX community allocation whose endogenous price anchors the canonical pool.

### `GUM_BALL_VAULT()`

```solidity
function GUM_BALL_VAULT() external view returns (address arg0);
```

Canonical vault receiving every observed USDG receipt.

### `LAUNCH_GUARD_HOOK()`

```solidity
function LAUNCH_GUARD_HOOK() external view returns (contract IHooks arg0);
```

Canonical pool hook embedded in the PoolKey. The base deployment uses LaunchGuardHook.

### `MAX_ACTIVE_POSITIONS()`

```solidity
function MAX_ACTIVE_POSITIONS() external view returns (uint256 arg0);
```

Maximum canonical positions that may remain active after any sequence of migrations.

### `MAX_MIGRATION_POSITIONS()`

```solidity
function MAX_MIGRATION_POSITIONS() external view returns (uint256 arg0);
```

Maximum removed or replacement positions allowed in one reviewed migration.

### `PERMIT2()`

```solidity
function PERMIT2() external view returns (contract IAllowanceTransfer arg0);
```

Canonical Permit2 approval boundary used only while minting genesis positions.

### `POOL_FEE()`

```solidity
function POOL_FEE() external view returns (uint24 arg0);
```

Immutable canonical v4 fee tier.

### `POOL_MANAGER()`

```solidity
function POOL_MANAGER() external view returns (contract IPoolManager arg0);
```

Canonical Uniswap v4 PoolManager for the GBX/USDG pool.

### `POSITION_COUNT()`

```solidity
function POSITION_COUNT() external view returns (uint256 arg0);
```

Fixed number of one-sided ranges minted at genesis.

### `POSITION_MANAGER()`

```solidity
function POSITION_MANAGER() external view returns (contract IPositionManager arg0);
```

Canonical Uniswap v4 PositionManager minting and burning protocol-owned NFTs.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Purpose-limited delayed authority permitted to execute reviewed migrations.

### `TICK_SPACING()`

```solidity
function TICK_SPACING() external view returns (int24 arg0);
```

Immutable canonical v4 tick spacing.

### `USDG()`

```solidity
function USDG() external view returns (contract IERC20 arg0);
```

Canonical USDG routed from fees and completed positions into GumBallVault.

### `activePositionCount()`

```solidity
function activePositionCount() external view returns (uint256 arg0);
```

Number of canonical position records that currently exist and remain protocol-owned.

### `allocationBps(uint256)`

```solidity
function allocationBps(uint256 arg0) external view returns (uint16 arg0);
```

Genesis GBX allocation share for each of the four positions, in basis points.

### `collectFees(uint256)`

```solidity
function collectFees(uint256 positionId) external returns (uint256 gbxBurned, uint256 usdGToVault);
```

Permissionlessly collects fees without decreasing principal, burns GBX fees, and routes USDG fees to GumBallVault before notifying future allocation weights.

**Parameters**

- `positionId`: The recorded protocol-owned position whose accrued fees are collected.

**Returns**

- `gbxBurned`: The raw collected GBX fee amount irreversibly burned.
- `usdGToVault`: The raw USDG amount actually received by GumBallVault.

### `cumulativeTickDeltas(uint256)`

```solidity
function cumulativeTickDeltas(uint256 arg0) external view returns (int24 arg0);
```

Cumulative aligned tick width of each successively wider genesis range.

### `genesisLiquidityPrincipal()`

```solidity
function genesisLiquidityPrincipal() external view returns (uint256 arg0);
```

Exact raw GBX principal committed across all four genesis positions.

### `genesisLiquidityResidual()`

```solidity
function genesisLiquidityResidual() external view returns (uint256 arg0);
```

Raw GBX integer-rounding residual retained after genesis position minting.

### `genesisSeeded()`

```solidity
function genesisSeeded() external view returns (bool arg0);
```

Whether the canonical pool and four genesis positions have been initialized exactly once.

### `genesisSqrtPriceX96()`

```solidity
function genesisSqrtPriceX96() external view returns (uint160 arg0);
```

Endogenous canonical-pool initialization price encoded as Q64.96.

### `genesisTick()`

```solidity
function genesisTick() external view returns (int24 arg0);
```

Initial canonical-pool tick returned by PoolManager.

### `initializeAndSeed(uint256,uint160)`

```solidity
function initializeAndSeed(uint256 communityUSDG, uint160 sqrtPriceX96) external returns (uint160 initializedSqrtPriceX96);
```

Atomically initializes the guarded pool and mints the four configured GBX-only positions.

**Parameters**

- `communityUSDG`: Raw USDG atomic units accepted from genesis miners.
- `sqrtPriceX96`: Official Uniswap SDK encoding of the exact raw genesis ratio.

**Returns**

- `initializedSqrtPriceX96`: Canonical initial raw token1-per-token0 square-root price.

### `lastMigrationPlanHash()`

```solidity
function lastMigrationPlanHash() external view returns (bytes32 arg0);
```

ABI-bound hash of the most recently completed migration plan.

### `migrateLiquidity(((address,address,uint24,int24,address),(uint256,uint128,uint128)[],(int24,int24,uint128,uint128,uint128)[],uint256))`

```solidity
function migrateLiquidity(struct LiquidityManager.MigrationPlan plan) external returns (uint256[] replacementPositionIds, uint256 gbxResidualBurned, uint256 usdGResidualToVault);
```

Atomically burns old position NFTs and mints only precommitted replacement positions.
The final TAKE_PAIR action rejects any plan whose replacement positions need more than the removed principal. There is no arbitrary recipient, spender, target, call, hook data, or NFT transfer input.

**Parameters**

- `plan`: The complete destination key, removal minima, replacement maxima, and deadline committed by timelock.

**Returns**

- `gbxResidualBurned`: The raw GBX residual irreversibly burned after migration.
- `replacementPositionIds`: The token IDs of the newly minted protocol-owned positions.
- `usdGResidualToVault`: The raw USDG residual actually received by GumBallVault after migration.

### `migrationCount()`

```solidity
function migrationCount() external view returns (uint256 arg0);
```

Number of successfully completed reviewed liquidity migrations.

### `migrationsPaused()`

```solidity
function migrationsPaused() external view returns (bool arg0);
```

Whether the guardian has temporarily stopped new liquidity migrations.

### `onERC721Received(address,address,uint256,bytes)`

```solidity
function onERC721Received(address arg0, address arg1, uint256 arg2, bytes arg3) external pure returns (bytes4 arg0);
```

Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom} by `operator` from `from`, this function is called. It must return its Solidity selector to confirm the token transfer. If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted. The selector can be obtained in Solidity with `IERC721Receiver.onERC721Received.selector`.

### `pauseMigrations()`

```solidity
function pauseMigrations() external;
```

Immediately stops only migrations; fee collection and completed-range sweeping remain live.

### `poolKey()`

```solidity
function poolKey() external view returns (struct PoolKey key);
```

Returns the immutable canonical pool key.

**Returns**

- `key`: The sorted pool-facing GBX currency/USDG pair, fee, tick spacing, and canonical hook.

### `positionIds(uint256)`

```solidity
function positionIds(uint256 arg0) external view returns (uint256 arg0);
```

Token ID of each canonical genesis position.

### `positionRecord(uint256)`

```solidity
function positionRecord(uint256 positionId) external view returns (int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 gbxPrincipal, bool exists);
```

Custody and principal record for each current or historical protocol position.

### `sweepCompletedRange(uint256)`

```solidity
function sweepCompletedRange(uint256 positionId) external returns (uint256 gbxDustBurned, uint256 usdGPrincipalAndFeesToVault);
```

Burns a completed position NFT and routes all proceeds to protocol-only destinations.
Anyone may call only after price has crossed the position's terminal boundary. There is no recipient input.

**Parameters**

- `positionId`: The recorded position whose full range has crossed its terminal boundary.

**Returns**

- `gbxDustBurned`: The raw residual GBX amount irreversibly burned.
- `usdGPrincipalAndFeesToVault`: The raw USDG principal and fees actually received by GumBallVault.

### `unpauseMigrations()`

```solidity
function unpauseMigrations() external;
```

Reopens migrations only through a separately scheduled ProtocolTimelock operation.

### Events

#### `LiquidityManager__CanonicalPoolSeeded(bytes32,uint160,int24,uint256,uint256,uint256)`

```solidity
event LiquidityManager__CanonicalPoolSeeded(bytes32 indexed poolKeyHash, uint160 sqrtPriceX96, int24 initialTick, uint256 firstPositionId, uint256 gbxPrincipal, uint256 gbxResidual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__CompletedRangeSwept(uint256,int24,uint256,uint256)`

```solidity
event LiquidityManager__CompletedRangeSwept(uint256 indexed positionId, int24 currentTick, uint256 gbxDustBurned, uint256 usdGPrincipalAndFeesToVault);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__FeesCollected(uint256,uint256,uint256)`

```solidity
event LiquidityManager__FeesCollected(uint256 indexed positionId, uint256 gbxBurned, uint256 usdGToVault);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__MigrationCompleted(bytes32,bytes32,uint256[],uint256[],uint256,uint256)`

```solidity
event LiquidityManager__MigrationCompleted(bytes32 indexed planHash, bytes32 indexed destinationPoolKeyHash, uint256[] removedPositionIds, uint256[] replacementPositionIds, uint256 gbxResidualBurned, uint256 usdGResidualToVault);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__MigrationPauseSet(bool)`

```solidity
event LiquidityManager__MigrationPauseSet(bool paused);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__MigrationPositionAfter(bytes32,uint256,int24,int24,uint128,uint128,uint128)`

```solidity
event LiquidityManager__MigrationPositionAfter(bytes32 indexed planHash, uint256 indexed positionId, int24 tickLower, int24 tickUpper, uint128 liquidity, uint128 amount0Max, uint128 amount1Max);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__MigrationPositionBefore(bytes32,uint256,int24,int24,uint128,uint128,uint128)`

```solidity
event LiquidityManager__MigrationPositionBefore(bytes32 indexed planHash, uint256 indexed positionId, int24 tickLower, int24 tickUpper, uint128 liquidity, uint128 amount0Min, uint128 amount1Min);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__MigrationStarted(bytes32,bytes32,uint256,uint256,uint256)`

```solidity
event LiquidityManager__MigrationStarted(bytes32 indexed planHash, bytes32 indexed destinationPoolKeyHash, uint256 removalCount, uint256 replacementCount, uint256 deadline);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__PositionRecorded(uint256,int24,int24,uint128,uint256)`

```solidity
event LiquidityManager__PositionRecorded(uint256 indexed positionId, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 gbxPrincipal);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `GenesisPriceMath__InvalidTickSpacing()`

```solidity
error GenesisPriceMath__InvalidTickSpacing();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__ActivePositionLimitExceeded(uint256,uint256,uint256,uint256)`

```solidity
error LiquidityManager__ActivePositionLimitExceeded(uint256 currentActive, uint256 removalCount, uint256 replacementCount, uint256 maximumActive);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__AddressHasNoCode(address)`

```solidity
error LiquidityManager__AddressHasNoCode(address account);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__AlreadySeeded()`

```solidity
error LiquidityManager__AlreadySeeded();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__DeadlineExpired(uint256)`

```solidity
error LiquidityManager__DeadlineExpired(uint256 deadline);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__DuplicateMigrationPosition(uint256)`

```solidity
error LiquidityManager__DuplicateMigrationPosition(uint256 positionId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__GenesisBalanceMismatch(uint256,uint256)`

```solidity
error LiquidityManager__GenesisBalanceMismatch(uint256 expected, uint256 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__GenesisNotSeeded()`

```solidity
error LiquidityManager__GenesisNotSeeded();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__GenesisPrincipalMismatch(uint256,uint256)`

```solidity
error LiquidityManager__GenesisPrincipalMismatch(uint256 expected, uint256 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__InsufficientGenesisGBX(uint256,uint256)`

```solidity
error LiquidityManager__InsufficientGenesisGBX(uint256 required, uint256 available);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__InvalidAllocation()`

```solidity
error LiquidityManager__InvalidAllocation();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__InvalidDestinationPoolKey(bytes32,bytes32)`

```solidity
error LiquidityManager__InvalidDestinationPoolKey(bytes32 expected, bytes32 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__InvalidMigrationLength(uint256,uint256)`

```solidity
error LiquidityManager__InvalidMigrationLength(uint256 removals, uint256 replacements);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__InvalidMigrationSlippage()`

```solidity
error LiquidityManager__InvalidMigrationSlippage();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__InvalidRange()`

```solidity
error LiquidityManager__InvalidRange();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__MigrationsPaused()`

```solidity
error LiquidityManager__MigrationsPaused();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__NotEmergencyGuardian(address)`

```solidity
error LiquidityManager__NotEmergencyGuardian(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__NotGenesisBootstrap(address)`

```solidity
error LiquidityManager__NotGenesisBootstrap(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__NotProtocolTimelock(address)`

```solidity
error LiquidityManager__NotProtocolTimelock(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__PositionLiquidityMismatch(uint256,uint128,uint128)`

```solidity
error LiquidityManager__PositionLiquidityMismatch(uint256 positionId, uint128 expected, uint128 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__PositionNotOwned(uint256,address)`

```solidity
error LiquidityManager__PositionNotOwned(uint256 positionId, address owner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__RangeNotCompleted(uint256,int24)`

```solidity
error LiquidityManager__RangeNotCompleted(uint256 positionId, int24 currentTick);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__UnexpectedMintedPositionCount(uint256,uint256)`

```solidity
error LiquidityManager__UnexpectedMintedPositionCount(uint256 expectedNextPositionId, uint256 actualNextPositionId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__UnknownPosition(uint256)`

```solidity
error LiquidityManager__UnknownPosition(uint256 tokenId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__ZeroAddress()`

```solidity
error LiquidityManager__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__ZeroUSDGReceived()`

```solidity
error LiquidityManager__ZeroUSDGReceived();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeCastOverflowedUintDowncast(uint8,uint256)`

```solidity
error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeERC20FailedOperation(address)`

```solidity
error SafeERC20FailedOperation(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

## PermissionedLiquidityManager

Source: [`src/liquidity/PermissionedLiquidityManager.sol`](../../packages/contracts/src/liquidity/PermissionedLiquidityManager.sol)

Artifact: `out/PermissionedLiquidityManager.sol/PermissionedLiquidityManager.json`

Public ABI: 44 functions, 9 events, 39 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor((address,address,address,address,address,address,address,address,address,address,address,address),(uint24,int24,uint16[4],int24[4]),address,address,address)`

```solidity
constructor(struct LiquidityManager.Dependencies dependencies, struct LiquidityManager.LadderConfig ladder, contract IUniswapPermissionsAdapterFactory permissionsAdapterFactory_, contract IUniswapPermissionsAdapter gbxPermissionsAdapter_, contract IAdapterVerificationEscrow adapterVerificationEscrow_);
```

Constructs the successor manager and validates its complete permissioned-pool graph.

**Parameters**

- `adapterVerificationEscrow_`: Fixed verification-deposit recycler.
- `dependencies`: Base LiquidityManager dependency graph.
- `gbxPermissionsAdapter_`: Pool-facing GBX adapter.
- `ladder`: Canonical fee, spacing, allocation, and range ladder.
- `permissionsAdapterFactory_`: Factory that created the GBX adapter.

### `ADAPTER_VERIFICATION_ESCROW()`

```solidity
function ADAPTER_VERIFICATION_ESCROW() external view returns (contract IAdapterVerificationEscrow arg0);
```

Fixed-purpose contract that verifies the adapter and recycles its one-wei deposit.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (contract AllocationVoter arg0);
```

Canonical voter notified only for USDG actually received by the vault.

### `BPS_DENOMINATOR()`

```solidity
function BPS_DENOMINATOR() external view returns (uint256 arg0);
```

Basis-point denominator used by the four-range allocation ladder.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Stop-only authority permitted to pause new migrations.

### `GBX()`

```solidity
function GBX() external view returns (contract IGBXToken arg0);
```

Canonical GBX committed to positions or burned when collected or residual.

### `GBX_PERMISSIONS_ADAPTER()`

```solidity
function GBX_PERMISSIONS_ADAPTER() external view returns (contract IUniswapPermissionsAdapter arg0);
```

Pool-facing permission adapter backed one-for-one by underlying GBX.

### `GENESIS_BOOTSTRAP()`

```solidity
function GENESIS_BOOTSTRAP() external view returns (address arg0);
```

Canonical GenesisBootstrap permitted to initialize and seed liquidity once.

### `GENESIS_LIQUIDITY_ALLOCATION()`

```solidity
function GENESIS_LIQUIDITY_ALLOCATION() external view returns (uint256 arg0);
```

Fixed fully backed GBX allocation committed to protocol-owned v4 liquidity.

### `GENESIS_LIQUIDITY_CALCULATOR()`

```solidity
function GENESIS_LIQUIDITY_CALCULATOR() external view returns (contract GenesisLiquidityCalculator arg0);
```

Reviewed maximal integer-liquidity calculator used for each one-sided range.

### `GENESIS_MINER_ALLOCATION()`

```solidity
function GENESIS_MINER_ALLOCATION() external view returns (uint256 arg0);
```

Fixed GBX community allocation whose endogenous price anchors the canonical pool.

### `GUM_BALL_VAULT()`

```solidity
function GUM_BALL_VAULT() external view returns (address arg0);
```

Canonical vault receiving every observed USDG receipt.

### `LAUNCH_GUARD_HOOK()`

```solidity
function LAUNCH_GUARD_HOOK() external view returns (contract IHooks arg0);
```

Canonical pool hook embedded in the PoolKey. The base deployment uses LaunchGuardHook.

### `MAX_ACTIVE_POSITIONS()`

```solidity
function MAX_ACTIVE_POSITIONS() external view returns (uint256 arg0);
```

Maximum canonical positions that may remain active after any sequence of migrations.

### `MAX_MIGRATION_POSITIONS()`

```solidity
function MAX_MIGRATION_POSITIONS() external view returns (uint256 arg0);
```

Maximum removed or replacement positions allowed in one reviewed migration.

### `PERMISSIONS_ADAPTER_FACTORY()`

```solidity
function PERMISSIONS_ADAPTER_FACTORY() external view returns (contract IUniswapPermissionsAdapterFactory arg0);
```

Factory that created and verifies the GBX adapter.

### `PERMIT2()`

```solidity
function PERMIT2() external view returns (contract IAllowanceTransfer arg0);
```

Canonical Permit2 approval boundary used only while minting genesis positions.

### `POOL_FEE()`

```solidity
function POOL_FEE() external view returns (uint24 arg0);
```

Immutable canonical v4 fee tier.

### `POOL_MANAGER()`

```solidity
function POOL_MANAGER() external view returns (contract IPoolManager arg0);
```

Canonical Uniswap v4 PoolManager for the GBX/USDG pool.

### `POSITION_COUNT()`

```solidity
function POSITION_COUNT() external view returns (uint256 arg0);
```

Fixed number of one-sided ranges minted at genesis.

### `POSITION_MANAGER()`

```solidity
function POSITION_MANAGER() external view returns (contract IPositionManager arg0);
```

Canonical Uniswap v4 PositionManager minting and burning protocol-owned NFTs.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Purpose-limited delayed authority permitted to execute reviewed migrations.

### `TICK_SPACING()`

```solidity
function TICK_SPACING() external view returns (int24 arg0);
```

Immutable canonical v4 tick spacing.

### `USDG()`

```solidity
function USDG() external view returns (contract IERC20 arg0);
```

Canonical USDG routed from fees and completed positions into GumBallVault.

### `activePositionCount()`

```solidity
function activePositionCount() external view returns (uint256 arg0);
```

Number of canonical position records that currently exist and remain protocol-owned.

### `allocationBps(uint256)`

```solidity
function allocationBps(uint256 arg0) external view returns (uint16 arg0);
```

Genesis GBX allocation share for each of the four positions, in basis points.

### `collectFees(uint256)`

```solidity
function collectFees(uint256 positionId) external returns (uint256 gbxBurned, uint256 usdGToVault);
```

Permissionlessly collects fees without decreasing principal, burns GBX fees, and routes USDG fees to GumBallVault before notifying future allocation weights.

**Parameters**

- `positionId`: The recorded protocol-owned position whose accrued fees are collected.

**Returns**

- `gbxBurned`: The raw collected GBX fee amount irreversibly burned.
- `usdGToVault`: The raw USDG amount actually received by GumBallVault.

### `cumulativeTickDeltas(uint256)`

```solidity
function cumulativeTickDeltas(uint256 arg0) external view returns (int24 arg0);
```

Cumulative aligned tick width of each successively wider genesis range.

### `genesisLiquidityPrincipal()`

```solidity
function genesisLiquidityPrincipal() external view returns (uint256 arg0);
```

Exact raw GBX principal committed across all four genesis positions.

### `genesisLiquidityResidual()`

```solidity
function genesisLiquidityResidual() external view returns (uint256 arg0);
```

Raw GBX integer-rounding residual retained after genesis position minting.

### `genesisSeeded()`

```solidity
function genesisSeeded() external view returns (bool arg0);
```

Whether the canonical pool and four genesis positions have been initialized exactly once.

### `genesisSqrtPriceX96()`

```solidity
function genesisSqrtPriceX96() external view returns (uint160 arg0);
```

Endogenous canonical-pool initialization price encoded as Q64.96.

### `genesisTick()`

```solidity
function genesisTick() external view returns (int24 arg0);
```

Initial canonical-pool tick returned by PoolManager.

### `initializeAndSeed(uint256,uint160)`

```solidity
function initializeAndSeed(uint256 communityUSDG, uint160 sqrtPriceX96) external returns (uint160 initializedSqrtPriceX96);
```

Atomically initializes the guarded pool and mints the four configured GBX-only positions.

**Parameters**

- `communityUSDG`: Raw USDG atomic units accepted from genesis miners.
- `sqrtPriceX96`: Official Uniswap SDK encoding of the exact raw genesis ratio.

**Returns**

- `initializedSqrtPriceX96`: Canonical initial raw token1-per-token0 square-root price.

### `lastMigrationPlanHash()`

```solidity
function lastMigrationPlanHash() external view returns (bytes32 arg0);
```

ABI-bound hash of the most recently completed migration plan.

### `migrateLiquidity(((address,address,uint24,int24,address),(uint256,uint128,uint128)[],(int24,int24,uint128,uint128,uint128)[],uint256))`

```solidity
function migrateLiquidity(struct LiquidityManager.MigrationPlan plan) external returns (uint256[] replacementPositionIds, uint256 gbxResidualBurned, uint256 usdGResidualToVault);
```

Atomically burns old position NFTs and mints only precommitted replacement positions.
The final TAKE_PAIR action rejects any plan whose replacement positions need more than the removed principal. There is no arbitrary recipient, spender, target, call, hook data, or NFT transfer input.

**Parameters**

- `plan`: The complete destination key, removal minima, replacement maxima, and deadline committed by timelock.

**Returns**

- `gbxResidualBurned`: The raw GBX residual irreversibly burned after migration.
- `replacementPositionIds`: The token IDs of the newly minted protocol-owned positions.
- `usdGResidualToVault`: The raw USDG residual actually received by GumBallVault after migration.

### `migrationCount()`

```solidity
function migrationCount() external view returns (uint256 arg0);
```

Number of successfully completed reviewed liquidity migrations.

### `migrationsPaused()`

```solidity
function migrationsPaused() external view returns (bool arg0);
```

Whether the guardian has temporarily stopped new liquidity migrations.

### `onERC721Received(address,address,uint256,bytes)`

```solidity
function onERC721Received(address arg0, address arg1, uint256 arg2, bytes arg3) external pure returns (bytes4 arg0);
```

Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom} by `operator` from `from`, this function is called. It must return its Solidity selector to confirm the token transfer. If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted. The selector can be obtained in Solidity with `IERC721Receiver.onERC721Received.selector`.

### `pauseMigrations()`

```solidity
function pauseMigrations() external;
```

Immediately stops only migrations; fee collection and completed-range sweeping remain live.

### `poolKey()`

```solidity
function poolKey() external view returns (struct PoolKey key);
```

Returns the immutable canonical pool key.

**Returns**

- `key`: The sorted pool-facing GBX currency/USDG pair, fee, tick spacing, and canonical hook.

### `positionIds(uint256)`

```solidity
function positionIds(uint256 arg0) external view returns (uint256 arg0);
```

Token ID of each canonical genesis position.

### `positionRecord(uint256)`

```solidity
function positionRecord(uint256 positionId) external view returns (int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 gbxPrincipal, bool exists);
```

Custody and principal record for each current or historical protocol position.

### `sweepCompletedRange(uint256)`

```solidity
function sweepCompletedRange(uint256 positionId) external returns (uint256 gbxDustBurned, uint256 usdGPrincipalAndFeesToVault);
```

Burns a completed position NFT and routes all proceeds to protocol-only destinations.
Anyone may call only after price has crossed the position's terminal boundary. There is no recipient input.

**Parameters**

- `positionId`: The recorded position whose full range has crossed its terminal boundary.

**Returns**

- `gbxDustBurned`: The raw residual GBX amount irreversibly burned.
- `usdGPrincipalAndFeesToVault`: The raw USDG principal and fees actually received by GumBallVault.

### `unpauseMigrations()`

```solidity
function unpauseMigrations() external;
```

Reopens migrations only through a separately scheduled ProtocolTimelock operation.

### Events

#### `LiquidityManager__CanonicalPoolSeeded(bytes32,uint160,int24,uint256,uint256,uint256)`

```solidity
event LiquidityManager__CanonicalPoolSeeded(bytes32 indexed poolKeyHash, uint160 sqrtPriceX96, int24 initialTick, uint256 firstPositionId, uint256 gbxPrincipal, uint256 gbxResidual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__CompletedRangeSwept(uint256,int24,uint256,uint256)`

```solidity
event LiquidityManager__CompletedRangeSwept(uint256 indexed positionId, int24 currentTick, uint256 gbxDustBurned, uint256 usdGPrincipalAndFeesToVault);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__FeesCollected(uint256,uint256,uint256)`

```solidity
event LiquidityManager__FeesCollected(uint256 indexed positionId, uint256 gbxBurned, uint256 usdGToVault);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__MigrationCompleted(bytes32,bytes32,uint256[],uint256[],uint256,uint256)`

```solidity
event LiquidityManager__MigrationCompleted(bytes32 indexed planHash, bytes32 indexed destinationPoolKeyHash, uint256[] removedPositionIds, uint256[] replacementPositionIds, uint256 gbxResidualBurned, uint256 usdGResidualToVault);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__MigrationPauseSet(bool)`

```solidity
event LiquidityManager__MigrationPauseSet(bool paused);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__MigrationPositionAfter(bytes32,uint256,int24,int24,uint128,uint128,uint128)`

```solidity
event LiquidityManager__MigrationPositionAfter(bytes32 indexed planHash, uint256 indexed positionId, int24 tickLower, int24 tickUpper, uint128 liquidity, uint128 amount0Max, uint128 amount1Max);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__MigrationPositionBefore(bytes32,uint256,int24,int24,uint128,uint128,uint128)`

```solidity
event LiquidityManager__MigrationPositionBefore(bytes32 indexed planHash, uint256 indexed positionId, int24 tickLower, int24 tickUpper, uint128 liquidity, uint128 amount0Min, uint128 amount1Min);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__MigrationStarted(bytes32,bytes32,uint256,uint256,uint256)`

```solidity
event LiquidityManager__MigrationStarted(bytes32 indexed planHash, bytes32 indexed destinationPoolKeyHash, uint256 removalCount, uint256 replacementCount, uint256 deadline);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__PositionRecorded(uint256,int24,int24,uint128,uint256)`

```solidity
event LiquidityManager__PositionRecorded(uint256 indexed positionId, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 gbxPrincipal);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `GenesisPriceMath__InvalidTickSpacing()`

```solidity
error GenesisPriceMath__InvalidTickSpacing();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__ActivePositionLimitExceeded(uint256,uint256,uint256,uint256)`

```solidity
error LiquidityManager__ActivePositionLimitExceeded(uint256 currentActive, uint256 removalCount, uint256 replacementCount, uint256 maximumActive);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__AddressHasNoCode(address)`

```solidity
error LiquidityManager__AddressHasNoCode(address account);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__AlreadySeeded()`

```solidity
error LiquidityManager__AlreadySeeded();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__DeadlineExpired(uint256)`

```solidity
error LiquidityManager__DeadlineExpired(uint256 deadline);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__DuplicateMigrationPosition(uint256)`

```solidity
error LiquidityManager__DuplicateMigrationPosition(uint256 positionId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__GenesisBalanceMismatch(uint256,uint256)`

```solidity
error LiquidityManager__GenesisBalanceMismatch(uint256 expected, uint256 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__GenesisNotSeeded()`

```solidity
error LiquidityManager__GenesisNotSeeded();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__GenesisPrincipalMismatch(uint256,uint256)`

```solidity
error LiquidityManager__GenesisPrincipalMismatch(uint256 expected, uint256 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__InsufficientGenesisGBX(uint256,uint256)`

```solidity
error LiquidityManager__InsufficientGenesisGBX(uint256 required, uint256 available);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__InvalidAllocation()`

```solidity
error LiquidityManager__InvalidAllocation();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__InvalidDestinationPoolKey(bytes32,bytes32)`

```solidity
error LiquidityManager__InvalidDestinationPoolKey(bytes32 expected, bytes32 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__InvalidMigrationLength(uint256,uint256)`

```solidity
error LiquidityManager__InvalidMigrationLength(uint256 removals, uint256 replacements);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__InvalidMigrationSlippage()`

```solidity
error LiquidityManager__InvalidMigrationSlippage();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__InvalidRange()`

```solidity
error LiquidityManager__InvalidRange();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__MigrationsPaused()`

```solidity
error LiquidityManager__MigrationsPaused();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__NotEmergencyGuardian(address)`

```solidity
error LiquidityManager__NotEmergencyGuardian(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__NotGenesisBootstrap(address)`

```solidity
error LiquidityManager__NotGenesisBootstrap(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__NotProtocolTimelock(address)`

```solidity
error LiquidityManager__NotProtocolTimelock(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__PositionLiquidityMismatch(uint256,uint128,uint128)`

```solidity
error LiquidityManager__PositionLiquidityMismatch(uint256 positionId, uint128 expected, uint128 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__PositionNotOwned(uint256,address)`

```solidity
error LiquidityManager__PositionNotOwned(uint256 positionId, address owner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__RangeNotCompleted(uint256,int24)`

```solidity
error LiquidityManager__RangeNotCompleted(uint256 positionId, int24 currentTick);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__UnexpectedMintedPositionCount(uint256,uint256)`

```solidity
error LiquidityManager__UnexpectedMintedPositionCount(uint256 expectedNextPositionId, uint256 actualNextPositionId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__UnknownPosition(uint256)`

```solidity
error LiquidityManager__UnknownPosition(uint256 tokenId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__ZeroAddress()`

```solidity
error LiquidityManager__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityManager__ZeroUSDGReceived()`

```solidity
error LiquidityManager__ZeroUSDGReceived();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedLiquidityManager__AdapterFactoryMismatch(address,address)`

```solidity
error PermissionedLiquidityManager__AdapterFactoryMismatch(address expected, address actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedLiquidityManager__AdapterPoolManagerMismatch(address,address)`

```solidity
error PermissionedLiquidityManager__AdapterPoolManagerMismatch(address expected, address actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedLiquidityManager__AdapterTokenMismatch(address,address)`

```solidity
error PermissionedLiquidityManager__AdapterTokenMismatch(address expected, address actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedLiquidityManager__AddressHasNoCode(address)`

```solidity
error PermissionedLiquidityManager__AddressHasNoCode(address account);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedLiquidityManager__HookConfigurationMismatch()`

```solidity
error PermissionedLiquidityManager__HookConfigurationMismatch();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedLiquidityManager__HookLiquidityManagerMismatch(address,address)`

```solidity
error PermissionedLiquidityManager__HookLiquidityManagerMismatch(address expected, address actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedLiquidityManager__PositionManagerNotAllowedWrapper(address)`

```solidity
error PermissionedLiquidityManager__PositionManagerNotAllowedWrapper(address positionManager);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedLiquidityManager__UnverifiedAdapter(address)`

```solidity
error PermissionedLiquidityManager__UnverifiedAdapter(address adapter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedLiquidityManager__VerificationEscrowMismatch()`

```solidity
error PermissionedLiquidityManager__VerificationEscrowMismatch();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedLiquidityManager__VerificationStateMismatch(address,address)`

```solidity
error PermissionedLiquidityManager__VerificationStateMismatch(address expected, address actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeCastOverflowedUintDowncast(uint8,uint256)`

```solidity
error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeERC20FailedOperation(address)`

```solidity
error SafeERC20FailedOperation(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

## PermissionedPoolController

Source: [`src/liquidity/PermissionedPoolController.sol`](../../packages/contracts/src/liquidity/PermissionedPoolController.sol)

Artifact: `out/PermissionedPoolController.sol/PermissionedPoolController.json`

Public ABI: 27 functions, 8 events, 16 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor((address,address,address,address,address,address,address,address,address,address,address))`

```solidity
constructor(struct PermissionedPoolController.Dependencies dependencies);
```

Constructs the purpose-limited owner for one canonical permissioned-pool successor graph.

**Parameters**

- `dependencies`: Exact immutable protocol and official Uniswap dependencies for the graph.

### `DEPENDENCY_INITIALIZER()`

```solidity
function DEPENDENCY_INITIALIZER() external view returns (address arg0);
```

One-time deployment dependency initializer.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Emergency guardian authorized only for stop actions.

### `GBX()`

```solidity
function GBX() external view returns (address arg0);
```

Canonical underlying GBX token.

### `INITIAL_ALLOWLIST_CHECKER()`

```solidity
function INITIAL_ALLOWLIST_CHECKER() external view returns (contract IUniswapAllowlistChecker arg0);
```

Eligibility checker installed when the adapter is created.

### `MIXED_ROUTE_QUOTER_V2()`

```solidity
function MIXED_ROUTE_QUOTER_V2() external view returns (address arg0);
```

Canonical identity-reporting mixed-route quoter wrapper.

### `PERMISSIONED_HOOK()`

```solidity
function PERMISSIONED_HOOK() external view returns (address arg0);
```

Canonical permissioned hook after graph initialization.

### `PERMISSIONED_POSITION_MANAGER()`

```solidity
function PERMISSIONED_POSITION_MANAGER() external view returns (contract IUniswapPermissionedPositionManager arg0);
```

Canonical permissioned PositionManager.

### `PERMISSIONS_ADAPTER()`

```solidity
function PERMISSIONS_ADAPTER() external view returns (contract IUniswapPermissionsAdapter arg0);
```

Canonical GBX permissions adapter created by this controller.

### `PERMISSIONS_ADAPTER_FACTORY()`

```solidity
function PERMISSIONS_ADAPTER_FACTORY() external view returns (contract IUniswapPermissionsAdapterFactory arg0);
```

Canonical Uniswap permissions-adapter factory.

### `POOL_FEE()`

```solidity
function POOL_FEE() external view returns (uint24 arg0);
```

Canonical fee tier for the GBX/USDG permissioned pool.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Protocol timelock authorized for typed maintenance actions.

### `TICK_SPACING()`

```solidity
function TICK_SPACING() external view returns (int24 arg0);
```

Canonical tick spacing for the GBX/USDG permissioned pool.

### `UNIVERSAL_ROUTER()`

```solidity
function UNIVERSAL_ROUTER() external view returns (address arg0);
```

Canonical identity-reporting Universal Router wrapper.

### `USDG()`

```solidity
function USDG() external view returns (address arg0);
```

Canonical USDG token paired with the permissions adapter.

### `V4_QUOTER()`

```solidity
function V4_QUOTER() external view returns (address arg0);
```

Canonical identity-reporting v4 quoter wrapper.

### `VERIFICATION_ESCROW()`

```solidity
function VERIFICATION_ESCROW() external view returns (address arg0);
```

One-purpose adapter verification escrow after graph initialization.

### `bootstrapSwapEnableConsumed()`

```solidity
function bootstrapSwapEnableConsumed() external view returns (bool arg0);
```

Whether the one-shot permissionless post-genesis swap enable was consumed.

### `createAdapter()`

```solidity
function createAdapter() external returns (address adapterAddress);
```

Creates the only GBX adapter with this purpose-limited controller as its owner from birth.

### `emergencyDisableLiquidity()`

```solidity
function emergencyDisableLiquidity() external;
```

Stop-only guardian action for future permissioned liquidity additions.

### `emergencyDisableSwapping()`

```solidity
function emergencyDisableSwapping() external;
```

Stop-only guardian action for permissioned swaps.

### `enableSwappingAfterGenesis()`

```solidity
function enableSwappingAfterGenesis() external;
```

Permissionlessly enables swaps once, only after atomic canonical genesis has completed.

### `graphInitialized()`

```solidity
function graphInitialized() external view returns (bool arg0);
```

Whether the complete canonical successor graph was initialized.

### `initializeGraph(address,address)`

```solidity
function initializeGraph(address permissionedHook, address verificationEscrow) external;
```

Binds and configures the canonical hook and one-purpose verification escrow exactly once.

### `setAllowedWrapper(address,bool)`

```solidity
function setAllowedWrapper(address wrapper, bool allowed) external;
```

Timelocked toggle for one of the four fixed official identity-reporting wrappers.

### `setCanonicalHookAllowed(bool)`

```solidity
function setCanonicalHookAllowed(bool allowed) external;
```

Timelocked canonical hook toggle. No arbitrary replacement hook can be selected.

### `setSwappingEnabled(bool)`

```solidity
function setSwappingEnabled(bool enabled) external;
```

Timelocked swap-state recovery after the one-shot bootstrap enable has been consumed.

### `updateAllowListChecker(address)`

```solidity
function updateAllowListChecker(contract IUniswapAllowlistChecker newChecker) external;
```

Timelocked checker replacement; the adapter independently enforces ERC-165 compatibility.

### Events

#### `PermissionedPoolController__AdapterCreated(address,address,address)`

```solidity
event PermissionedPoolController__AdapterCreated(address indexed adapter, address indexed gbx, address checker);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__AllowlistCheckerUpdated(address,address)`

```solidity
event PermissionedPoolController__AllowlistCheckerUpdated(address indexed previousChecker, address indexed newChecker);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__CanonicalHookAllowanceSet(address,bool)`

```solidity
event PermissionedPoolController__CanonicalHookAllowanceSet(address indexed hook, bool allowed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__EmergencyLiquidityDisabled(address)`

```solidity
event PermissionedPoolController__EmergencyLiquidityDisabled(address indexed hook);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__EmergencySwappingDisabled(address)`

```solidity
event PermissionedPoolController__EmergencySwappingDisabled(address indexed adapter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__GraphInitialized(address,address,address)`

```solidity
event PermissionedPoolController__GraphInitialized(address indexed adapter, address indexed hook, address indexed verificationEscrow);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__SwappingSet(bool)`

```solidity
event PermissionedPoolController__SwappingSet(bool enabled);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__WrapperSet(address,bool)`

```solidity
event PermissionedPoolController__WrapperSet(address indexed wrapper, bool allowed);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `PermissionedPoolController__AdapterAlreadyCreated()`

```solidity
error PermissionedPoolController__AdapterAlreadyCreated();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__AdapterFactoryMismatch(address,address)`

```solidity
error PermissionedPoolController__AdapterFactoryMismatch(address expected, address actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__AdapterNotCreated()`

```solidity
error PermissionedPoolController__AdapterNotCreated();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__AdapterOwnerMismatch(address,address)`

```solidity
error PermissionedPoolController__AdapterOwnerMismatch(address expected, address actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__AddressHasNoCode(address)`

```solidity
error PermissionedPoolController__AddressHasNoCode(address account);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__BootstrapEnableAlreadyConsumed()`

```solidity
error PermissionedPoolController__BootstrapEnableAlreadyConsumed();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__CanonicalPoolNotInitialized()`

```solidity
error PermissionedPoolController__CanonicalPoolNotInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__GraphAlreadyInitialized()`

```solidity
error PermissionedPoolController__GraphAlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__GraphMismatch()`

```solidity
error PermissionedPoolController__GraphMismatch();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__InvalidWrapper(address)`

```solidity
error PermissionedPoolController__InvalidWrapper(address wrapper);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__NotEmergencyGuardian(address)`

```solidity
error PermissionedPoolController__NotEmergencyGuardian(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__NotProtocolTimelock(address)`

```solidity
error PermissionedPoolController__NotProtocolTimelock(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__SwappingAlreadyEnabled()`

```solidity
error PermissionedPoolController__SwappingAlreadyEnabled();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__UnauthorizedDependencyInitializer(address)`

```solidity
error PermissionedPoolController__UnauthorizedDependencyInitializer(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__UnverifiedAdapter(address)`

```solidity
error PermissionedPoolController__UnverifiedAdapter(address adapter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PermissionedPoolController__ZeroAddress()`

```solidity
error PermissionedPoolController__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

## ClaimsBase

Source: [`src/mining/ClaimsBase.sol`](../../packages/contracts/src/mining/ClaimsBase.sol)

Artifact: `out/ClaimsBase.sol/ClaimsBase.json`

Public ABI: 9 functions, 3 events, 13 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `CLAIM_EXPIRY()`

```solidity
function CLAIM_EXPIRY() external view returns (uint256 arg0);
```

Time after settlement before unclaimed GBX may be permissionlessly burned.

### `GBX()`

```solidity
function GBX() external view returns (contract IGBXToken arg0);
```

GBX escrowed for settled distributions.

### `SOURCE_INITIALIZER()`

```solidity
function SOURCE_INITIALIZER() external view returns (address arg0);
```

Deployment coordinator authorized only to assign the claim source once.

### `claimedAmount(uint256)`

```solidity
function claimedAmount(uint256 distributionId) external view returns (uint256 amount);
```

Aggregate raw GBX already paid from each distribution.

### `distributionExpired(uint256)`

```solidity
function distributionExpired(uint256 distributionId) external view returns (bool expired);
```

Whether each distribution has passed expiry and burned its remaining escrow.

### `expiredBurnedAmount(uint256)`

```solidity
function expiredBurnedAmount(uint256 distributionId) external view returns (uint256 amount);
```

Aggregate raw GBX burned when each distribution expired.

### `hasClaimed(uint256,address)`

```solidity
function hasClaimed(uint256 distributionId, address beneficiary) external view returns (bool claimed);
```

Whether a beneficiary has consumed their entitlement for a distribution.

### `source()`

```solidity
function source() external view returns (contract IClaimsSource arg0);
```

Immutable-after-initialization contribution and settlement source.

### `sourceInitialized()`

```solidity
function sourceInitialized() external view returns (bool arg0);
```

Whether the claim source has been initialized.

### Events

#### `ClaimsBase__Claimed(uint256,address,address,uint256)`

```solidity
event ClaimsBase__Claimed(uint256 indexed distributionId, address indexed beneficiary, address indexed caller, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__ExpiredBurned(uint256,uint256)`

```solidity
event ClaimsBase__ExpiredBurned(uint256 indexed distributionId, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__SourceInitialized(address)`

```solidity
event ClaimsBase__SourceInitialized(address indexed source);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `ClaimsBase__AlreadyClaimed(uint256,address)`

```solidity
error ClaimsBase__AlreadyClaimed(uint256 distributionId, address beneficiary);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__DistributionAlreadyExpired(uint256)`

```solidity
error ClaimsBase__DistributionAlreadyExpired(uint256 distributionId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__DistributionNotSettled(uint256)`

```solidity
error ClaimsBase__DistributionNotSettled(uint256 distributionId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__GBXMustBeContract(address)`

```solidity
error ClaimsBase__GBXMustBeContract(address gbx);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__InvalidClaimArrayLength()`

```solidity
error ClaimsBase__InvalidClaimArrayLength();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__NoClaim(uint256,address)`

```solidity
error ClaimsBase__NoClaim(uint256 distributionId, address beneficiary);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__NotExpired(uint256,uint256)`

```solidity
error ClaimsBase__NotExpired(uint256 distributionId, uint256 expiryTime);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__SourceAlreadyInitialized()`

```solidity
error ClaimsBase__SourceAlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__SourceMustBeContract(address)`

```solidity
error ClaimsBase__SourceMustBeContract(address source);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__SourceNotInitialized()`

```solidity
error ClaimsBase__SourceNotInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__UnauthorizedSourceInitializer(address)`

```solidity
error ClaimsBase__UnauthorizedSourceInitializer(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__ZeroAddress()`

```solidity
error ClaimsBase__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

## EmissionController

Source: [`src/mining/EmissionController.sol`](../../packages/contracts/src/mining/EmissionController.sol)

Artifact: `out/EmissionController.sol/EmissionController.json`

Public ABI: 16 functions, 3 events, 19 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(contract IGBXToken gbx_, address callerInitializer_);
```

Deploys the controller with an immutable GBX reference and a temporary caller initializer.

**Parameters**

- `callerInitializer_`: The deployment coordinator authorized to assign mint callers once.
- `gbx_`: The deployed, not-yet-initialized GBX token.

### `GENESIS_LIQUIDITY_ALLOCATION()`

```solidity
function GENESIS_LIQUIDITY_ALLOCATION() external view returns (uint256 arg0);
```

Returns the exact genesis allocation reserved for protocol-owned liquidity.

### `GENESIS_MINER_ALLOCATION()`

```solidity
function GENESIS_MINER_ALLOCATION() external view returns (uint256 arg0);
```

Returns the exact genesis allocation reserved for mining claims.

### `INITIAL_DAILY_SCHEDULED_EMISSION()`

```solidity
function INITIAL_DAILY_SCHEDULED_EMISSION() external view returns (uint256 arg0);
```

Returns the first daily post-genesis scheduled emission.

### `callerInitializer()`

```solidity
function callerInitializer() external view returns (address arg0);
```

Returns the one-time deployment initializer.

### `callersInitialized()`

```solidity
function callersInitialized() external view returns (bool arg0);
```

Returns whether the two mint callers have been initialized.

### `currentScheduledEmission()`

```solidity
function currentScheduledEmission() external view returns (uint256 arg0);
```

Returns the scheduled emission for the next post-genesis epoch.

### `gbx()`

```solidity
function gbx() external view returns (contract IGBXToken arg0);
```

Returns the GBX token controlled by this contract.

### `genesisBootstrap()`

```solidity
function genesisBootstrap() external view returns (address arg0);
```

Returns the set-once GenesisBootstrap caller.

### `genesisMinted()`

```solidity
function genesisMinted() external view returns (bool arg0);
```

Returns whether the exact genesis allocations have been minted.

### `initializeCallers(address,address)`

```solidity
function initializeCallers(address genesisBootstrap_, address miningPool_) external;
```

Sets the only two contracts allowed to request GBX minting.

**Parameters**

- `genesisBootstrap_`: The directly deployed GenesisBootstrap contract.
- `miningPool_`: The directly deployed MiningPool contract.

### `miningPool()`

```solidity
function miningPool() external view returns (address arg0);
```

Returns the set-once MiningPool caller.

### `mintGenesis(address,address)`

```solidity
function mintGenesis(address claimsReceiver, address liquidityReceiver) external;
```

Mints the fixed genesis miner and liquidity allocations exactly once.

**Parameters**

- `claimsReceiver`: The GenesisClaims receiver for 80 million GBX.
- `liquidityReceiver`: The LiquidityManager receiver for 20 million GBX.

### `mintMiningEpoch(uint256,address,uint256)`

```solidity
function mintMiningEpoch(uint256 epochId, address claimsReceiver, uint256 amount) external;
```

Advances one daily epoch and mints its demand-scaled emission.

**Parameters**

- `amount`: The actual demand-scaled emission, which may be zero.
- `claimsReceiver`: The MiningClaims receiver for the complete epoch emission.
- `epochId`: The sequential post-genesis epoch ID.

### `nextMiningEpochId()`

```solidity
function nextMiningEpochId() external view returns (uint256 arg0);
```

Returns the next sequential post-genesis epoch ID.

### `remainingMintCapacity()`

```solidity
function remainingMintCapacity() external view returns (uint256 arg0);
```

Returns GBX mint capacity remaining under the lifetime cap.

**Returns**

- `_0`: The remaining lifetime capacity in raw GBX units.

### `scheduledEmission(uint256)`

```solidity
function scheduledEmission(uint256 epochId) external pure returns (uint256 arg0);
```

Returns the exact sequentially floor-rounded emission for a post-genesis epoch.

**Parameters**

- `epochId`: The zero-based post-genesis epoch ID.

**Returns**

- `_0`: The scheduled emission in raw GBX units.

### Events

#### `EmissionController__CallersInitialized(address,address)`

```solidity
event EmissionController__CallersInitialized(address indexed genesisBootstrap, address indexed miningPool);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__GenesisMinted(address,address,uint256,uint256)`

```solidity
event EmissionController__GenesisMinted(address indexed claimsReceiver, address indexed liquidityReceiver, uint256 minerAllocation, uint256 liquidityAllocation);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__MiningEpochMinted(uint256,address,uint256,uint256,uint256)`

```solidity
event EmissionController__MiningEpochMinted(uint256 indexed epochId, address indexed claimsReceiver, uint256 actualEmission, uint256 scheduledEmission, uint256 nextScheduledEmission);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `EmissionController__CallersAlreadyInitialized()`

```solidity
error EmissionController__CallersAlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__CallersNotInitialized()`

```solidity
error EmissionController__CallersNotInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__DuplicateGenesisReceiver()`

```solidity
error EmissionController__DuplicateGenesisReceiver();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__DuplicateMintCaller()`

```solidity
error EmissionController__DuplicateMintCaller();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__GBXControllerMismatch(address)`

```solidity
error EmissionController__GBXControllerMismatch(address configuredController);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__GBXTokenMustBeContract(address)`

```solidity
error EmissionController__GBXTokenMustBeContract(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__GenesisAlreadyMinted()`

```solidity
error EmissionController__GenesisAlreadyMinted();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__GenesisNotMinted()`

```solidity
error EmissionController__GenesisNotMinted();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__MintCallerMustBeContract(address)`

```solidity
error EmissionController__MintCallerMustBeContract(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__RemainingMintCapacityExceeded(uint256,uint256)`

```solidity
error EmissionController__RemainingMintCapacityExceeded(uint256 requestedAmount, uint256 remainingCapacity);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__ScheduledEmissionExceeded(uint256,uint256)`

```solidity
error EmissionController__ScheduledEmissionExceeded(uint256 requestedAmount, uint256 scheduledAmount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__UnauthorizedCallerInitializer(address)`

```solidity
error EmissionController__UnauthorizedCallerInitializer(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__UnauthorizedGenesisBootstrap(address)`

```solidity
error EmissionController__UnauthorizedGenesisBootstrap(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__UnauthorizedMiningPool(address)`

```solidity
error EmissionController__UnauthorizedMiningPool(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__UnexpectedMiningEpoch(uint256,uint256)`

```solidity
error EmissionController__UnexpectedMiningEpoch(uint256 expectedEpochId, uint256 providedEpochId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__ZeroCallerInitializer()`

```solidity
error EmissionController__ZeroCallerInitializer();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__ZeroGBXToken()`

```solidity
error EmissionController__ZeroGBXToken();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__ZeroMintCaller()`

```solidity
error EmissionController__ZeroMintCaller();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__ZeroReceiver()`

```solidity
error EmissionController__ZeroReceiver();
```

_No additional NatSpec notice is present in the compiled artifact._

## GenesisBootstrap

Source: [`src/mining/GenesisBootstrap.sol`](../../packages/contracts/src/mining/GenesisBootstrap.sol)

Artifact: `out/GenesisBootstrap.sol/GenesisBootstrap.json`

Public ABI: 38 functions, 9 events, 26 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor((address,address,address,address,address,address,address,address),uint256,uint256)`

```solidity
constructor(struct GenesisBootstrap.Dependencies dependencies, uint256 minimumBootstrapUSDG_, uint256 bootstrapContributionCap_);
```

Deploys the bootstrap with immutable custody and minting boundaries.

**Parameters**

- `bootstrapContributionCap_`: Maximum observed community USDG accepted.
- `dependencies`: Canonical protocol contracts and one-time deployment authorities.
- `minimumBootstrapUSDG_`: Minimum raw USDG raise required for launch.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (contract IMiningAllocationVoter arg0);
```

Canonical voter notified for the vault's observed genesis USDG receipt.

### `BOOTSTRAP_DURATION()`

```solidity
function BOOTSTRAP_DURATION() external view returns (uint256 arg0);
```

Fixed community contribution period after opening.

### `DEPENDENCY_INITIALIZER()`

```solidity
function DEPENDENCY_INITIALIZER() external view returns (address arg0);
```

One-use account permitted to bind LiquidityManager before contributions open.

### `ELIGIBILITY_MODULE()`

```solidity
function ELIGIBILITY_MODULE() external view returns (contract IEligibilityModule arg0);
```

Eligibility policy inherited from canonical GBX.

### `EMISSION_CONTROLLER()`

```solidity
function EMISSION_CONTROLLER() external view returns (contract IEmissionController arg0);
```

Canonical supply controller that mints both fixed genesis allocations.

### `GENESIS_CLAIMS()`

```solidity
function GENESIS_CLAIMS() external view returns (address arg0);
```

Canonical escrow receiving the complete 80 million community GBX allocation.

### `GENESIS_LIQUIDITY_BACKER()`

```solidity
function GENESIS_LIQUIDITY_BACKER() external view returns (address arg0);
```

Immutable sponsor authorized to escrow liquidity backing and receive excess/refunds.

### `GENESIS_MINER_ALLOCATION()`

```solidity
function GENESIS_MINER_ALLOCATION() external view returns (uint256 arg0);
```

Fixed GBX allocation held by GenesisClaims for community contributors.

### `GUM_BALL_VAULT()`

```solidity
function GUM_BALL_VAULT() external view returns (address arg0);
```

Canonical vault receiving all successful-settlement backing.

### `MINING_POOL()`

```solidity
function MINING_POOL() external view returns (contract IMiningPool arg0);
```

Canonical recurring mining pool initialized with the endogenous genesis price.

### `SETTLEMENT_GRACE_PERIOD()`

```solidity
function SETTLEMENT_GRACE_PERIOD() external view returns (uint256 arg0);
```

Maximum time after a successful close in which atomic settlement may execute.

### `USDG()`

```solidity
function USDG() external view returns (contract IERC20 arg0);
```

Canonical USDG accepted from sponsor and community contributors.

### `USDG_DECIMALS()`

```solidity
function USDG_DECIMALS() external view returns (uint8 arg0);
```

Immutable decimal count of canonical USDG.

### `activateRefunds()`

```solidity
function activateRefunds() external;
```

Permissionlessly enters refunds if atomic launch settlement misses its grace period.

### `bootstrapContributionCap()`

```solidity
function bootstrapContributionCap() external view returns (uint256 arg0);
```

Maximum raw community USDG accepted during bootstrap.

### `claimData(uint256,address)`

```solidity
function claimData(uint256 distributionId, address beneficiary) external view returns (uint256 entitlement, uint256 totalAllocation, uint64 claimSettledAt, bool claimSettled);
```

Returns one beneficiary's settled entitlement and distribution metadata.

**Parameters**

- `beneficiary`: The recorded contribution beneficiary.
- `distributionId`: Zero for genesis or the post-genesis mining epoch ID.

**Returns**

- `claimSettled`: Whether the distribution has settled and its allocation is final.
- `claimSettledAt`: The settlement timestamp used for claim expiry.
- `entitlement`: The beneficiary's pro-rata GBX entitlement.
- `totalAllocation`: The complete GBX allocation minted for the distribution.

### `close()`

```solidity
function close() external;
```

Closes contributions into either atomic settlement or permissionless refunds.

### `communityContribution(address)`

```solidity
function communityContribution(address beneficiary) external view returns (uint256 amount);
```

Raw community USDG attributed to each claim beneficiary.

### `communityUSDG()`

```solidity
function communityUSDG() external view returns (uint256 arg0);
```

Aggregate raw community USDG observed during the bootstrap.

### `contribute(address,uint256)`

```solidity
function contribute(address beneficiary, uint256 requestedAmount) external returns (uint256 receivedAmount);
```

Contributes observed USDG for a beneficiary, bounded by the global bootstrap cap.

**Parameters**

- `beneficiary`: The eligible account whose genesis claim entitlement increases.
- `requestedAmount`: The maximum raw USDG amount requested from the payer.

**Returns**

- `receivedAmount`: The raw USDG balance increase observed by the bootstrap.

### `contributionEnd()`

```solidity
function contributionEnd() external view returns (uint64 arg0);
```

Timestamp when the fixed contribution window ends.

### `contributionStart()`

```solidity
function contributionStart() external view returns (uint64 arg0);
```

Timestamp when the fixed contribution window opened.

### `fundSponsor(uint256)`

```solidity
function fundSponsor(uint256 requestedAmount) external returns (uint256 receivedAmount);
```

Escrows observed sponsor USDG before community contributions open.

**Parameters**

- `requestedAmount`: The maximum raw USDG amount requested from the immutable sponsor.

**Returns**

- `receivedAmount`: The raw USDG balance increase observed by the bootstrap.

### `genesisPriceWad()`

```solidity
function genesisPriceWad() external view returns (uint256 arg0);
```

Endogenous community USDG-per-GBX genesis price scaled by 1e18.

### `initializeLiquidityManager(address)`

```solidity
function initializeLiquidityManager(address liquidityManager_) external;
```

Resolves the LiquidityManager construction cycle exactly once.

**Parameters**

- `liquidityManager_`: The deployed canonical LiquidityManager contract.

### `liquidityManager()`

```solidity
function liquidityManager() external view returns (contract IGenesisLiquidityManager arg0);
```

Canonical LiquidityManager bound exactly once before contributions open.

### `liquidityManagerInitialized()`

```solidity
function liquidityManagerInitialized() external view returns (bool arg0);
```

Whether the LiquidityManager dependency has been bound exactly once.

### `maxSponsorUSDG()`

```solidity
function maxSponsorUSDG() external view returns (uint256 arg0);
```

Maximum raw sponsor USDG accepted, derived from the community cap.

### `minimumBootstrapUSDG()`

```solidity
function minimumBootstrapUSDG() external view returns (uint256 arg0);
```

Minimum raw community USDG raise required for successful close.

### `openContributions()`

```solidity
function openContributions() external;
```

Permissionlessly opens the fixed seven-day contribution phase after any sponsor escrow is present.

### `refund(address)`

```solidity
function refund(address beneficiary) external returns (uint256 amount);
```

Refunds a beneficiary's complete community contribution to that beneficiary.

**Parameters**

- `beneficiary`: The recorded beneficiary who receives the refund directly.

**Returns**

- `amount`: The complete raw USDG contribution returned to the beneficiary.

### `refundSponsor()`

```solidity
function refundSponsor() external returns (uint256 amount);
```

Refunds all sponsor escrow to the immutable genesis liquidity backer.

**Returns**

- `amount`: The complete raw USDG sponsor escrow returned to the backer.

### `requiredSponsorUSDG()`

```solidity
function requiredSponsorUSDG() external view returns (uint256 arg0);
```

Raw sponsor USDG required to back the 20 million LP GBX at the endogenous genesis price.

### `settle(uint160)`

```solidity
function settle(uint160 sqrtPriceX96) external returns (uint160 initializedSqrtPriceX96);
```

Atomically moves backing, mints all genesis GBX, initializes mining and v4, and notifies allocation.

**Parameters**

- `sqrtPriceX96`: The official Uniswap SDK encoding of the exact raw genesis ratio.

**Returns**

- `initializedSqrtPriceX96`: The initialized canonical v4 pool's raw-token square-root price encoded as Q64.96.

### `settledAt()`

```solidity
function settledAt() external view returns (uint64 arg0);
```

Timestamp recorded when atomic genesis settlement completed.

### `settlementDeadline()`

```solidity
function settlementDeadline() external view returns (uint64 arg0);
```

Final timestamp for atomic successful settlement after close.

### `sponsorEscrow()`

```solidity
function sponsorEscrow() external view returns (uint256 arg0);
```

Raw sponsor USDG currently held in refundable escrow.

### `state()`

```solidity
function state() external view returns (enum GenesisBootstrap.State arg0);
```

Current bootstrap lifecycle state.

### Events

#### `GenesisBootstrap__CommunityContribution(address,address,uint256,uint256,uint256)`

```solidity
event GenesisBootstrap__CommunityContribution(address indexed payer, address indexed beneficiary, uint256 requestedAmount, uint256 receivedAmount, uint256 communityUSDGAfter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__ContributionsOpened(uint256,uint256)`

```solidity
event GenesisBootstrap__ContributionsOpened(uint256 startTime, uint256 endTime);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__LaunchSettled(uint256,uint256,uint256,uint256,uint256,uint160)`

```solidity
event GenesisBootstrap__LaunchSettled(uint256 communityUSDG, uint256 sponsorUSDG, uint256 vaultUSDG, uint256 sponsorRefund, uint256 genesisPriceWad, uint160 sqrtPriceX96);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__LiquidityManagerInitialized(address)`

```solidity
event GenesisBootstrap__LiquidityManagerInitialized(address indexed manager);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__Refunded(address,uint256)`

```solidity
event GenesisBootstrap__Refunded(address indexed beneficiary, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__RefundsActivated(uint256,uint256)`

```solidity
event GenesisBootstrap__RefundsActivated(uint256 communityUSDG, uint256 sponsorEscrow);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__SponsorEscrowed(uint256,uint256,uint256)`

```solidity
event GenesisBootstrap__SponsorEscrowed(uint256 requestedAmount, uint256 receivedAmount, uint256 escrowAfter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__SponsorRefunded(address,uint256)`

```solidity
event GenesisBootstrap__SponsorRefunded(address indexed backer, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__StateChanged(uint8,uint8)`

```solidity
event GenesisBootstrap__StateChanged(enum GenesisBootstrap.State indexed previousState, enum GenesisBootstrap.State indexed newState);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `GenesisBootstrap__AlreadyInitialized()`

```solidity
error GenesisBootstrap__AlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__ContributionCapExceeded(uint256,uint256)`

```solidity
error GenesisBootstrap__ContributionCapExceeded(uint256 receivedAfter, uint256 cap);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__ContributionPeriodActive(uint256)`

```solidity
error GenesisBootstrap__ContributionPeriodActive(uint256 endTime);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__ContributionPeriodEnded(uint256)`

```solidity
error GenesisBootstrap__ContributionPeriodEnded(uint256 endTime);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__EligibilityCheckFailed(address)`

```solidity
error GenesisBootstrap__EligibilityCheckFailed(address module);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__IneligibleBeneficiary(address)`

```solidity
error GenesisBootstrap__IneligibleBeneficiary(address beneficiary);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__InvalidConfiguration()`

```solidity
error GenesisBootstrap__InvalidConfiguration();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__InvalidState(uint8,uint8)`

```solidity
error GenesisBootstrap__InvalidState(enum GenesisBootstrap.State expected, enum GenesisBootstrap.State actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__LiquidityManagerMustBeContract(address)`

```solidity
error GenesisBootstrap__LiquidityManagerMustBeContract(address manager);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__NoContribution(address)`

```solidity
error GenesisBootstrap__NoContribution(address beneficiary);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__ObservedDebitMismatch(uint256,uint256)`

```solidity
error GenesisBootstrap__ObservedDebitMismatch(uint256 expected, uint256 observed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__ObservedReceiptMismatch(address,uint256,uint256)`

```solidity
error GenesisBootstrap__ObservedReceiptMismatch(address receiver, uint256 expected, uint256 observed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__ObservedTransferMismatch(uint256,uint256)`

```solidity
error GenesisBootstrap__ObservedTransferMismatch(uint256 expected, uint256 observed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__PayerDebitExceededMaximum(uint256,uint256)`

```solidity
error GenesisBootstrap__PayerDebitExceededMaximum(uint256 maximum, uint256 observed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__SettlementDeadlineElapsed(uint256)`

```solidity
error GenesisBootstrap__SettlementDeadlineElapsed(uint256 deadline);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__SettlementGracePeriodActive(uint256)`

```solidity
error GenesisBootstrap__SettlementGracePeriodActive(uint256 deadline);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__SponsorEscrowCapExceeded(uint256,uint256)`

```solidity
error GenesisBootstrap__SponsorEscrowCapExceeded(uint256 receivedAfter, uint256 cap);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__UnauthorizedDependencyInitializer(address)`

```solidity
error GenesisBootstrap__UnauthorizedDependencyInitializer(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__UnauthorizedSponsor(address)`

```solidity
error GenesisBootstrap__UnauthorizedSponsor(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__UnsupportedUSDGDecimals(uint8)`

```solidity
error GenesisBootstrap__UnsupportedUSDGDecimals(uint8 decimals);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__ZeroAddress()`

```solidity
error GenesisBootstrap__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__ZeroAmount()`

```solidity
error GenesisBootstrap__ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GenesisBootstrap__ZeroGenesisPrice()`

```solidity
error GenesisBootstrap__ZeroGenesisPrice();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeCastOverflowedUintDowncast(uint8,uint256)`

```solidity
error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeERC20FailedOperation(address)`

```solidity
error SafeERC20FailedOperation(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

## GenesisClaims

Source: [`src/mining/GenesisClaims.sol`](../../packages/contracts/src/mining/GenesisClaims.sol)

Artifact: `out/GenesisClaims.sol/GenesisClaims.json`

Public ABI: 15 functions, 3 events, 14 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(contract IGBXToken gbx_, address sourceInitializer_);
```

Deploys the genesis escrow before GenesisBootstrap exists.

**Parameters**

- `gbx_`: The canonical GBX token whose complete genesis allocation is held in escrow.
- `sourceInitializer_`: The one-use account permitted to bind GenesisBootstrap as the claim source.

### `CLAIM_EXPIRY()`

```solidity
function CLAIM_EXPIRY() external view returns (uint256 arg0);
```

Time after settlement before unclaimed GBX may be permissionlessly burned.

### `GBX()`

```solidity
function GBX() external view returns (contract IGBXToken arg0);
```

GBX escrowed for settled distributions.

### `MAX_BATCH_CLAIMS()`

```solidity
function MAX_BATCH_CLAIMS() external view returns (uint256 arg0);
```

Maximum beneficiaries accepted by one batched genesis claim.

### `SOURCE_INITIALIZER()`

```solidity
function SOURCE_INITIALIZER() external view returns (address arg0);
```

Deployment coordinator authorized only to assign the claim source once.

### `burnExpired()`

```solidity
function burnExpired() external returns (uint256 amountBurned);
```

Burns the complete unclaimed genesis remainder after expiry.

**Returns**

- `amountBurned`: The GBX amount burned.

### `claim(address)`

```solidity
function claim(address beneficiary) external returns (uint256 amount);
```

Claims a beneficiary's genesis GBX to that beneficiary.

**Parameters**

- `beneficiary`: The recorded contribution beneficiary.

**Returns**

- `amount`: The claimed GBX amount.

### `claimBatch(address[])`

```solidity
function claimBatch(address[] beneficiaries) external returns (uint256 totalAmount);
```

Claims a bounded list of genesis entitlements to their recorded beneficiaries.
Anyone may submit the batch, but every payment is fixed to its corresponding beneficiary.

**Parameters**

- `beneficiaries`: The bounded list of recorded contribution beneficiaries.

**Returns**

- `totalAmount`: The aggregate claimed GBX amount.

### `claimedAmount(uint256)`

```solidity
function claimedAmount(uint256 distributionId) external view returns (uint256 amount);
```

Aggregate raw GBX already paid from each distribution.

### `distributionExpired(uint256)`

```solidity
function distributionExpired(uint256 distributionId) external view returns (bool expired);
```

Whether each distribution has passed expiry and burned its remaining escrow.

### `expiredBurnedAmount(uint256)`

```solidity
function expiredBurnedAmount(uint256 distributionId) external view returns (uint256 amount);
```

Aggregate raw GBX burned when each distribution expired.

### `hasClaimed(uint256,address)`

```solidity
function hasClaimed(uint256 distributionId, address beneficiary) external view returns (bool claimed);
```

Whether a beneficiary has consumed their entitlement for a distribution.

### `initializeSource(address)`

```solidity
function initializeSource(address source_) external;
```

Assigns the immutable GenesisBootstrap claim source exactly once.

**Parameters**

- `source`: The GenesisBootstrap contract.

### `previewClaim(address)`

```solidity
function previewClaim(address beneficiary) external view returns (uint256 amount);
```

Returns the beneficiary's currently claimable genesis GBX.

**Parameters**

- `beneficiary`: The recorded contribution beneficiary.

**Returns**

- `amount`: The currently claimable GBX amount.

### `source()`

```solidity
function source() external view returns (contract IClaimsSource arg0);
```

Immutable-after-initialization contribution and settlement source.

### `sourceInitialized()`

```solidity
function sourceInitialized() external view returns (bool arg0);
```

Whether the claim source has been initialized.

### Events

#### `ClaimsBase__Claimed(uint256,address,address,uint256)`

```solidity
event ClaimsBase__Claimed(uint256 indexed distributionId, address indexed beneficiary, address indexed caller, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__ExpiredBurned(uint256,uint256)`

```solidity
event ClaimsBase__ExpiredBurned(uint256 indexed distributionId, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__SourceInitialized(address)`

```solidity
event ClaimsBase__SourceInitialized(address indexed source);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `ClaimsBase__AlreadyClaimed(uint256,address)`

```solidity
error ClaimsBase__AlreadyClaimed(uint256 distributionId, address beneficiary);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__DistributionAlreadyExpired(uint256)`

```solidity
error ClaimsBase__DistributionAlreadyExpired(uint256 distributionId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__DistributionNotSettled(uint256)`

```solidity
error ClaimsBase__DistributionNotSettled(uint256 distributionId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__GBXMustBeContract(address)`

```solidity
error ClaimsBase__GBXMustBeContract(address gbx);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__InvalidClaimArrayLength()`

```solidity
error ClaimsBase__InvalidClaimArrayLength();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__NoClaim(uint256,address)`

```solidity
error ClaimsBase__NoClaim(uint256 distributionId, address beneficiary);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__NotExpired(uint256,uint256)`

```solidity
error ClaimsBase__NotExpired(uint256 distributionId, uint256 expiryTime);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__SourceAlreadyInitialized()`

```solidity
error ClaimsBase__SourceAlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__SourceMustBeContract(address)`

```solidity
error ClaimsBase__SourceMustBeContract(address source);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__SourceNotInitialized()`

```solidity
error ClaimsBase__SourceNotInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__UnauthorizedSourceInitializer(address)`

```solidity
error ClaimsBase__UnauthorizedSourceInitializer(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__ZeroAddress()`

```solidity
error ClaimsBase__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeERC20FailedOperation(address)`

```solidity
error SafeERC20FailedOperation(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

## MiningClaims

Source: [`src/mining/MiningClaims.sol`](../../packages/contracts/src/mining/MiningClaims.sol)

Artifact: `out/MiningClaims.sol/MiningClaims.json`

Public ABI: 15 functions, 3 events, 14 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(contract IGBXToken gbx_, address sourceInitializer_);
```

Deploys the recurring mining escrow before MiningPool exists.

**Parameters**

- `gbx_`: The canonical GBX token whose complete settled epoch emissions are held in escrow.
- `sourceInitializer_`: The one-use account permitted to bind MiningPool as the claim source.

### `CLAIM_EXPIRY()`

```solidity
function CLAIM_EXPIRY() external view returns (uint256 arg0);
```

Time after settlement before unclaimed GBX may be permissionlessly burned.

### `GBX()`

```solidity
function GBX() external view returns (contract IGBXToken arg0);
```

GBX escrowed for settled distributions.

### `MAX_BATCH_CLAIMS()`

```solidity
function MAX_BATCH_CLAIMS() external view returns (uint256 arg0);
```

Maximum epochs accepted by one batched claim.

### `SOURCE_INITIALIZER()`

```solidity
function SOURCE_INITIALIZER() external view returns (address arg0);
```

Deployment coordinator authorized only to assign the claim source once.

### `burnExpired(uint256)`

```solidity
function burnExpired(uint256 epochId) external returns (uint256 amountBurned);
```

Burns one epoch's complete unclaimed remainder after expiry.

**Parameters**

- `epochId`: The expired settled epoch ID.

**Returns**

- `amountBurned`: The unclaimed GBX amount burned.

### `claim(address,uint256)`

```solidity
function claim(address beneficiary, uint256 epochId) external returns (uint256 amount);
```

Claims one settled epoch entitlement to the recorded beneficiary.

**Parameters**

- `beneficiary`: The recorded contribution beneficiary.
- `epochId`: The settled epoch ID.

**Returns**

- `amount`: The claimed GBX amount.

### `claimBatch(address,uint256[])`

```solidity
function claimBatch(address beneficiary, uint256[] epochIds) external returns (uint256 totalAmount);
```

Claims a bounded list of settled epochs to the recorded beneficiary.

**Parameters**

- `beneficiary`: The recorded contribution beneficiary.
- `epochIds`: The bounded list of settled epoch IDs.

**Returns**

- `totalAmount`: The aggregate claimed GBX amount.

### `claimedAmount(uint256)`

```solidity
function claimedAmount(uint256 distributionId) external view returns (uint256 amount);
```

Aggregate raw GBX already paid from each distribution.

### `distributionExpired(uint256)`

```solidity
function distributionExpired(uint256 distributionId) external view returns (bool expired);
```

Whether each distribution has passed expiry and burned its remaining escrow.

### `expiredBurnedAmount(uint256)`

```solidity
function expiredBurnedAmount(uint256 distributionId) external view returns (uint256 amount);
```

Aggregate raw GBX burned when each distribution expired.

### `hasClaimed(uint256,address)`

```solidity
function hasClaimed(uint256 distributionId, address beneficiary) external view returns (bool claimed);
```

Whether a beneficiary has consumed their entitlement for a distribution.

### `initializeSource(address)`

```solidity
function initializeSource(address source_) external;
```

Assigns the immutable MiningPool claim source exactly once.

**Parameters**

- `source`: The MiningPool contract.

### `previewClaim(address,uint256)`

```solidity
function previewClaim(address beneficiary, uint256 epochId) external view returns (uint256 amount);
```

Returns the beneficiary's currently claimable GBX for an epoch.

**Parameters**

- `beneficiary`: The recorded contribution beneficiary.
- `epochId`: The settled epoch ID.

**Returns**

- `amount`: The currently claimable GBX amount.

### `source()`

```solidity
function source() external view returns (contract IClaimsSource arg0);
```

Immutable-after-initialization contribution and settlement source.

### `sourceInitialized()`

```solidity
function sourceInitialized() external view returns (bool arg0);
```

Whether the claim source has been initialized.

### Events

#### `ClaimsBase__Claimed(uint256,address,address,uint256)`

```solidity
event ClaimsBase__Claimed(uint256 indexed distributionId, address indexed beneficiary, address indexed caller, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__ExpiredBurned(uint256,uint256)`

```solidity
event ClaimsBase__ExpiredBurned(uint256 indexed distributionId, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__SourceInitialized(address)`

```solidity
event ClaimsBase__SourceInitialized(address indexed source);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `ClaimsBase__AlreadyClaimed(uint256,address)`

```solidity
error ClaimsBase__AlreadyClaimed(uint256 distributionId, address beneficiary);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__DistributionAlreadyExpired(uint256)`

```solidity
error ClaimsBase__DistributionAlreadyExpired(uint256 distributionId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__DistributionNotSettled(uint256)`

```solidity
error ClaimsBase__DistributionNotSettled(uint256 distributionId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__GBXMustBeContract(address)`

```solidity
error ClaimsBase__GBXMustBeContract(address gbx);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__InvalidClaimArrayLength()`

```solidity
error ClaimsBase__InvalidClaimArrayLength();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__NoClaim(uint256,address)`

```solidity
error ClaimsBase__NoClaim(uint256 distributionId, address beneficiary);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__NotExpired(uint256,uint256)`

```solidity
error ClaimsBase__NotExpired(uint256 distributionId, uint256 expiryTime);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__SourceAlreadyInitialized()`

```solidity
error ClaimsBase__SourceAlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__SourceMustBeContract(address)`

```solidity
error ClaimsBase__SourceMustBeContract(address source);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__SourceNotInitialized()`

```solidity
error ClaimsBase__SourceNotInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__UnauthorizedSourceInitializer(address)`

```solidity
error ClaimsBase__UnauthorizedSourceInitializer(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ClaimsBase__ZeroAddress()`

```solidity
error ClaimsBase__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeERC20FailedOperation(address)`

```solidity
error SafeERC20FailedOperation(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

## MiningPool

Source: [`src/mining/MiningPool.sol`](../../packages/contracts/src/mining/MiningPool.sol)

Artifact: `out/MiningPool.sol/MiningPool.json`

Public ABI: 34 functions, 8 events, 28 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor((address,address,address,address,address,address,address,address))`

```solidity
constructor(struct MiningPool.Dependencies dependencies);
```

Deploys recurring mining before GenesisBootstrap exists.

**Parameters**

- `dependencies`: Canonical custody, allocation, emission, claims, guardian, timelock, and initializer targets.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (contract IMiningAllocationVoter arg0);
```

Canonical voter notified only for the vault's observed settlement receipt.

### `ANTI_SNIPING_EXTENSION()`

```solidity
function ANTI_SNIPING_EXTENSION() external view returns (uint256 arg0);
```

Time added for each material contribution inside the anti-sniping window.

### `ANTI_SNIPING_WINDOW()`

```solidity
function ANTI_SNIPING_WINDOW() external view returns (uint256 arg0);
```

Final portion of an epoch during which material contributions may extend it.

### `DEPENDENCY_INITIALIZER()`

```solidity
function DEPENDENCY_INITIALIZER() external view returns (address arg0);
```

One-use prelaunch account permitted to bind GenesisBootstrap.

### `ELIGIBILITY_MODULE()`

```solidity
function ELIGIBILITY_MODULE() external view returns (contract IEligibilityModule arg0);
```

Eligibility policy inherited from canonical GBX.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Stop-only authority permitted to pause contributions and invalidate the current epoch.

### `EMISSION_CONTROLLER()`

```solidity
function EMISSION_CONTROLLER() external view returns (contract IEmissionController arg0);
```

Canonical controller supplying scheduled emissions and minting actual emissions.

### `EPOCH_DURATION()`

```solidity
function EPOCH_DURATION() external view returns (uint256 arg0);
```

Fixed duration of each recurring mining epoch before anti-sniping extensions.

### `GUM_BALL_VAULT()`

```solidity
function GUM_BALL_VAULT() external view returns (address arg0);
```

Canonical vault receiving all valid settled epoch demand.

### `MATERIAL_CONTRIBUTION_BPS()`

```solidity
function MATERIAL_CONTRIBUTION_BPS() external view returns (uint256 arg0);
```

Minimum contribution share, in basis points of prior demand, considered material.

### `MAX_ANTI_SNIPING_EXTENSION()`

```solidity
function MAX_ANTI_SNIPING_EXTENSION() external view returns (uint256 arg0);
```

Maximum cumulative extension allowed for one epoch.

### `MINING_CLAIMS()`

```solidity
function MINING_CLAIMS() external view returns (contract IMiningClaims arg0);
```

Canonical claim escrow receiving complete actual epoch emissions.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Delayed authority permitted to resume new contributions.

### `USDG()`

```solidity
function USDG() external view returns (contract IERC20 arg0);
```

Canonical USDG accepted during recurring epochs and routed to GumBallVault on settlement.

### `USDG_DECIMALS()`

```solidity
function USDG_DECIMALS() external view returns (uint8 arg0);
```

Immutable decimal count of canonical USDG.

### `claim(address,uint256)`

```solidity
function claim(address beneficiary, uint256 epochId) external returns (uint256 amount);
```

Claims a settled epoch entitlement to its recorded beneficiary.

**Parameters**

- `beneficiary`: The recorded contribution beneficiary.
- `epochId`: The settled epoch ID.

**Returns**

- `amount`: The claimed GBX amount.

### `claimData(uint256,address)`

```solidity
function claimData(uint256 epochId, address beneficiary) external view returns (uint256 entitlement, uint256 totalAllocation, uint64 settledAt, bool settled);
```

Returns one beneficiary's settled entitlement and distribution metadata.

**Parameters**

- `beneficiary`: The recorded contribution beneficiary.
- `distributionId`: Zero for genesis or the post-genesis mining epoch ID.

**Returns**

- `entitlement`: The beneficiary's pro-rata GBX entitlement.
- `settled`: Whether the distribution has settled and its allocation is final.
- `settledAt`: The settlement timestamp used for claim expiry.
- `totalAllocation`: The complete GBX allocation minted for the distribution.

### `contribute(address,uint256)`

```solidity
function contribute(address beneficiary, uint256 requestedAmount) external returns (uint256 receivedAmount);
```

Contributes observed USDG for a beneficiary during the current daily epoch.

**Parameters**

- `beneficiary`: The eligible account whose current-epoch claim entitlement increases.
- `requestedAmount`: The maximum raw USDG amount requested from the payer.

**Returns**

- `receivedAmount`: The raw USDG balance increase observed by the mining pool.

### `contributionOf(uint256,address)`

```solidity
function contributionOf(uint256 epochId, address beneficiary) external view returns (uint256 amount);
```

Raw USDG contribution attributed to each beneficiary in each epoch.

### `contributionsPaused()`

```solidity
function contributionsPaused() external view returns (bool arg0);
```

Whether new recurring contributions are temporarily stopped.

### `currentEpochId()`

```solidity
function currentEpochId() external view returns (uint256 arg0);
```

Identifier of the currently accepting or awaiting-settlement epoch.

### `epochs(uint256)`

```solidity
function epochs(uint256 epochId) external view returns (uint64 startTime, uint64 endTime, uint64 settledAt, uint64 extensionUsed, uint256 totalContributed, uint256 scheduledEmission, uint256 actualEmission, uint256 minimumMiningPrice, uint256 clearingPrice, bool settled, bool invalidated);
```

Complete timing, demand, emission, price, and status record for each epoch.

### `genesisBootstrap()`

```solidity
function genesisBootstrap() external view returns (address arg0);
```

Canonical GenesisBootstrap permitted to initialize the first endogenous reference price.

### `genesisBootstrapInitialized()`

```solidity
function genesisBootstrapInitialized() external view returns (bool arg0);
```

Whether GenesisBootstrap has been bound exactly once.

### `getEpoch(uint256)`

```solidity
function getEpoch(uint256 epochId) external view returns (struct MiningPool.Epoch epoch);
```

Returns the complete immutable-or-live accounting snapshot for an epoch.

**Parameters**

- `epochId`: The epoch identifier to query.

**Returns**

- `epoch`: The stored timing, contribution, emission, price, and status fields.

### `initializeGenesisBootstrap(address)`

```solidity
function initializeGenesisBootstrap(address genesisBootstrap_) external;
```

Assigns GenesisBootstrap exactly once after deployment cycles are resolved.

**Parameters**

- `genesisBootstrap`: The canonical GenesisBootstrap contract.

### `initializeReferencePrice(uint256)`

```solidity
function initializeReferencePrice(uint256 genesisPriceWad) external;
```

Sets the first endogenous mining reference price during atomic genesis settlement.

**Parameters**

- `genesisPriceWad`: The genesis clearing price scaled by 1e18.

### `invalidateCurrentEpoch()`

```solidity
function invalidateCurrentEpoch() external;
```

Invalidates the current unsettled epoch, enabling immediate refunds while preserving schedule advance.

### `pauseContributions()`

```solidity
function pauseContributions() external;
```

Allows the emergency guardian to immediately pause new contributions without affecting claims or refunds.

### `referenceMiningPrice()`

```solidity
function referenceMiningPrice() external view returns (uint256 arg0);
```

Current endogenous USDG-per-GBX mining reference price scaled by 1e18.

### `referencePriceInitialized()`

```solidity
function referencePriceInitialized() external view returns (bool arg0);
```

Whether successful genesis settlement initialized recurring epoch zero.

### `refund(address,uint256)`

```solidity
function refund(address beneficiary, uint256 epochId) external returns (uint256 amount);
```

Refunds an invalidated epoch contribution to its recorded beneficiary.

**Parameters**

- `beneficiary`: The recorded beneficiary who receives the refund directly.
- `epochId`: The invalidated epoch whose contribution is refunded.

**Returns**

- `amount`: The complete raw USDG contribution returned to the beneficiary.

### `settleCurrentEpoch()`

```solidity
function settleCurrentEpoch() external returns (uint256 actualEmission);
```

Permissionlessly settles one ended epoch, advancing schedule and reference even when demand is zero.

**Returns**

- `actualEmission`: The demand-scaled raw GBX amount minted to MiningClaims for the settled epoch.

### `unpauseContributions()`

```solidity
function unpauseContributions() external;
```

Reopens contributions only through the delayed protocol timelock.

### Events

#### `MiningPool__Contribution(uint256,address,address,uint256,uint256,uint256)`

```solidity
event MiningPool__Contribution(uint256 indexed epochId, address indexed payer, address indexed beneficiary, uint256 requestedAmount, uint256 receivedAmount, uint256 epochTotalAfter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__ContributionsPauseSet(bool)`

```solidity
event MiningPool__ContributionsPauseSet(bool paused);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__EpochExtended(uint256,uint256,uint256)`

```solidity
event MiningPool__EpochExtended(uint256 indexed epochId, uint256 newEndTime, uint256 extensionUsed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__EpochInvalidated(uint256)`

```solidity
event MiningPool__EpochInvalidated(uint256 indexed epochId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__EpochRefunded(uint256,address,uint256)`

```solidity
event MiningPool__EpochRefunded(uint256 indexed epochId, address indexed beneficiary, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__EpochSettled(uint256,uint256,uint256,uint256,uint256,uint256)`

```solidity
event MiningPool__EpochSettled(uint256 indexed epochId, uint256 totalContributed, uint256 scheduledEmission, uint256 actualEmission, uint256 clearingPrice, uint256 nextReferencePrice);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__GenesisBootstrapInitialized(address)`

```solidity
event MiningPool__GenesisBootstrapInitialized(address indexed genesisBootstrap);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__ReferencePriceInitialized(uint256,uint256,uint256)`

```solidity
event MiningPool__ReferencePriceInitialized(uint256 referencePrice, uint256 epochStart, uint256 epochEnd);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `MiningPool__AlreadyInitialized()`

```solidity
error MiningPool__AlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__ContributionPeriodEnded(uint256,uint256)`

```solidity
error MiningPool__ContributionPeriodEnded(uint256 epochId, uint256 endTime);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__ContributionsPaused()`

```solidity
error MiningPool__ContributionsPaused();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__EligibilityCheckFailed(address)`

```solidity
error MiningPool__EligibilityCheckFailed(address module);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__EmissionsExhausted()`

```solidity
error MiningPool__EmissionsExhausted();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__EpochAlreadyInvalidated(uint256)`

```solidity
error MiningPool__EpochAlreadyInvalidated(uint256 epochId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__EpochNotEnded(uint256,uint256)`

```solidity
error MiningPool__EpochNotEnded(uint256 epochId, uint256 endTime);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__GenesisBootstrapMustBeContract(address)`

```solidity
error MiningPool__GenesisBootstrapMustBeContract(address bootstrap);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__IneligibleBeneficiary(address)`

```solidity
error MiningPool__IneligibleBeneficiary(address beneficiary);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__InvalidConfiguration()`

```solidity
error MiningPool__InvalidConfiguration();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__InvalidatedEpoch(uint256)`

```solidity
error MiningPool__InvalidatedEpoch(uint256 epochId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__NoContribution(uint256,address)`

```solidity
error MiningPool__NoContribution(uint256 epochId, address beneficiary);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__NotInvalidated(uint256)`

```solidity
error MiningPool__NotInvalidated(uint256 epochId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__ObservedDebitMismatch(uint256,uint256)`

```solidity
error MiningPool__ObservedDebitMismatch(uint256 expected, uint256 observed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__ObservedReceiptMismatch(address,uint256,uint256)`

```solidity
error MiningPool__ObservedReceiptMismatch(address receiver, uint256 expected, uint256 observed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__ObservedTransferMismatch(uint256,uint256)`

```solidity
error MiningPool__ObservedTransferMismatch(uint256 expected, uint256 observed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__PayerDebitExceededMaximum(uint256,uint256)`

```solidity
error MiningPool__PayerDebitExceededMaximum(uint256 maximum, uint256 observed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__ReferencePriceNotInitialized()`

```solidity
error MiningPool__ReferencePriceNotInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__UnauthorizedDependencyInitializer(address)`

```solidity
error MiningPool__UnauthorizedDependencyInitializer(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__UnauthorizedGenesisBootstrap(address)`

```solidity
error MiningPool__UnauthorizedGenesisBootstrap(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__UnauthorizedGuardian(address)`

```solidity
error MiningPool__UnauthorizedGuardian(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__UnauthorizedProtocolTimelock(address)`

```solidity
error MiningPool__UnauthorizedProtocolTimelock(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__UnsupportedUSDGDecimals(uint8)`

```solidity
error MiningPool__UnsupportedUSDGDecimals(uint8 decimals);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__ZeroAddress()`

```solidity
error MiningPool__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__ZeroAmount()`

```solidity
error MiningPool__ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeCastOverflowedUintDowncast(uint8,uint256)`

```solidity
error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeERC20FailedOperation(address)`

```solidity
error SafeERC20FailedOperation(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

## ManagerRewards

Source: [`src/rewards/ManagerRewards.sol`](../../packages/contracts/src/rewards/ManagerRewards.sol)

Artifact: `out/ManagerRewards.sol/ManagerRewards.json`

Public ABI: 38 functions, 8 events, 15 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,address)`

```solidity
constructor(address rewardToken_, address strategy_, address allocationVoter_, address gumBallVault_, address eligibilityModule_);
```

Wires this accumulator permanently to one strategy, voter, token, vault, and eligibility policy.

**Parameters**

- `allocationVoter_`: The canonical AllocationVoter that checkpoints user weights.
- `eligibilityModule_`: The immutable receiver eligibility policy.
- `gumBallVault_`: The canonical vault that receives zero-weight rewards.
- `rewardToken_`: The acquired target token paid to active managers.
- `strategy_`: The sole AcquisitionStrategy permitted to notify rewards.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (contract IAllocationVoterRewards arg0);
```

Canonical voter that supplies strategy and user active weights.

### `ELIGIBILITY_MODULE()`

```solidity
function ELIGIBILITY_MODULE() external view returns (contract IEligibilityModule arg0);
```

Immutable policy used to validate selected reward receivers.

### `GUM_BALL_VAULT()`

```solidity
function GUM_BALL_VAULT() external view returns (address arg0);
```

Canonical vault receiving notifications made while strategy weight is zero.

### `REWARD_PRECISION()`

```solidity
function REWARD_PRECISION() external view returns (uint256 arg0);
```

Fixed-point precision used by reward-per-weight and fractional remainder accounting.

### `REWARD_TOKEN()`

```solidity
function REWARD_TOKEN() external view returns (contract IERC20 arg0);
```

Target asset received from fills and paid to active managers.

### `STRATEGY()`

```solidity
function STRATEGY() external view returns (address arg0);
```

Sole acquisition strategy permitted to deposit and notify rewards.

### `accountedRewards()`

```solidity
function accountedRewards() external view returns (uint256 arg0);
```

Raw manager and pending-vault reward-token liability currently retained by this contract.

### `accruedRewards(address)`

```solidity
function accruedRewards(address user) external view returns (uint256 amount);
```

Whole raw reward amount accrued and not yet claimed by each manager.

### `advanceGeneration(uint64)`

```solidity
function advanceGeneration(uint64 nextGeneration) external;
```

Closes the prior reward generation before a disabled strategy can later be reactivated.
Must only be called by the immutable AllocationVoter as it increments the strategy generation.

**Parameters**

- `nextGeneration`: The consecutive generation that follows the just-closed reward index.

### `checkpointUser(address,uint256,uint64)`

```solidity
function checkpointUser(address user, uint256 activeWeight, uint64 weightGeneration) external;
```

Accrues rewards using the user's generation-bound weight immediately before a voter transition.
Must only be called by the immutable AllocationVoter.

**Parameters**

- `activeWeight`: The user's effective strategy weight before the transition.
- `user`: The signal account being checkpointed.
- `weightGeneration`: The strategy generation in which `activeWeight` earned rewards.

### `claim(address)`

```solidity
function claim(address user) external returns (uint256 amount);
```

Claims a user's accrued rewards to their self-selected receiver, or to the user by default.
Anyone may trigger the claim; the caller can never redirect it.

**Parameters**

- `user`: The manager whose accrued rewards are checkpointed and paid.

**Returns**

- `amount`: The raw reward-token amount paid to the user's configured receiver.

### `currentGeneration()`

```solidity
function currentGeneration() external view returns (uint64 arg0);
```

Strategy generation currently permitted to accrue new reward-index increments.

### `currentRemainderCycle()`

```solidity
function currentRemainderCycle() external view returns (uint64 arg0);
```

Fractional-remainder cycle currently accruing inside the live strategy generation.

### `earned(address)`

```solidity
function earned(address user) external view returns (uint256 amount);
```

Returns currently claimable rewards using the user's present effective weight.

**Parameters**

- `user`: The manager whose accrued and pending rewards are queried.

**Returns**

- `amount`: The raw reward-token amount currently claimable.

### `generationClosed(uint64)`

```solidity
function generationClosed(uint64 generation) external view returns (bool closed);
```

Whether a generation's terminal reward index has been fixed, including a legitimate zero index.

### `generationEndRemainderCycle(uint64)`

```solidity
function generationEndRemainderCycle(uint64 generation) external view returns (uint64 cycle);
```

Remainder cycle fixed at each administratively closed generation boundary.

### `generationEndRewardPerWeight(uint64)`

```solidity
function generationEndRewardPerWeight(uint64 generation) external view returns (uint256 endingIndex);
```

Terminal reward index for each generation closed by a strategy disable.

### `generationFinalizedTerminalDust(uint64)`

```solidity
function generationFinalizedTerminalDust(uint64 generation) external view returns (uint256 amount);
```

Cumulative terminal dust finalized for each generation, whether pending or already redirected.

### `generationNotifiedRewards(uint64)`

```solidity
function generationNotifiedRewards(uint64 generation) external view returns (uint256 amount);
```

Raw rewards notified while each strategy generation was live.

### `generationPendingTerminalDust(uint64)`

```solidity
function generationPendingTerminalDust(uint64 generation) external view returns (uint256 amount);
```

Terminal dust still awaiting exact vault delivery for each generation.

### `generationRedirectedDust(uint64)`

```solidity
function generationRedirectedDust(uint64 generation) external view returns (uint256 amount);
```

Cumulative terminal dust already redirected for each generation.

### `generationUnsettledWeight(uint64)`

```solidity
function generationUnsettledWeight(uint64 generation) external view returns (uint256 weight);
```

Closed-generation weight still requiring one final user checkpoint.

### `generationUserSettled(uint64,address)`

```solidity
function generationUserSettled(uint64 generation, address user) external view returns (bool settled);
```

Whether a user's stored weight was reconciled against one closed generation.

### `generationWholeEntitlements(uint64)`

```solidity
function generationWholeEntitlements(uint64 generation) external view returns (uint256 amount);
```

Cumulative whole-token entitlements materialized for each generation.

### `notifyReward(uint256)`

```solidity
function notifyReward(uint256 amount) external;
```

Accounts an observed reward-token deposit from the immutable strategy.
The strategy transfers tokens before calling. A zero-weight notification is sent directly to the vault.

**Parameters**

- `amount`: The raw reward-token amount already deposited by the strategy.

### `pendingTerminalDust(uint64,uint64)`

```solidity
function pendingTerminalDust(uint64 generation, uint64 remainderCycle) external view returns (uint256 amount);
```

Terminal dust still awaiting exact vault delivery for each generation and remainder cycle.

### `rewardPerWeightStored()`

```solidity
function rewardPerWeightStored() external view returns (uint256 arg0);
```

Cumulative raw reward entitlement per active strategy-weight unit, scaled by `REWARD_PRECISION`.

### `rewardReceiver(address)`

```solidity
function rewardReceiver(address user) external view returns (address receiver);
```

Optional eligible reward receiver selected by each manager, or zero for self.

### `rewardRemainder()`

```solidity
function rewardRemainder() external view returns (uint256 arg0);
```

Scaled division remainder carried across reward notifications.

### `setRewardReceiver(address)`

```solidity
function setRewardReceiver(address receiver) external;
```

Selects a fixed reward receiver; passing zero restores payment directly to the user.

**Parameters**

- `receiver`: The eligible receiver, or zero to restore the caller as receiver.

### `settleTerminalDust()`

```solidity
function settleTerminalDust() external;
```

Finalizes fractional accounting after the voter has individually checkpointed the last live weight.
Must only be called by the immutable AllocationVoter after the strategy weight reaches zero naturally. Finalization queues terminal dust without calling the reward token.

### `sweepTerminalDust(uint64,uint64)`

```solidity
function sweepTerminalDust(uint64 generation, uint64 remainderCycle) external returns (uint256 amount);
```

Retries delivery of one finalized terminal-dust cycle to GumBallVault.
Permissionless and exact: failed token delivery leaves every pending liability unchanged.

**Parameters**

- `generation`: The reward generation containing the finalized cycle.
- `remainderCycle`: The finalized fractional-remainder cycle to sweep.

**Returns**

- `amount`: The raw reward-token dust delivered to GumBallVault.

### `terminalCycleFinalized(uint64,uint64)`

```solidity
function terminalCycleFinalized(uint64 generation, uint64 remainderCycle) external view returns (bool finalized);
```

Whether a generation and remainder cycle has crossed its terminal accounting boundary.

### `totalAccruedRewards()`

```solidity
function totalAccruedRewards() external view returns (uint256 arg0);
```

Aggregate unpaid whole-token entitlement across every manager and generation.

### `totalPendingTerminalDust()`

```solidity
function totalPendingTerminalDust() external view returns (uint256 arg0);
```

Aggregate terminal dust awaiting exact vault delivery across every generation and cycle.

### `userRemainderCycle(address)`

```solidity
function userRemainderCycle(address user) external view returns (uint64 cycle);
```

Remainder cycle to which each manager's scaled fractional remainder belongs.

### `userRewardPerWeightPaid(address)`

```solidity
function userRewardPerWeightPaid(address user) external view returns (uint256 paid);
```

Last global reward index checkpointed for each manager.

### `userScaledRemainder(address)`

```solidity
function userScaledRemainder(address user) external view returns (uint256 scaledRemainder);
```

Scaled fractional reward remainder carried for each manager.

### Events

#### `ManagerRewards__Claimed(address,address,uint256)`

```solidity
event ManagerRewards__Claimed(address indexed user, address indexed receiver, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__GenerationAdvanced(uint64,uint64,uint256)`

```solidity
event ManagerRewards__GenerationAdvanced(uint64 indexed closedGeneration, uint64 indexed nextGeneration, uint256 endingRewardPerWeight);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__Notified(uint256,uint256,uint256,uint256)`

```solidity
event ManagerRewards__Notified(uint256 amount, uint256 strategyWeight, uint256 rewardPerWeightDelta, uint256 remainder);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__ReceiverSet(address,address)`

```solidity
event ManagerRewards__ReceiverSet(address indexed user, address indexed receiver);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__RedirectedToVault(uint256)`

```solidity
event ManagerRewards__RedirectedToVault(uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__TerminalDustQueued(uint64,uint64,uint256,uint256,uint256)`

```solidity
event ManagerRewards__TerminalDustQueued(uint64 indexed generation, uint64 indexed remainderCycle, uint256 amount, uint256 generationPendingAfter, uint256 totalPendingAfter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__TerminalDustSettled(uint64,uint64,uint256,uint256)`

```solidity
event ManagerRewards__TerminalDustSettled(uint64 indexed generation, uint64 indexed remainderCycle, uint256 amount, uint256 accountedRewardsAfter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__UserCheckpointed(address,uint256,uint256)`

```solidity
event ManagerRewards__UserCheckpointed(address indexed user, uint256 activeWeight, uint256 accrued);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `ManagerRewards__IneligibleReceiver(address)`

```solidity
error ManagerRewards__IneligibleReceiver(address receiver);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__InsufficientUnaccountedReward(uint256,uint256)`

```solidity
error ManagerRewards__InsufficientUnaccountedReward(uint256 notified, uint256 unaccounted);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__InvalidGeneration(uint64,uint64)`

```solidity
error ManagerRewards__InvalidGeneration(uint64 expected, uint64 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__NoPendingTerminalDust(uint64,uint64)`

```solidity
error ManagerRewards__NoPendingTerminalDust(uint64 generation, uint64 remainderCycle);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__NonZeroStrategyWeight(uint256)`

```solidity
error ManagerRewards__NonZeroStrategyWeight(uint256 strategyWeight);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__NotAllocationVoter(address)`

```solidity
error ManagerRewards__NotAllocationVoter(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__NotStrategy(address)`

```solidity
error ManagerRewards__NotStrategy(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__ObservedDebitMismatch(uint256,uint256)`

```solidity
error ManagerRewards__ObservedDebitMismatch(uint256 expected, uint256 observed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__ObservedReceiptMismatch(address,uint256,uint256)`

```solidity
error ManagerRewards__ObservedReceiptMismatch(address receiver, uint256 expected, uint256 observed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__TerminalCycleAlreadyFinalized(uint64,uint64)`

```solidity
error ManagerRewards__TerminalCycleAlreadyFinalized(uint64 generation, uint64 remainderCycle);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__UnsettledWeightUnderflow(uint64,uint256,uint256)`

```solidity
error ManagerRewards__UnsettledWeightUnderflow(uint64 generation, uint256 settling, uint256 remaining);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__ZeroAddress()`

```solidity
error ManagerRewards__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ManagerRewards__ZeroAmount()`

```solidity
error ManagerRewards__ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeERC20FailedOperation(address)`

```solidity
error SafeERC20FailedOperation(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

## GumBallRouter

Source: [`src/router/GumBallRouter.sol`](../../packages/contracts/src/router/GumBallRouter.sol)

Artifact: `out/GumBallRouter.sol/GumBallRouter.json`

Public ABI: 7 functions, 2 events, 8 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address)`

```solidity
constructor(address gbx_, address stakedGBX_, address gumBallVault_);
```

Wires the one canonical GBX, staking escrow, and basket vault, rejecting mismatched peers.

**Parameters**

- `gbx_`: The canonical GBX token.
- `gumBallVault_`: The canonical in-kind basket vault.
- `stakedGBX_`: The canonical non-transferable sGBX staking escrow.

### `GBX()`

```solidity
function GBX() external view returns (contract IGBXToken arg0);
```

Canonical GBX transferred transiently for typed staking and redemption flows.

### `GUM_BALL_VAULT()`

```solidity
function GUM_BALL_VAULT() external view returns (contract GumBallVault arg0);
```

Canonical basket vault receiving typed redemption calls.

### `STAKED_GBX()`

```solidity
function STAKED_GBX() external view returns (contract StakedGBX arg0);
```

Canonical sGBX escrow receiving typed stake deposits.

### `redeem(uint256,address)`

```solidity
function redeem(uint256 shares, address receiver) external returns (uint256[] amountsOut);
```

Burns caller-owned GBX after a normal approval and sends every basket asset directly to receiver.

**Parameters**

- `receiver`: The eligible account that receives every pro-rata basket output.
- `shares`: The raw GBX amount transferred from the caller and burned.

**Returns**

- `amountsOut`: The raw asset amounts transferred in AssetRegistry order.

### `redeemWithPermit(uint256,address,uint256,uint8,bytes32,bytes32)`

```solidity
function redeemWithPermit(uint256 shares, address receiver, uint256 permitDeadline, uint8 v, bytes32 r, bytes32 s) external returns (uint256[] amountsOut);
```

Burns caller-owned GBX using EIP-2612 and sends every basket asset directly to receiver.

**Parameters**

- `permitDeadline`: The EIP-2612 signature expiry timestamp.
- `r`: The first 32 bytes of the ECDSA signature.
- `receiver`: The eligible account that receives every pro-rata basket output.
- `s`: The second 32 bytes of the ECDSA signature.
- `shares`: The raw GBX amount transferred from the caller and burned.
- `v`: The ECDSA recovery identifier.

**Returns**

- `amountsOut`: The raw asset amounts transferred in AssetRegistry order.

### `stake(uint256)`

```solidity
function stake(uint256 amount) external returns (uint256 receivedAmount);
```

Stakes caller-owned GBX 1:1 after a normal ERC-20 approval to this router.

**Parameters**

- `amount`: The raw GBX amount transferred from and staked for the caller.

**Returns**

- `receivedAmount`: The raw sGBX amount minted to the caller.

### `stakeWithPermit(uint256,uint256,uint8,bytes32,bytes32)`

```solidity
function stakeWithPermit(uint256 amount, uint256 permitDeadline, uint8 v, bytes32 r, bytes32 s) external returns (uint256 receivedAmount);
```

Stakes caller-owned GBX 1:1 using an EIP-2612 permit scoped to this router and exact amount.

**Parameters**

- `amount`: The raw GBX amount transferred from and staked for the caller.
- `permitDeadline`: The EIP-2612 signature expiry timestamp.
- `r`: The first 32 bytes of the ECDSA signature.
- `s`: The second 32 bytes of the ECDSA signature.
- `v`: The ECDSA recovery identifier.

**Returns**

- `receivedAmount`: The raw sGBX amount minted to the caller.

### Events

#### `GumBallRouter__Redeemed(address,address,uint256,uint256)`

```solidity
event GumBallRouter__Redeemed(address indexed owner, address indexed receiver, uint256 shares, uint256 assetCount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallRouter__Staked(address,uint256)`

```solidity
event GumBallRouter__Staked(address indexed payer, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `GumBallRouter__GBXBalanceMismatch(uint256,uint256)`

```solidity
error GumBallRouter__GBXBalanceMismatch(uint256 expected, uint256 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallRouter__InvalidPeer(address,address)`

```solidity
error GumBallRouter__InvalidPeer(address expected, address actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallRouter__ObservedGBXMismatch(uint256,uint256)`

```solidity
error GumBallRouter__ObservedGBXMismatch(uint256 expected, uint256 observed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallRouter__StakedAmountMismatch(uint256,uint256)`

```solidity
error GumBallRouter__StakedAmountMismatch(uint256 expected, uint256 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallRouter__ZeroAddress()`

```solidity
error GumBallRouter__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallRouter__ZeroAmount()`

```solidity
error GumBallRouter__ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeERC20FailedOperation(address)`

```solidity
error SafeERC20FailedOperation(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

## AllocationVoter

Source: [`src/signal/AllocationVoter.sol`](../../packages/contracts/src/signal/AllocationVoter.sol)

Artifact: `out/AllocationVoter.sol/AllocationVoter.json`

Public ABI: 49 functions, 15 events, 26 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,address)`

```solidity
constructor(address usdG_, address assetRegistry_, address protocolTimelock_, address emergencyGuardian_, address dependencyInitializer_);
```

Deploys voter accounting with immutable canonical token, registry, and maintenance authorities.

**Parameters**

- `assetRegistry_`: The canonical bounded registry of live strategies.
- `dependencyInitializer_`: The one-use account permitted to close construction cycles.
- `emergencyGuardian_`: The stop-only emergency authority.
- `protocolTimelock_`: The purpose-limited delayed maintenance authority.
- `usdG_`: The canonical USDG token whose vault balance backs virtual budgets.

### `ASSET_REGISTRY()`

```solidity
function ASSET_REGISTRY() external view returns (contract IAssetRegistry arg0);
```

Canonical bounded registry used to validate live strategies.

### `DEPENDENCY_INITIALIZER()`

```solidity
function DEPENDENCY_INITIALIZER() external view returns (address arg0);
```

One-use prelaunch account permitted to close dependency cycles.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Stop-only authority permitted to pause activations and disable dead strategy weight.

### `INDEX_PRECISION()`

```solidity
function INDEX_PRECISION() external view returns (uint256 arg0);
```

Fixed-point precision used by global allocation and strategy remainder accounting.

### `MAX_USER_STRATEGIES()`

```solidity
function MAX_USER_STRATEGIES() external view returns (uint256 arg0);
```

Maximum unique strategies in one user's active or pending allocation.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Delayed authority permitted to reactivate strategies and resume signal activations.

### `SIGNAL_ACTIVATION_DELAY()`

```solidity
function SIGNAL_ACTIVATION_DELAY() external view returns (uint256 arg0);
```

Delay applied only to new or increased signal weight.

### `USDG()`

```solidity
function USDG() external view returns (contract IERC20 arg0);
```

Canonical USDG whose physical vault balance backs all virtual allocation accounting.

### `accountedVaultUSDG()`

```solidity
function accountedVaultUSDG() external view returns (uint256 arg0);
```

Raw USDG balance at the vault that remains assigned to budgets or idle accounting.

### `activeStrategies(address)`

```solidity
function activeStrategies(address user) external view returns (address[] strategies);
```

Returns a copy of the user's bounded active strategy list.

**Parameters**

- `user`: The signaling account to query.

**Returns**

- `strategies`: The stored bounded list; effective weights must still be checked by generation.

### `activeWeight(address,address)`

```solidity
function activeWeight(address user, address strategy) external view returns (uint256 weight);
```

Returns a user's effective active weight for one strategy.

**Parameters**

- `strategy`: The strategy whose effective generation-bound weight is queried.
- `user`: The signaling account to query.

**Returns**

- `weight`: The user's current active sGBX weight for the strategy.

### `activeWeightTotal(address)`

```solidity
function activeWeightTotal(address user) external view returns (uint256 total);
```

Returns the sum of a user's effective active weights across at most sixteen strategies.

**Parameters**

- `user`: The signaling account to query.

**Returns**

- `total`: The sum of all current generation-bound active weights.

### `allocationRemainder()`

```solidity
function allocationRemainder() external view returns (uint256 arg0);
```

Scaled division remainder carried across global revenue notifications.

### `cancelPendingSignals()`

```solidity
function cancelPendingSignals() external;
```

Cancels every pending increase before a permissionless activation transaction executes.

### `checkpointStrategyBudget(address)`

```solidity
function checkpointStrategyBudget(address strategy) external returns (uint256 budget);
```

Checkpoints lazy allocation for one strategy.

**Parameters**

- `strategy`: The registered strategy whose global allocation index is materialized.

**Returns**

- `budget`: The strategy's raw USDG virtual budget after checkpointing.

### `checkpointUser(address)`

```solidity
function checkpointUser(address user) external;
```

Permissionlessly activates a user's matured pending signal increases.

**Parameters**

- `user`: The account whose mature signals and manager rewards are checkpointed.

### `consumeStrategyBudget(address,uint256)`

```solidity
function consumeStrategyBudget(address strategy, uint256 amount) external;
```

Consumes a strategy's virtual USDG budget before the vault releases physical USDG.
Must only be callable by the immutable GumBallVault.

**Parameters**

- `amount`: The raw USDG budget amount consumed.
- `strategy`: The live strategy spending its budget.

### `dependenciesConfigured()`

```solidity
function dependenciesConfigured() external view returns (bool arg0);
```

Whether the vault, sGBX, and four revenue sources have been bound exactly once.

### `disableStrategy(address)`

```solidity
function disableStrategy(address strategy) external;
```

Removes a registry-disabled strategy from all allocation denominators without iterating over users.

**Parameters**

- `strategy`: The registered strategy already disabled in AssetRegistry.

### `globalAllocationIndex()`

```solidity
function globalAllocationIndex() external view returns (uint256 arg0);
```

Cumulative USDG allocation per unit of live signal weight, scaled by `INDEX_PRECISION`.

### `idleScaledRemainder()`

```solidity
function idleScaledRemainder() external view returns (uint256 arg0);
```

Scaled fractional remainder attached to idle USDG accounting.

### `idleUSDG()`

```solidity
function idleUSDG() external view returns (uint256 arg0);
```

Raw accounted USDG not assigned because no live weight existed when it arrived.

### `initializeDependencies(address,address,address[4])`

```solidity
function initializeDependencies(address vault_, address stakedGBX_, address[4] revenueSources) external;
```

Resolves deployment-order circularity exactly once and fixes all authorized revenue sources.

**Parameters**

- `revenueSources`: Canonical senders in `RevenueSource` enum order.
- `stakedGBX_`: The canonical sGBX contract permitted to checkpoint stake changes.
- `vault_`: The canonical GumBallVault that physically custodies USDG.

### `notifyRevenue(uint256,uint8)`

```solidity
function notifyRevenue(uint256 amount, enum AllocationVoter.RevenueSource source) external;
```

Accounts newly deposited USDG using only current effective signal weights.

**Parameters**

- `amount`: The raw USDG balance increase already observed at GumBallVault.
- `source`: The source class whose prebound sender must match the caller.

### `onStake(address)`

```solidity
function onStake(address user) external;
```

Checkpoints a user's matured signals and rewards immediately before sGBX is minted.
Must only be called by the immutable StakedGBX contract.

**Parameters**

- `user`: The account receiving newly staked sGBX.

### `onUnstake(address,uint256)`

```solidity
function onUnstake(address user, uint256 amount) external;
```

Removes enough pending and active signal weight before sGBX is burned.
Must only be called by StakedGBX and must leave assigned weight within the post-unstake balance.

**Parameters**

- `amount`: The amount of sGBX being burned.
- `user`: The account unstaking sGBX.

### `pauseSignalActivations()`

```solidity
function pauseSignalActivations() external;
```

Immediately pauses only matured signal increases; reductions, resets, and unstaking remain live.

### `pendingActivationTime(address)`

```solidity
function pendingActivationTime(address user) external view returns (uint64 activationTime);
```

Earliest timestamp when each user's queued signal increases may activate.

### `pendingStrategies(address)`

```solidity
function pendingStrategies(address user) external view returns (address[] strategies);
```

Returns a copy of the user's bounded pending strategy list.

**Parameters**

- `user`: The signaling account to query.

**Returns**

- `strategies`: The stored bounded pending list; validity must still be checked by generation.

### `pendingWeight(address,address)`

```solidity
function pendingWeight(address user, address strategy) external view returns (uint256 weight);
```

Returns one user's still-valid pending increase for a strategy.

**Parameters**

- `strategy`: The strategy whose pending increase is queried.
- `user`: The signaling account to query.

**Returns**

- `weight`: The still-valid pending sGBX weight, or zero if stale or no longer signalable.

### `pendingWeightTotal(address)`

```solidity
function pendingWeightTotal(address user) external view returns (uint256 total);
```

Returns the sum of a user's valid pending increases.

**Parameters**

- `user`: The signaling account to query.

**Returns**

- `total`: The sum of all signalable current-generation pending increases.

### `previewStrategyBudget(address)`

```solidity
function previewStrategyBudget(address strategy) external view returns (uint256 budget);
```

Returns a strategy's budget including revenue accrued since its last state-changing checkpoint.
This mirrors `_checkpointStrategyBudget` without mutating indices or remainders.

**Parameters**

- `strategy`: The registered strategy whose lazy budget is previewed.

**Returns**

- `budget`: The raw USDG virtual budget including uncheckpointed index accrual.

### `reactivateStrategy(address)`

```solidity
function reactivateStrategy(address strategy) external;
```

Allows fresh signals after the timelock re-enables a reviewed strategy; stale user weights never revive.

**Parameters**

- `strategy`: The registered live strategy whose voter generation remains reset.

### `resetSignals()`

```solidity
function resetSignals() external;
```

Immediately removes all active and pending signals after checkpointing manager rewards.

### `revenueSourceAddress(uint8)`

```solidity
function revenueSourceAddress(enum AllocationVoter.RevenueSource sourceType) external view returns (address source);
```

Canonical authorized sender for each enumerated revenue source.

### `rewardWeight(address,address)`

```solidity
function rewardWeight(address user, address strategy) external view returns (uint256 weight, uint64 generation);
```

Returns generation-bound stored weight that has not yet been settled by ManagerRewards.
Stale weight is intentionally exposed here but remains excluded from signaling and allocation totals.

**Parameters**

- `strategy`: The strategy whose reward-settlement weight is queried.
- `user`: The signaling account to query.

**Returns**

- `generation`: The generation in which `weight` was active, or the current generation for zero weight.
- `weight`: The stored weight, including an uncheckpointed prior-generation weight.

### `scaleBudgetsAfterRedemption(uint256,uint256)`

```solidity
function scaleBudgetsAfterRedemption(uint256 shares, uint256 supplyBefore) external;
```

Scales every virtual budget by (supplyBefore - shares) / supplyBefore before a redemption burn.
The strategy universe is bounded, so the implementation may checkpoint and iterate over all live strategies.

**Parameters**

- `shares`: The GBX shares being redeemed.
- `supplyBefore`: The total GBX supply before the redemption burn.

### `signal(address[],uint256[])`

```solidity
function signal(address[] strategies, uint256[] relativeWeights) external;
```

Replaces the caller's desired relative allocation, delaying only new or increased weight.

**Parameters**

- `relativeWeights`: Positive relative weights normalized across the caller's complete sGBX balance.
- `strategies`: The unique, active strategy addresses in the caller's desired allocation.

### `signalActivationsPaused()`

```solidity
function signalActivationsPaused() external view returns (bool arg0);
```

Whether matured signal increases are temporarily prevented from activating.

### `stakedGBX()`

```solidity
function stakedGBX() external view returns (address arg0);
```

Canonical sGBX contract permitted to checkpoint stake balance changes.

### `strategyBudget(address)`

```solidity
function strategyBudget(address strategy) external view returns (uint256 budget);
```

Materialized raw virtual USDG budget for each strategy.

### `strategyDisabled(address)`

```solidity
function strategyDisabled(address strategy) external view returns (bool disabled);
```

Whether a strategy has been removed from allocation denominators.

### `strategyGeneration(address)`

```solidity
function strategyGeneration(address strategy) external view returns (uint64 generation);
```

Monotonic generation invalidating all stale user weights after strategy disable.

### `strategyIndex(address)`

```solidity
function strategyIndex(address strategy) external view returns (uint256 index);
```

Last global allocation index materialized for each strategy.

### `strategyScaledRemainder(address)`

```solidity
function strategyScaledRemainder(address strategy) external view returns (uint256 scaledRemainder);
```

Scaled fractional budget remainder carried for each strategy.

### `strategyWeight(address)`

```solidity
function strategyWeight(address strategy) external view returns (uint256 weight);
```

Aggregate current-generation active sGBX weight assigned to each strategy.

### `totalLiveWeight()`

```solidity
function totalLiveWeight() external view returns (uint256 arg0);
```

Aggregate current-generation signal weight across all live strategies.

### `unpauseSignalActivations()`

```solidity
function unpauseSignalActivations() external;
```

Reopens delayed signal activation only through the protocol timelock.

### `vault()`

```solidity
function vault() external view returns (address arg0);
```

Canonical GumBallVault physically holding every accounted USDG unit.

### Events

#### `AllocationVoter__DependenciesConfigured(address,address)`

```solidity
event AllocationVoter__DependenciesConfigured(address indexed vault, address indexed stakedGBX);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__PendingSignalsCancelled(address)`

```solidity
event AllocationVoter__PendingSignalsCancelled(address indexed user);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__RevenueNotified(address,uint8,uint256,uint256,uint256)`

```solidity
event AllocationVoter__RevenueNotified(address indexed source, enum AllocationVoter.RevenueSource indexed sourceType, uint256 amount, uint256 indexDelta, uint256 remainder);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__SignalActivationPauseSet(bool)`

```solidity
event AllocationVoter__SignalActivationPauseSet(bool paused);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__SignalsActivated(address,uint256)`

```solidity
event AllocationVoter__SignalsActivated(address indexed user, uint256 activatedAt);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__SignalsPending(address,uint256)`

```solidity
event AllocationVoter__SignalsPending(address indexed user, uint256 activationTime);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__SignalsReset(address)`

```solidity
event AllocationVoter__SignalsReset(address indexed user);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__StrategyBudgetCheckpointed(address,uint256,uint256)`

```solidity
event AllocationVoter__StrategyBudgetCheckpointed(address indexed strategy, uint256 budget, uint256 globalIndex);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__StrategyBudgetConsumed(address,uint256,uint256)`

```solidity
event AllocationVoter__StrategyBudgetConsumed(address indexed strategy, uint256 amount, uint256 budgetRemaining);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__StrategyBudgetScaled(address,uint256,uint256)`

```solidity
event AllocationVoter__StrategyBudgetScaled(address indexed strategy, uint256 budgetAfter, uint256 scaledRemainderAfter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__StrategyDisabled(address,uint64,uint256)`

```solidity
event AllocationVoter__StrategyDisabled(address indexed strategy, uint64 newGeneration, uint256 budgetReturnedToIdle);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__StrategyReactivated(address,uint64)`

```solidity
event AllocationVoter__StrategyReactivated(address indexed strategy, uint64 generation);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__StrategyWeightUpdated(address,uint256,uint256)`

```solidity
event AllocationVoter__StrategyWeightUpdated(address indexed strategy, uint256 previousWeight, uint256 newWeight);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__UserWeightUpdated(address,address,uint256,uint256)`

```solidity
event AllocationVoter__UserWeightUpdated(address indexed user, address indexed strategy, uint256 previousWeight, uint256 newWeight);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__VaultAccountingScaled(uint256,uint256,uint256)`

```solidity
event AllocationVoter__VaultAccountingScaled(uint256 shares, uint256 supplyBefore, uint256 accountedVaultUSDGAfter);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `AllocationVoter__AlreadyConfigured()`

```solidity
error AllocationVoter__AlreadyConfigured();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__DependenciesNotConfigured()`

```solidity
error AllocationVoter__DependenciesNotConfigured();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__DuplicateRevenueSource(address)`

```solidity
error AllocationVoter__DuplicateRevenueSource(address source);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__DuplicateStrategy(address)`

```solidity
error AllocationVoter__DuplicateStrategy(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__InsolventRevenueNotification(uint256,uint256)`

```solidity
error AllocationVoter__InsolventRevenueNotification(uint256 notifiedAfter, uint256 physicalBalance);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__InvalidArrayLength()`

```solidity
error AllocationVoter__InvalidArrayLength();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__NoPendingSignals(address)`

```solidity
error AllocationVoter__NoPendingSignals(address user);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__NotEmergencyGuardian(address)`

```solidity
error AllocationVoter__NotEmergencyGuardian(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__NotGuardianOrTimelock(address)`

```solidity
error AllocationVoter__NotGuardianOrTimelock(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__NotProtocolTimelock(address)`

```solidity
error AllocationVoter__NotProtocolTimelock(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__NotStakedGBX(address)`

```solidity
error AllocationVoter__NotStakedGBX(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__NotVault(address)`

```solidity
error AllocationVoter__NotVault(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__PendingSignalRoundsToZero(address)`

```solidity
error AllocationVoter__PendingSignalRoundsToZero(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__StrategyAlreadyDisabled(address)`

```solidity
error AllocationVoter__StrategyAlreadyDisabled(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__StrategyBudgetTooLow(address,uint256,uint256)`

```solidity
error AllocationVoter__StrategyBudgetTooLow(address strategy, uint256 requested, uint256 available);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__StrategyStillLive(address)`

```solidity
error AllocationVoter__StrategyStillLive(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__UnauthorizedInitializer(address)`

```solidity
error AllocationVoter__UnauthorizedInitializer(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__UnauthorizedRevenueSource(address,uint8)`

```solidity
error AllocationVoter__UnauthorizedRevenueSource(address caller, enum AllocationVoter.RevenueSource source);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__UnregisteredOrInactiveStrategy(address)`

```solidity
error AllocationVoter__UnregisteredOrInactiveStrategy(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__UnstakeExceedsBalance(uint256,uint256)`

```solidity
error AllocationVoter__UnstakeExceedsBalance(uint256 amount, uint256 balance);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__ZeroAddress()`

```solidity
error AllocationVoter__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__ZeroAmount()`

```solidity
error AllocationVoter__ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__ZeroSignalWeight()`

```solidity
error AllocationVoter__ZeroSignalWeight();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__ZeroStakedBalance()`

```solidity
error AllocationVoter__ZeroStakedBalance();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeCastOverflowedUintDowncast(uint8,uint256)`

```solidity
error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

## StakedGBX

Source: [`src/signal/StakedGBX.sol`](../../packages/contracts/src/signal/StakedGBX.sol)

Artifact: `out/StakedGBX.sol/StakedGBX.json`

Public ABI: 15 functions, 5 events, 14 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(address gbx_, address allocationVoter_);
```

Wires immutable GBX and voter references.

**Parameters**

- `allocationVoter_`: The canonical voter checkpointed before stake-balance changes.
- `gbx_`: The canonical GBX token held 1:1 in escrow.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (contract IAllocationVoter arg0);
```

Canonical voter checkpointed before every stake or unstake balance transition.

### `ELIGIBILITY_MODULE()`

```solidity
function ELIGIBILITY_MODULE() external view returns (contract IEligibilityModule arg0);
```

Immutable policy used to validate stake beneficiaries.

### `GBX()`

```solidity
function GBX() external view returns (contract IGBXToken arg0);
```

Canonical GBX held 1:1 behind all outstanding sGBX.

### `allowance(address,address)`

```solidity
function allowance(address owner, address spender) external view returns (uint256 arg0);
```

Returns the remaining number of tokens that `spender` will be allowed to spend on behalf of `owner` through {transferFrom}. This is zero by default. This value changes when {approve} or {transferFrom} are called.

### `approve(address,uint256)`

```solidity
function approve(address spender, uint256 amount) external pure returns (bool approved);
```

sGBX approvals are disabled because the token cannot be transferred.

**Parameters**

- `amount`: Ignored because approvals are forbidden.
- `spender`: Ignored because approvals are forbidden.

**Returns**

- `approved`: Never returned because the call always reverts.

### `balanceOf(address)`

```solidity
function balanceOf(address account) external view returns (uint256 arg0);
```

Returns the value of tokens owned by `account`.

### `decimals()`

```solidity
function decimals() external view returns (uint8 arg0);
```

Returns the number of decimals used to get its user representation. For example, if `decimals` equals `2`, a balance of `505` tokens should be displayed to a user as `5.05` (`505 / 10 ** 2`). Tokens usually opt for a value of 18, imitating the relationship between Ether and Wei. This is the default value returned by this function, unless it's overridden. NOTE: This information is only used for _display_ purposes: it in no way affects any of the arithmetic of the contract, including {IERC20-balanceOf} and {IERC20-transfer}.

### `name()`

```solidity
function name() external view returns (string arg0);
```

Returns the name of the token.

### `stake(uint256)`

```solidity
function stake(uint256 requestedAmount) external returns (uint256 receivedAmount);
```

Stakes GBX and mints sGBX equal to the observed balance increase.

**Parameters**

- `requestedAmount`: Maximum GBX amount requested from the caller.

**Returns**

- `receivedAmount`: Actual GBX received and sGBX minted.

### `stakeFor(address,uint256)`

```solidity
function stakeFor(address beneficiary, uint256 requestedAmount) external returns (uint256 receivedAmount);
```

Stakes caller-provided GBX while minting the non-transferable 1:1 position to an eligible beneficiary.
This typed path lets GumBallRouter sponsor a stake without gaining signal authority or custody of sGBX.

**Parameters**

- `beneficiary`: The eligible account that receives sGBX and signaling authority.
- `requestedAmount`: The maximum raw GBX amount requested from the caller.

**Returns**

- `receivedAmount`: The raw GBX balance increase and equal sGBX amount minted.

### `symbol()`

```solidity
function symbol() external view returns (string arg0);
```

Returns the symbol of the token, usually a shorter version of the name.

### `totalSupply()`

```solidity
function totalSupply() external view returns (uint256 arg0);
```

Returns the value of tokens in existence.

### `transfer(address,uint256)`

```solidity
function transfer(address receiver, uint256 amount) external pure returns (bool transferred);
```

sGBX transfers are disabled; only minting on stake and burning on unstake are allowed.

**Parameters**

- `amount`: Ignored because transfers are forbidden.
- `receiver`: Ignored because transfers are forbidden.

**Returns**

- `transferred`: Never returned because the call always reverts.

### `transferFrom(address,address,uint256)`

```solidity
function transferFrom(address owner, address receiver, uint256 amount) external pure returns (bool transferred);
```

sGBX delegated transfers are disabled.

**Parameters**

- `amount`: Ignored because delegated transfers are forbidden.
- `owner`: Ignored because delegated transfers are forbidden.
- `receiver`: Ignored because delegated transfers are forbidden.

**Returns**

- `transferred`: Never returned because the call always reverts.

### `unstake(uint256)`

```solidity
function unstake(uint256 amount) external;
```

Immediately unstakes GBX after the voter removes excess pending and active signals.

**Parameters**

- `amount`: Exact sGBX amount burned and GBX amount returned to the caller.

### Events

#### `Approval(address,address,uint256)`

```solidity
event Approval(address indexed owner, address indexed spender, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StakedGBX__StakeFunded(address,address,uint256,uint256)`

```solidity
event StakedGBX__StakeFunded(address indexed payer, address indexed beneficiary, uint256 requestedAmount, uint256 receivedAmount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StakedGBX__Staked(address,uint256,uint256)`

```solidity
event StakedGBX__Staked(address indexed user, uint256 requestedAmount, uint256 receivedAmount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StakedGBX__Unstaked(address,uint256)`

```solidity
event StakedGBX__Unstaked(address indexed user, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Transfer(address,address,uint256)`

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `ERC20InsufficientAllowance(address,uint256,uint256)`

```solidity
error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ERC20InsufficientBalance(address,uint256,uint256)`

```solidity
error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ERC20InvalidApprover(address)`

```solidity
error ERC20InvalidApprover(address approver);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ERC20InvalidReceiver(address)`

```solidity
error ERC20InvalidReceiver(address receiver);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ERC20InvalidSender(address)`

```solidity
error ERC20InvalidSender(address sender);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ERC20InvalidSpender(address)`

```solidity
error ERC20InvalidSpender(address spender);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeERC20FailedOperation(address)`

```solidity
error SafeERC20FailedOperation(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StakedGBX__EligibilityCheckFailed(address)`

```solidity
error StakedGBX__EligibilityCheckFailed(address module);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StakedGBX__IneligibleStaker(address)`

```solidity
error StakedGBX__IneligibleStaker(address staker);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StakedGBX__NonTransferable()`

```solidity
error StakedGBX__NonTransferable();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StakedGBX__ZeroAddress()`

```solidity
error StakedGBX__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StakedGBX__ZeroAmount()`

```solidity
error StakedGBX__ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StakedGBX__ZeroReceived()`

```solidity
error StakedGBX__ZeroReceived();
```

_No additional NatSpec notice is present in the compiled artifact._

## AcquisitionStrategy

Source: [`src/strategies/AcquisitionStrategy.sol`](../../packages/contracts/src/strategies/AcquisitionStrategy.sol)

Artifact: `out/AcquisitionStrategy.sol/AcquisitionStrategy.json`

Public ABI: 35 functions, 5 events, 28 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,address,address,address,uint256,uint256,uint256)`

```solidity
constructor(address targetToken_, address gumBallVault_, address allocationVoter_, address assetRegistry_, address protocolTimelock_, address emergencyGuardian_, address dependencyInitializer_, uint256 minimumLotUSDG_, uint256 maximumLotUSDG_, uint256 initialReferenceRate_);
```

Creates one strategy for one canonical target asset and starts its first nonzero auction.

**Parameters**

- `allocationVoter_`: The canonical source of this strategy's virtual USDG budget.
- `assetRegistry_`: The canonical registry whose live status gates fills.
- `dependencyInitializer_`: The one-use account permitted to bind ManagerRewards.
- `emergencyGuardian_`: The stop-only authority permitted to pause fills.
- `gumBallVault_`: The canonical vault receiving 98% of each observed fill and releasing USDG.
- `initialReferenceRate_`: The initial human target-per-USDG reference rate scaled by 1e18.
- `maximumLotUSDG_`: The largest raw USDG fill lot.
- `minimumLotUSDG_`: The smallest raw USDG fill lot.
- `protocolTimelock_`: The delayed authority permitted to unpause fills and reset stale rates.
- `targetToken_`: The registered target asset accepted from auction takers.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (contract IAcquisitionAllocationVoter arg0);
```

Canonical voter supplying this strategy's virtual USDG budget.

### `ASSET_REGISTRY()`

```solidity
function ASSET_REGISTRY() external view returns (contract IAssetRegistry arg0);
```

Canonical registry whose live status gates every fill.

### `AUCTION_DURATION()`

```solidity
function AUCTION_DURATION() external view returns (uint256 arg0);
```

Duration of each linearly decaying reverse Dutch auction.

### `BPS_DENOMINATOR()`

```solidity
function BPS_DENOMINATOR() external view returns (uint256 arg0);
```

Basis-point denominator used by immutable auction and split ratios.

### `DEPENDENCY_INITIALIZER()`

```solidity
function DEPENDENCY_INITIALIZER() external view returns (address arg0);
```

One-use account permitted to bind this strategy's ManagerRewards contract.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Stop-only authority permitted to pause new fills.

### `FLOOR_RATE_BPS()`

```solidity
function FLOOR_RATE_BPS() external view returns (uint256 arg0);
```

Auction floor rate as basis points of its reference rate.

### `GUM_BALL_VAULT()`

```solidity
function GUM_BALL_VAULT() external view returns (contract IGumBallVault arg0);
```

Canonical vault receiving target assets and releasing budgeted USDG.

### `MANAGER_REWARD_BPS()`

```solidity
function MANAGER_REWARD_BPS() external view returns (uint256 arg0);
```

Share of each observed target receipt sent to ManagerRewards.

### `MAXIMUM_LOT_USDG()`

```solidity
function MAXIMUM_LOT_USDG() external view returns (uint256 arg0);
```

Largest raw USDG amount accepted by a fill.

### `MAX_REFERENCE_RATE()`

```solidity
function MAX_REFERENCE_RATE() external view returns (uint256 arg0);
```

Largest reference rate accepted by any auction.

### `MAX_REFERENCE_RESET_BPS()`

```solidity
function MAX_REFERENCE_RESET_BPS() external view returns (uint256 arg0);
```

Largest timelocked reset relative to the prior reference rate.

### `MINIMUM_LOT_USDG()`

```solidity
function MINIMUM_LOT_USDG() external view returns (uint256 arg0);
```

Smallest raw USDG amount accepted by a fill.

### `MIN_REFERENCE_RESET_BPS()`

```solidity
function MIN_REFERENCE_RESET_BPS() external view returns (uint256 arg0);
```

Smallest timelocked reset relative to the prior reference rate.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Delayed authority permitted to reset stale rates and resume fills.

### `RATE_PRECISION()`

```solidity
function RATE_PRECISION() external view returns (uint256 arg0);
```

Human-normalized auction-rate precision.

### `START_RATE_BPS()`

```solidity
function START_RATE_BPS() external view returns (uint256 arg0);
```

Auction starting rate as basis points of its reference rate.

### `TARGET_DECIMALS()`

```solidity
function TARGET_DECIMALS() external view returns (uint8 arg0);
```

Immutable decimal count of the target asset.

### `TARGET_TOKEN()`

```solidity
function TARGET_TOKEN() external view returns (contract IERC20 arg0);
```

Registered target asset delivered by takers and split between vault and managers.

### `USDG_DECIMALS()`

```solidity
function USDG_DECIMALS() external view returns (uint8 arg0);
```

Immutable decimal count of canonical USDG.

### `VAULT_BPS()`

```solidity
function VAULT_BPS() external view returns (uint256 arg0);
```

Share of each observed target receipt sent to GumBallVault.

### `auctionId()`

```solidity
function auctionId() external view returns (uint64 arg0);
```

Monotonic identifier of the currently active auction.

### `auctionStartTime()`

```solidity
function auctionStartTime() external view returns (uint64 arg0);
```

Start timestamp of the currently active auction.

### `currentRate()`

```solidity
function currentRate() external view returns (uint256 rate);
```

Returns the current human-normalized target tokens per USDG rate, scaled by 1e18.

**Returns**

- `rate`: The linearly decayed nonzero target-per-USDG auction rate scaled by 1e18.

### `fill(uint64,uint256,uint256,address,uint256)`

```solidity
function fill(uint64 expectedAuctionId, uint256 usdGAmount, uint256 maxTargetAmount, address usdGReceiver, uint256 deadline) external returns (uint256 targetReceived);
```

Fills a bounded USDG lot at the current linearly decaying target-token rate.

**Parameters**

- `deadline`: The final timestamp at which the taker accepts execution.
- `expectedAuctionId`: The current auction ID committed by the taker.
- `maxTargetAmount`: The most raw target tokens the taker permits the strategy to collect.
- `usdGAmount`: The raw USDG amount requested from the strategy's virtual budget.
- `usdGReceiver`: The account that receives USDG after target delivery and splitting complete.

**Returns**

- `targetReceived`: The raw target-token balance increase observed by the strategy.

### `fillsPaused()`

```solidity
function fillsPaused() external view returns (bool arg0);
```

Whether the guardian has temporarily stopped new auction fills.

### `floorRate()`

```solidity
function floorRate() external view returns (uint256 arg0);
```

Human target-per-USDG rate at and after current auction expiry, scaled by 1e18.

### `initializeManagerRewards(address)`

```solidity
function initializeManagerRewards(address managerRewards_) external;
```

Wires the strategy-specific ManagerRewards accumulator exactly once.

**Parameters**

- `managerRewards_`: The deployed accumulator for this strategy and target token.

### `managerRewards()`

```solidity
function managerRewards() external view returns (contract IManagerRewards arg0);
```

Strategy-specific accumulator receiving the 2% manager share.

### `pauseFills()`

```solidity
function pauseFills() external;
```

Immediately pauses new fills; existing target and vault assets remain redeemable.

### `referenceRate()`

```solidity
function referenceRate() external view returns (uint256 arg0);
```

Human target-per-USDG rate anchoring the current auction, scaled by 1e18.

### `resetReferenceRate(uint256,uint256)`

```solidity
function resetReferenceRate(uint256 expectedReferenceRate, uint256 newReferenceRate) external;
```

Resets a reference within immutable 50%-to-200% bounds around the timelock-reviewed baseline.
The current rate and auction expiry are intentionally not execution preconditions: fills and permissionless restarts cannot censor a mature reset. Concurrent resets remain bounded to their supplied reviewed baselines.

**Parameters**

- `expectedReferenceRate`: The reference rate observed and committed when the operation was scheduled.
- `newReferenceRate`: The reviewed human target-per-USDG reference rate scaled by 1e18.

### `restartExpiredAuction()`

```solidity
function restartExpiredAuction() external;
```

Restarts an unfilled expired auction at the unchanged reference bounds.

### `startRate()`

```solidity
function startRate() external view returns (uint256 arg0);
```

Human target-per-USDG rate at the current auction start, scaled by 1e18.

### `unpauseFills()`

```solidity
function unpauseFills() external;
```

Reopens fills only through the delayed protocol timelock.

### Events

#### `AcquisitionStrategy__AuctionStarted(uint64,uint256,uint256,uint256,uint256)`

```solidity
event AcquisitionStrategy__AuctionStarted(uint64 indexed auctionId, uint256 referenceRate, uint256 startRate, uint256 floorRate, uint256 startTime);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__FillPauseSet(bool)`

```solidity
event AcquisitionStrategy__FillPauseSet(bool paused);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__Filled(uint64,address,address,uint256,uint256,uint256,uint256,uint256)`

```solidity
event AcquisitionStrategy__Filled(uint64 indexed auctionId, address indexed taker, address indexed usdGReceiver, uint256 usdGAmount, uint256 targetReceived, uint256 vaultAmount, uint256 managerAmount, uint256 clearingRate);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__ManagerRewardsConfigured(address)`

```solidity
event AcquisitionStrategy__ManagerRewardsConfigured(address indexed managerRewards);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__ReferenceRateReset(uint256,uint256,uint64)`

```solidity
event AcquisitionStrategy__ReferenceRateReset(uint256 previousRate, uint256 newRate, uint64 indexed auctionId);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `AcquisitionStrategy__AlreadyConfigured()`

```solidity
error AcquisitionStrategy__AlreadyConfigured();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__AuctionExpired(uint64)`

```solidity
error AcquisitionStrategy__AuctionExpired(uint64 auctionId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__AuctionNotExpired(uint64)`

```solidity
error AcquisitionStrategy__AuctionNotExpired(uint64 auctionId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__DeadlineExpired(uint256)`

```solidity
error AcquisitionStrategy__DeadlineExpired(uint256 deadline);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__DecimalsChanged(uint8,uint8,uint8,uint8)`

```solidity
error AcquisitionStrategy__DecimalsChanged(uint8 expectedUSDG, uint8 actualUSDG, uint8 expectedTarget, uint8 actualTarget);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__FillsPaused()`

```solidity
error AcquisitionStrategy__FillsPaused();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__InactiveStrategy()`

```solidity
error AcquisitionStrategy__InactiveStrategy();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__InsufficientBudget(uint256,uint256)`

```solidity
error AcquisitionStrategy__InsufficientBudget(uint256 requested, uint256 available);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__InvalidLotBounds()`

```solidity
error AcquisitionStrategy__InvalidLotBounds();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__InvalidRate()`

```solidity
error AcquisitionStrategy__InvalidRate();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__ManagerRewardsNotConfigured()`

```solidity
error AcquisitionStrategy__ManagerRewardsNotConfigured();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__MaxTargetExceeded(uint256,uint256)`

```solidity
error AcquisitionStrategy__MaxTargetExceeded(uint256 required, uint256 maximum);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__NotEmergencyGuardian(address)`

```solidity
error AcquisitionStrategy__NotEmergencyGuardian(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__NotProtocolTimelock(address)`

```solidity
error AcquisitionStrategy__NotProtocolTimelock(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__ObservedDebitMismatch(uint256,uint256)`

```solidity
error AcquisitionStrategy__ObservedDebitMismatch(uint256 expected, uint256 observed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__ObservedSplitMismatch(uint256,uint256,uint256,uint256)`

```solidity
error AcquisitionStrategy__ObservedSplitMismatch(uint256 expectedVault, uint256 observedVault, uint256 expectedManagers, uint256 observedManagers);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__ReferenceResetOutOfBounds(uint256,uint256,uint256)`

```solidity
error AcquisitionStrategy__ReferenceResetOutOfBounds(uint256 proposed, uint256 minimum, uint256 maximum);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__StaleAuctionId(uint64,uint64)`

```solidity
error AcquisitionStrategy__StaleAuctionId(uint64 expected, uint64 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__UnauthorizedInitializer(address)`

```solidity
error AcquisitionStrategy__UnauthorizedInitializer(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__UnderpaidTarget(uint256,uint256)`

```solidity
error AcquisitionStrategy__UnderpaidTarget(uint256 required, uint256 received);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__UnsupportedDecimals(uint8,uint8)`

```solidity
error AcquisitionStrategy__UnsupportedDecimals(uint8 usdGDecimals, uint8 targetDecimals);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__ZeroAddress()`

```solidity
error AcquisitionStrategy__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__ZeroReceiver()`

```solidity
error AcquisitionStrategy__ZeroReceiver();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RateMath__UnsupportedDecimals(uint8)`

```solidity
error RateMath__UnsupportedDecimals(uint8 decimals);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RateMath__ZeroAmount()`

```solidity
error RateMath__ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeCastOverflowedUintDowncast(uint8,uint256)`

```solidity
error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeERC20FailedOperation(address)`

```solidity
error SafeERC20FailedOperation(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

## BuybackBurnStrategy

Source: [`src/strategies/BuybackBurnStrategy.sol`](../../packages/contracts/src/strategies/BuybackBurnStrategy.sol)

Artifact: `out/BuybackBurnStrategy.sol/BuybackBurnStrategy.json`

Public ABI: 30 functions, 4 events, 23 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,address,address,uint256,uint256,uint256)`

```solidity
constructor(address gbx_, address gumBallVault_, address allocationVoter_, address assetRegistry_, address protocolTimelock_, address emergencyGuardian_, uint256 minimumLotUSDG_, uint256 maximumLotUSDG_, uint256 initialReferenceRate_);
```

Starts the first buyback auction with immutable custody and maintenance boundaries.

**Parameters**

- `allocationVoter_`: The canonical source of this strategy's virtual USDG budget.
- `assetRegistry_`: The canonical registry whose live status gates fills.
- `emergencyGuardian_`: The stop-only authority permitted to pause fills.
- `gbx_`: The canonical GBX token collected and irreversibly burned on every fill.
- `gumBallVault_`: The canonical vault that releases budgeted USDG only after the burn.
- `initialReferenceRate_`: The initial human GBX-per-USDG reference rate scaled by 1e18.
- `maximumLotUSDG_`: The largest raw USDG fill lot.
- `minimumLotUSDG_`: The smallest raw USDG fill lot.
- `protocolTimelock_`: The delayed authority permitted to unpause fills and reset stale rates.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (contract IBuybackAllocationVoter arg0);
```

Canonical voter supplying this strategy's virtual USDG budget.

### `ASSET_REGISTRY()`

```solidity
function ASSET_REGISTRY() external view returns (contract IAssetRegistry arg0);
```

Canonical registry whose live status gates every fill.

### `AUCTION_DURATION()`

```solidity
function AUCTION_DURATION() external view returns (uint256 arg0);
```

Duration of each linearly decaying reverse Dutch auction.

### `BPS_DENOMINATOR()`

```solidity
function BPS_DENOMINATOR() external view returns (uint256 arg0);
```

Basis-point denominator used by immutable auction ratios.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Stop-only authority permitted to pause new fills.

### `FLOOR_RATE_BPS()`

```solidity
function FLOOR_RATE_BPS() external view returns (uint256 arg0);
```

Auction floor rate as basis points of its reference rate.

### `GBX()`

```solidity
function GBX() external view returns (contract IGBXToken arg0);
```

Canonical GBX collected from takers and irreversibly burned before USDG release.

### `GBX_DECIMALS()`

```solidity
function GBX_DECIMALS() external view returns (uint8 arg0);
```

Immutable decimal count of GBX.

### `GUM_BALL_VAULT()`

```solidity
function GUM_BALL_VAULT() external view returns (contract IGumBallVault arg0);
```

Canonical vault releasing budgeted USDG only after the GBX burn.

### `MAXIMUM_LOT_USDG()`

```solidity
function MAXIMUM_LOT_USDG() external view returns (uint256 arg0);
```

Largest raw USDG amount accepted by a fill.

### `MAX_REFERENCE_RATE()`

```solidity
function MAX_REFERENCE_RATE() external view returns (uint256 arg0);
```

Largest reference rate accepted by any auction.

### `MAX_REFERENCE_RESET_BPS()`

```solidity
function MAX_REFERENCE_RESET_BPS() external view returns (uint256 arg0);
```

Largest timelocked reset relative to the prior reference rate.

### `MINIMUM_LOT_USDG()`

```solidity
function MINIMUM_LOT_USDG() external view returns (uint256 arg0);
```

Smallest raw USDG amount accepted by a fill.

### `MIN_REFERENCE_RESET_BPS()`

```solidity
function MIN_REFERENCE_RESET_BPS() external view returns (uint256 arg0);
```

Smallest timelocked reset relative to the prior reference rate.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Delayed authority permitted to reset stale rates and resume fills.

### `RATE_PRECISION()`

```solidity
function RATE_PRECISION() external view returns (uint256 arg0);
```

Human-normalized auction-rate precision.

### `START_RATE_BPS()`

```solidity
function START_RATE_BPS() external view returns (uint256 arg0);
```

Auction starting rate as basis points of its reference rate.

### `USDG_DECIMALS()`

```solidity
function USDG_DECIMALS() external view returns (uint8 arg0);
```

Immutable decimal count of canonical USDG.

### `auctionId()`

```solidity
function auctionId() external view returns (uint64 arg0);
```

Monotonic identifier of the currently active buyback auction.

### `auctionStartTime()`

```solidity
function auctionStartTime() external view returns (uint64 arg0);
```

Start timestamp of the currently active buyback auction.

### `currentRate()`

```solidity
function currentRate() external view returns (uint256 rate);
```

Returns the nonzero human-normalized GBX per USDG rate, scaled by 1e18.

**Returns**

- `rate`: The linearly decayed nonzero GBX-per-USDG auction rate scaled by 1e18.

### `fill(uint64,uint256,uint256,address,uint256)`

```solidity
function fill(uint64 expectedAuctionId, uint256 usdGAmount, uint256 maxGBXAmount, address usdGReceiver, uint256 deadline) external returns (uint256 gbxBurned);
```

Fills a bounded lot, burns every observed GBX unit, and only then releases USDG.

**Parameters**

- `deadline`: The final timestamp at which the taker accepts execution.
- `expectedAuctionId`: The current auction ID committed by the taker.
- `maxGBXAmount`: The most raw GBX the taker permits the strategy to collect and burn.
- `usdGAmount`: The raw USDG amount requested from the strategy's virtual budget.
- `usdGReceiver`: The account that receives USDG after the GBX burn completes.

**Returns**

- `gbxBurned`: The raw GBX balance increase observed and irreversibly burned.

### `fillsPaused()`

```solidity
function fillsPaused() external view returns (bool arg0);
```

Whether the guardian has temporarily stopped new buyback fills.

### `floorRate()`

```solidity
function floorRate() external view returns (uint256 arg0);
```

Human GBX-per-USDG rate at and after current auction expiry, scaled by 1e18.

### `pauseFills()`

```solidity
function pauseFills() external;
```

Pauses fills immediately without blocking burns, redemptions, claims, or unstaking elsewhere.

### `referenceRate()`

```solidity
function referenceRate() external view returns (uint256 arg0);
```

Human GBX-per-USDG rate anchoring the current auction, scaled by 1e18.

### `resetReferenceRate(uint256,uint256)`

```solidity
function resetReferenceRate(uint256 expectedReferenceRate, uint256 newReferenceRate) external;
```

Resets a reference within immutable safety bounds around the timelock-reviewed baseline.
The current rate and auction expiry are intentionally not execution preconditions: fills and permissionless restarts cannot censor a mature reset. Concurrent resets remain bounded to their supplied reviewed baselines.

**Parameters**

- `expectedReferenceRate`: The reference rate observed and committed when the operation was scheduled.
- `newReferenceRate`: The reviewed human GBX-per-USDG reference rate scaled by 1e18.

### `restartExpiredAuction()`

```solidity
function restartExpiredAuction() external;
```

Restarts an expired unfilled auction at unchanged bounds.

### `startRate()`

```solidity
function startRate() external view returns (uint256 arg0);
```

Human GBX-per-USDG rate at the current auction start, scaled by 1e18.

### `unpauseFills()`

```solidity
function unpauseFills() external;
```

Reopens fills only through the delayed protocol timelock.

### Events

#### `BuybackBurnStrategy__AuctionStarted(uint64,uint256,uint256,uint256,uint256)`

```solidity
event BuybackBurnStrategy__AuctionStarted(uint64 indexed auctionId, uint256 referenceRate, uint256 startRate, uint256 floorRate, uint256 startTime);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__FillPauseSet(bool)`

```solidity
event BuybackBurnStrategy__FillPauseSet(bool paused);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__GBXBoughtAndBurned(uint64,address,address,uint256,uint256,uint256,uint256)`

```solidity
event BuybackBurnStrategy__GBXBoughtAndBurned(uint64 indexed auctionId, address indexed taker, address indexed usdGReceiver, uint256 usdGSpent, uint256 gbxBurned, uint256 clearingRate, uint256 totalSupplyAfter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__ReferenceRateReset(uint256,uint256,uint64)`

```solidity
event BuybackBurnStrategy__ReferenceRateReset(uint256 previousRate, uint256 newRate, uint64 indexed auctionId);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `BuybackBurnStrategy__AuctionExpired(uint64)`

```solidity
error BuybackBurnStrategy__AuctionExpired(uint64 auctionId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__AuctionNotExpired(uint64)`

```solidity
error BuybackBurnStrategy__AuctionNotExpired(uint64 auctionId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__DeadlineExpired(uint256)`

```solidity
error BuybackBurnStrategy__DeadlineExpired(uint256 deadline);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__DecimalsChanged(uint8,uint8,uint8,uint8)`

```solidity
error BuybackBurnStrategy__DecimalsChanged(uint8 expectedUSDG, uint8 actualUSDG, uint8 expectedGBX, uint8 actualGBX);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__FillsPaused()`

```solidity
error BuybackBurnStrategy__FillsPaused();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__InactiveStrategy()`

```solidity
error BuybackBurnStrategy__InactiveStrategy();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__InsufficientBudget(uint256,uint256)`

```solidity
error BuybackBurnStrategy__InsufficientBudget(uint256 requested, uint256 available);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__InvalidLotBounds()`

```solidity
error BuybackBurnStrategy__InvalidLotBounds();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__InvalidRate()`

```solidity
error BuybackBurnStrategy__InvalidRate();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__MaxGBXExceeded(uint256,uint256)`

```solidity
error BuybackBurnStrategy__MaxGBXExceeded(uint256 required, uint256 maximum);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__NotEmergencyGuardian(address)`

```solidity
error BuybackBurnStrategy__NotEmergencyGuardian(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__NotProtocolTimelock(address)`

```solidity
error BuybackBurnStrategy__NotProtocolTimelock(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__ReferenceResetOutOfBounds(uint256,uint256,uint256)`

```solidity
error BuybackBurnStrategy__ReferenceResetOutOfBounds(uint256 proposed, uint256 minimum, uint256 maximum);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__StaleAuctionId(uint64,uint64)`

```solidity
error BuybackBurnStrategy__StaleAuctionId(uint64 expected, uint64 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__UnderpaidGBX(uint256,uint256)`

```solidity
error BuybackBurnStrategy__UnderpaidGBX(uint256 required, uint256 received);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__UnsupportedDecimals(uint8,uint8)`

```solidity
error BuybackBurnStrategy__UnsupportedDecimals(uint8 usdGDecimals, uint8 gbxDecimals);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__ZeroAddress()`

```solidity
error BuybackBurnStrategy__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackBurnStrategy__ZeroReceiver()`

```solidity
error BuybackBurnStrategy__ZeroReceiver();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RateMath__UnsupportedDecimals(uint8)`

```solidity
error RateMath__UnsupportedDecimals(uint8 decimals);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RateMath__ZeroAmount()`

```solidity
error RateMath__ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeCastOverflowedUintDowncast(uint8,uint256)`

```solidity
error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeERC20FailedOperation(address)`

```solidity
error SafeERC20FailedOperation(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

## HoldUSDGStrategy

Source: [`src/strategies/HoldUSDGStrategy.sol`](../../packages/contracts/src/strategies/HoldUSDGStrategy.sol)

Artifact: `out/HoldUSDGStrategy.sol/HoldUSDGStrategy.json`

Public ABI: 1 function, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `strategyId()`

```solidity
function strategyId() external pure returns (bytes32 id);
```

Human-readable strategy identifier for indexers and user interfaces.

**Returns**

- `id`: The deterministic `HOLD_USDG` strategy identifier.

## RevenueRouter

Source: [`src/strategies/RevenueRouter.sol`](../../packages/contracts/src/strategies/RevenueRouter.sol)

Artifact: `out/RevenueRouter.sol/RevenueRouter.json`

Public ABI: 4 functions, 1 event, 7 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address)`

```solidity
constructor(address usdG_, address gumBallVault_, address allocationVoter_);
```

Wires canonical USDG, vault, and voter permanently.

**Parameters**

- `allocationVoter_`: The canonical voter notified only for the vault's observed increase.
- `gumBallVault_`: The canonical vault receiving every routed USDG unit.
- `usdG_`: The canonical USDG token routed as observed balance deltas.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (contract AllocationVoter arg0);
```

Canonical voter notified only for the vault's observed receipt.

### `GUM_BALL_VAULT()`

```solidity
function GUM_BALL_VAULT() external view returns (address arg0);
```

Canonical vault receiving all routed USDG.

### `USDG()`

```solidity
function USDG() external view returns (contract IERC20 arg0);
```

Canonical USDG routed using observed balance changes.

### `routeRevenue(uint256,bytes32)`

```solidity
function routeRevenue(uint256 requestedAmount, bytes32 sourceId) external returns (uint256 vaultReceived);
```

Pulls USDG, forwards the observed receipt to the vault, and notifies only the vault's observed increase.

**Parameters**

- `requestedAmount`: The maximum raw USDG amount requested from the payer.
- `sourceId`: An offchain-defined attribution label emitted for observability only.

**Returns**

- `vaultReceived`: The raw USDG balance increase observed at GumBallVault.

### Events

#### `RevenueRouter__RevenueRouted(address,bytes32,uint256,uint256)`

```solidity
event RevenueRouter__RevenueRouted(address indexed payer, bytes32 indexed sourceId, uint256 requestedAmount, uint256 vaultReceived);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RevenueRouter__PayerDebitExceededMaximum(uint256,uint256)`

```solidity
error RevenueRouter__PayerDebitExceededMaximum(uint256 maximum, uint256 observed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RevenueRouter__TargetHasNoCode(address)`

```solidity
error RevenueRouter__TargetHasNoCode(address target);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RevenueRouter__ZeroAddress()`

```solidity
error RevenueRouter__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RevenueRouter__ZeroAmount()`

```solidity
error RevenueRouter__ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RevenueRouter__ZeroReceived()`

```solidity
error RevenueRouter__ZeroReceived();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeERC20FailedOperation(address)`

```solidity
error SafeERC20FailedOperation(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

## IStrategyDeployerRegistryIdentity

Source: [`src/strategies/StrategyDeployer.sol`](../../packages/contracts/src/strategies/StrategyDeployer.sol)

Artifact: `out/StrategyDeployer.sol/IStrategyDeployerRegistryIdentity.json`

Public ABI: 13 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Returns the registry's canonical emergency guardian.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Returns the registry's canonical protocol timelock.

### `STRATEGY_DEPLOYER()`

```solidity
function STRATEGY_DEPLOYER() external view returns (address arg0);
```

Returns the registry's canonical typed strategy deployer.

### `USDG()`

```solidity
function USDG() external view returns (address arg0);
```

Returns the registry's canonical USDG token.

### `assetAt(uint256)`

```solidity
function assetAt(uint256 index) external view returns (address arg0);
```

Returns the registered token address at a bounded index.

**Parameters**

- `index`: The zero-based asset index.

**Returns**

- `_0`: The registered token address.

### `assetCount()`

```solidity
function assetCount() external view returns (uint256 arg0);
```

Returns the number of registered assets.

**Returns**

- `_0`: The bounded asset count.

### `configFor(address)`

```solidity
function configFor(address token) external view returns (struct IAssetRegistry.AssetConfig arg0);
```

Returns the full configuration for a registered token.

**Parameters**

- `token`: The registered token address.

**Returns**

- `_0`: The asset configuration.

### `isLiveStrategy(address)`

```solidity
function isLiveStrategy(address strategy) external view returns (bool arg0);
```

Returns whether a directly deployed strategy is registered and acquisition-enabled.

**Parameters**

- `strategy`: The candidate strategy address.

**Returns**

- `_0`: Whether the strategy is live.

### `isRegisteredAsset(address)`

```solidity
function isRegisteredAsset(address token) external view returns (bool arg0);
```

Returns whether the address is a registered asset token.

**Parameters**

- `token`: The candidate token address.

**Returns**

- `_0`: Whether the token is registered.

### `stockTokenDependencyFor(address)`

```solidity
function stockTokenDependencyFor(address token) external view returns (struct IAssetRegistry.StockTokenDependency arg0);
```

Returns the immutable registration-time beacon identity for a stock token.

**Parameters**

- `token`: The registered stock-token proxy address.

**Returns**

- `_0`: The registration-time token, beacon, implementation, and multiplier identity.

### `strategyAt(uint256)`

```solidity
function strategyAt(uint256 index) external view returns (address arg0);
```

Returns a directly deployed strategy at a bounded index.

**Parameters**

- `index`: The zero-based strategy index.

**Returns**

- `_0`: The directly deployed strategy address.

### `strategyCount()`

```solidity
function strategyCount() external view returns (uint256 arg0);
```

Returns the number of directly deployed signal strategies, including standalone buyback.

**Returns**

- `_0`: The bounded strategy count.

### `tokenForStrategy(address)`

```solidity
function tokenForStrategy(address strategy) external view returns (address arg0);
```

Returns the registered asset token associated with a directly deployed strategy.

**Parameters**

- `strategy`: The directly deployed strategy address.

**Returns**

- `_0`: The associated token, or zero for a standalone strategy.

## IStrategyDeployerStakedIdentity

Source: [`src/strategies/StrategyDeployer.sol`](../../packages/contracts/src/strategies/StrategyDeployer.sol)

Artifact: `out/StrategyDeployer.sol/IStrategyDeployerStakedIdentity.json`

Public ABI: 3 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (address arg0);
```

Returns the staking token's canonical allocation voter.

### `ELIGIBILITY_MODULE()`

```solidity
function ELIGIBILITY_MODULE() external view returns (address arg0);
```

Returns the staking token's canonical eligibility module.

### `GBX()`

```solidity
function GBX() external view returns (address arg0);
```

Returns the staking token's canonical GBX token.

## IStrategyDeployerVaultIdentity

Source: [`src/strategies/StrategyDeployer.sol`](../../packages/contracts/src/strategies/StrategyDeployer.sol)

Artifact: `out/StrategyDeployer.sol/IStrategyDeployerVaultIdentity.json`

Public ABI: 5 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (address arg0);
```

Returns the vault's canonical allocation voter.

### `ASSET_REGISTRY()`

```solidity
function ASSET_REGISTRY() external view returns (address arg0);
```

Returns the vault's canonical asset registry.

### `ELIGIBILITY_MODULE()`

```solidity
function ELIGIBILITY_MODULE() external view returns (address arg0);
```

Returns the vault's canonical eligibility module.

### `GBX()`

```solidity
function GBX() external view returns (address arg0);
```

Returns the vault's canonical GBX token.

### `USDG()`

```solidity
function USDG() external view returns (address arg0);
```

Returns the vault's canonical USDG token.

## IStrategyDeployerVoterIdentity

Source: [`src/strategies/StrategyDeployer.sol`](../../packages/contracts/src/strategies/StrategyDeployer.sol)

Artifact: `out/StrategyDeployer.sol/IStrategyDeployerVoterIdentity.json`

Public ABI: 11 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `ASSET_REGISTRY()`

```solidity
function ASSET_REGISTRY() external view returns (address arg0);
```

Returns the voter's canonical asset registry.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Returns the voter's canonical emergency guardian.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Returns the voter's canonical protocol timelock.

### `USDG()`

```solidity
function USDG() external view returns (address arg0);
```

Returns the voter's canonical USDG token.

### `consumeStrategyBudget(address,uint256)`

```solidity
function consumeStrategyBudget(address strategy, uint256 amount) external;
```

Consumes a strategy's virtual USDG budget before the vault releases physical USDG.
Must only be callable by the immutable GumBallVault.

**Parameters**

- `amount`: The raw USDG budget amount consumed.
- `strategy`: The live strategy spending its budget.

### `dependenciesConfigured()`

```solidity
function dependenciesConfigured() external view returns (bool arg0);
```

Returns whether the voter's set-once dependencies are configured.

### `onStake(address)`

```solidity
function onStake(address user) external;
```

Checkpoints a user's matured signals and rewards immediately before sGBX is minted.
Must only be called by the immutable StakedGBX contract.

**Parameters**

- `user`: The account receiving newly staked sGBX.

### `onUnstake(address,uint256)`

```solidity
function onUnstake(address user, uint256 amount) external;
```

Removes enough pending and active signal weight before sGBX is burned.
Must only be called by StakedGBX and must leave assigned weight within the post-unstake balance.

**Parameters**

- `amount`: The amount of sGBX being burned.
- `user`: The account unstaking sGBX.

### `scaleBudgetsAfterRedemption(uint256,uint256)`

```solidity
function scaleBudgetsAfterRedemption(uint256 shares, uint256 supplyBefore) external;
```

Scales every virtual budget by (supplyBefore - shares) / supplyBefore before a redemption burn.
The strategy universe is bounded, so the implementation may checkpoint and iterate over all live strategies.

**Parameters**

- `shares`: The GBX shares being redeemed.
- `supplyBefore`: The total GBX supply before the redemption burn.

### `stakedGBX()`

```solidity
function stakedGBX() external view returns (address arg0);
```

Returns the canonical non-transferable staked GBX token.

### `vault()`

```solidity
function vault() external view returns (address arg0);
```

Returns the canonical GumBallVault bound to the voter.

## StrategyDeployer

Source: [`src/strategies/StrategyDeployer.sol`](../../packages/contracts/src/strategies/StrategyDeployer.sol)

Artifact: `out/StrategyDeployer.sol/StrategyDeployer.json`

Public ABI: 36 functions, 5 events, 17 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,bytes32[5],uint256[5])`

```solidity
constructor(address protocolTimelock, address emergencyGuardian, address gbx, address dependencyInitializer, bytes32[5] codeAndBootstrapHashes, uint256[5] codeLengthsAndBootstrapCount);
```

Deploys the immutable typed strategy-creation authority.

**Parameters**

- `codeAndBootstrapHashes`: Positional commitments: 0 AcquisitionStrategy creation code, 1 ManagerRewards creation code, 2 BuybackBurnStrategy creation code, 3 HoldUSDGStrategy creation code, and 4 the ABI-encoded ordered bootstrap acquisition-target list.
- `codeLengthsAndBootstrapCount`: Positional commitments: 0..3 are the exact byte lengths corresponding to `codeAndBootstrapHashes[0..3]`; index 4 is the reviewed bootstrap acquisition-target count.
- `dependencyInitializer`: One-use account permitted to close the canonical dependency graph.
- `emergencyGuardian`: Canonical stop-only strategy guardian.
- `gbx`: Canonical cumulatively capped GBX token.
- `protocolTimelock`: Sole caller permitted to deploy or finalize strategies.

### `ACQUISITION_STRATEGY_CREATION_CODE_HASH()`

```solidity
function ACQUISITION_STRATEGY_CREATION_CODE_HASH() external view returns (bytes32 arg0);
```

Exact compiler creation-code hash accepted for AcquisitionStrategy deployments.

### `ACQUISITION_STRATEGY_CREATION_CODE_LENGTH()`

```solidity
function ACQUISITION_STRATEGY_CREATION_CODE_LENGTH() external view returns (uint256 arg0);
```

Exact accepted AcquisitionStrategy compiler creation-code byte length.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (address arg0);
```

Canonical allocation voter fixed when the reciprocal graph is initialized.

### `ASSET_REGISTRY()`

```solidity
function ASSET_REGISTRY() external view returns (address arg0);
```

Canonical bounded registry fixed when the reciprocal graph is initialized.

### `BUYBACK_BURN_STRATEGY_CREATION_CODE_HASH()`

```solidity
function BUYBACK_BURN_STRATEGY_CREATION_CODE_HASH() external view returns (bytes32 arg0);
```

Exact compiler creation-code hash accepted for the canonical BuybackBurnStrategy deployment.

### `BUYBACK_BURN_STRATEGY_CREATION_CODE_LENGTH()`

```solidity
function BUYBACK_BURN_STRATEGY_CREATION_CODE_LENGTH() external view returns (uint256 arg0);
```

Exact accepted BuybackBurnStrategy compiler creation-code byte length.

### `DEPENDENCY_INITIALIZER()`

```solidity
function DEPENDENCY_INITIALIZER() external view returns (address arg0);
```

One-use account permitted to bind the reciprocal protocol dependency graph.

### `ELIGIBILITY_MODULE()`

```solidity
function ELIGIBILITY_MODULE() external view returns (address arg0);
```

Canonical eligibility module fixed when the reciprocal graph is initialized.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Canonical stop-only guardian inherited by deployed auction strategies.

### `EXPECTED_BOOTSTRAP_ACQUISITION_TARGETS_HASH()`

```solidity
function EXPECTED_BOOTSTRAP_ACQUISITION_TARGETS_HASH() external view returns (bytes32 arg0);
```

Hash of the ABI-encoded ordered acquisition-target list bootstrap finalization must match.

### `EXPECTED_BOOTSTRAP_ACQUISITION_TARGET_COUNT()`

```solidity
function EXPECTED_BOOTSTRAP_ACQUISITION_TARGET_COUNT() external view returns (uint256 arg0);
```

Reviewed acquisition-target count that bootstrap finalization must match.

### `GBX()`

```solidity
function GBX() external view returns (address arg0);
```

Canonical cumulatively capped GBX token inherited by the buyback strategy.

### `GUM_BALL_VAULT()`

```solidity
function GUM_BALL_VAULT() external view returns (address arg0);
```

Canonical raw-balance basket vault fixed when the reciprocal graph is initialized.

### `HOLD_USDG_STRATEGY_CREATION_CODE_HASH()`

```solidity
function HOLD_USDG_STRATEGY_CREATION_CODE_HASH() external view returns (bytes32 arg0);
```

Exact compiler creation-code hash accepted for the canonical HoldUSDGStrategy deployment.

### `HOLD_USDG_STRATEGY_CREATION_CODE_LENGTH()`

```solidity
function HOLD_USDG_STRATEGY_CREATION_CODE_LENGTH() external view returns (uint256 arg0);
```

Exact accepted HoldUSDGStrategy compiler creation-code byte length.

### `MANAGER_REWARDS_CREATION_CODE_HASH()`

```solidity
function MANAGER_REWARDS_CREATION_CODE_HASH() external view returns (bytes32 arg0);
```

Exact compiler creation-code hash accepted for ManagerRewards deployments.

### `MANAGER_REWARDS_CREATION_CODE_LENGTH()`

```solidity
function MANAGER_REWARDS_CREATION_CODE_LENGTH() external view returns (uint256 arg0);
```

Exact accepted ManagerRewards compiler creation-code byte length.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Canonical purpose-limited timelock and sole strategy deployment caller.

### `USDG()`

```solidity
function USDG() external view returns (address arg0);
```

Canonical USDG token fixed when the reciprocal graph is initialized.

### `acquisitionPair(address)`

```solidity
function acquisitionPair(address strategy) external view returns (struct IStrategyDeployer.AcquisitionPair pair);
```

Returns the full immutable graph and runtime provenance for an acquisition strategy.

**Parameters**

- `strategy`: The recorded AcquisitionStrategy address.

**Returns**

- `pair`: The recorded reciprocal acquisition/rewards graph and runtime identities.

### `acquisitionStrategyForToken(address)`

```solidity
function acquisitionStrategyForToken(address targetToken) external view returns (address strategy);
```

Returns the unique acquisition strategy deployed for a target token, or zero if absent.

### `acquisitionTargetAt(uint256)`

```solidity
function acquisitionTargetAt(uint256 index) external view returns (address targetToken);
```

Returns a deployed acquisition target in immutable deployment order.

**Parameters**

- `index`: The zero-based deployment-order index.

**Returns**

- `targetToken`: The target-token address at the requested index.

### `acquisitionTargetCount()`

```solidity
function acquisitionTargetCount() external view returns (uint256 count);
```

Number of target tokens for which an acquisition pair has been successfully deployed.

**Returns**

- `count`: The number of deployed acquisition targets.

### `bootstrapAcquisitionTargetCount()`

```solidity
function bootstrapAcquisitionTargetCount() external view returns (uint256 arg0);
```

Acquisition-target count persisted at successful bootstrap finalization.

### `bootstrapAcquisitionTargetsHash()`

```solidity
function bootstrapAcquisitionTargetsHash() external view returns (bytes32 arg0);
```

Ordered acquisition-target hash persisted at successful bootstrap finalization.

### `canonicalBuybackBurnStrategy()`

```solidity
function canonicalBuybackBurnStrategy() external view returns (address arg0);
```

Canonical GBX buyback-and-burn strategy deployed during bootstrap.

### `canonicalBuybackDeployment()`

```solidity
function canonicalBuybackDeployment() external view returns (struct IStrategyDeployer.BuybackDeployment deployment);
```

Returns the full immutable graph and runtime provenance for the canonical buyback.

**Returns**

- `deployment`: The recorded buyback graph and runtime identity.

### `canonicalHoldUSDGRuntimeCodeHash()`

```solidity
function canonicalHoldUSDGRuntimeCodeHash() external view returns (bytes32 arg0);
```

Runtime code hash recorded for the canonical hold-USDG strategy.

### `canonicalHoldUSDGStrategy()`

```solidity
function canonicalHoldUSDGStrategy() external view returns (address arg0);
```

Canonical inert hold-USDG signal strategy deployed during bootstrap.

### `dependenciesConfigured()`

```solidity
function dependenciesConfigured() external view returns (bool arg0);
```

Whether the complete reciprocal dependency graph has been bound exactly once.

### `deployAcquisition(bytes,bytes,address,uint256,uint256,uint256)`

```solidity
function deployAcquisition(bytes strategyCreationCode, bytes rewardsCreationCode, address targetToken, uint256 minimumLotUSDG, uint256 maximumLotUSDG, uint256 initialReferenceRate) external returns (address strategy, address rewards);
```

Deploys and binds one exact acquisition/reward pair for a target token.

**Parameters**

- `initialReferenceRate`: Initial target-token-units-per-USDG auction reference rate.
- `maximumLotUSDG`: Largest USDG lot the strategy may release in one fill.
- `minimumLotUSDG`: Smallest USDG lot the strategy may release in one fill.
- `rewardsCreationCode`: Exact committed ManagerRewards compiler creation bytecode.
- `strategyCreationCode`: Exact committed AcquisitionStrategy compiler creation bytecode.
- `targetToken`: Canonical target asset for the new strategy.

**Returns**

- `rewards`: The directly deployed and reciprocally bound ManagerRewards address.
- `strategy`: The directly deployed AcquisitionStrategy address.

### `deployBuyback(bytes,uint256,uint256,uint256)`

```solidity
function deployBuyback(bytes creationCode, uint256 minimumLotUSDG, uint256 maximumLotUSDG, uint256 initialReferenceRate) external returns (address strategy);
```

Deploys the one exact buyback-and-burn implementation from committed compiler creation code.

**Parameters**

- `creationCode`: Exact committed BuybackBurnStrategy compiler creation bytecode.
- `initialReferenceRate`: Initial GBX-units-per-USDG auction reference rate.
- `maximumLotUSDG`: Largest USDG lot the strategy may release in one fill.
- `minimumLotUSDG`: Smallest USDG lot the strategy may release in one fill.

**Returns**

- `strategy`: The directly deployed canonical BuybackBurnStrategy address.

### `deployHoldUSDG(bytes)`

```solidity
function deployHoldUSDG(bytes creationCode) external returns (address strategy);
```

Deploys the one exact hold-USDG implementation from committed compiler creation code.

**Parameters**

- `creationCode`: Exact committed HoldUSDGStrategy compiler creation bytecode.

**Returns**

- `strategy`: The directly deployed canonical HoldUSDGStrategy address.

### `finalizeBootstrap(address[])`

```solidity
function finalizeBootstrap(address[] expectedAcquisitionTargets) external;
```

Seals the prelaunch deployment set after matching every reviewed target in deployment order.
This irreversible transition rejects any count, order, singleton, or dependency-graph mismatch.

**Parameters**

- `expectedAcquisitionTargets`: Exact reviewed target list in deployment order.

### `initializeDependencies(address,address,address,address)`

```solidity
function initializeDependencies(address assetRegistry, address allocationVoter, address gumBallVault, address eligibilityModule) external;
```

Closes the sole construction cycle and permanently binds the canonical protocol graph.

### `strategyBootstrapFinalized()`

```solidity
function strategyBootstrapFinalized() external view returns (bool arg0);
```

Whether the reviewed prelaunch strategy set has been permanently finalized.

### Events

#### `StrategyDeployer__AcquisitionPairDeployed(address,address,address,bytes32,bytes32)`

```solidity
event StrategyDeployer__AcquisitionPairDeployed(address indexed targetToken, address indexed strategy, address indexed managerRewards, bytes32 strategyRuntimeCodeHash, bytes32 rewardsRuntimeCodeHash);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__BootstrapFinalized(uint256,bytes32)`

```solidity
event StrategyDeployer__BootstrapFinalized(uint256 acquisitionTargetCount, bytes32 acquisitionTargetsHash);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__BuybackDeployed(address,bytes32)`

```solidity
event StrategyDeployer__BuybackDeployed(address indexed strategy, bytes32 runtimeCodeHash);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__DependenciesConfigured(address,address,address,address)`

```solidity
event StrategyDeployer__DependenciesConfigured(address indexed assetRegistry, address indexed allocationVoter, address indexed gumBallVault, address eligibilityModule);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__HoldUSDGDeployed(address,bytes32)`

```solidity
event StrategyDeployer__HoldUSDGDeployed(address indexed strategy, bytes32 runtimeCodeHash);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__AlreadyConfigured()`

```solidity
error StrategyDeployer__AlreadyConfigured();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__AlreadyDeployed(address)`

```solidity
error StrategyDeployer__AlreadyDeployed(address subject);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__BootstrapAlreadyFinalized()`

```solidity
error StrategyDeployer__BootstrapAlreadyFinalized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__BootstrapTargetCountMismatch(uint256,uint256)`

```solidity
error StrategyDeployer__BootstrapTargetCountMismatch(uint256 expected, uint256 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__BootstrapTargetMismatch(uint256,address,address)`

```solidity
error StrategyDeployer__BootstrapTargetMismatch(uint256 index, address expected, address actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__BootstrapTargetsHashMismatch(bytes32,bytes32)`

```solidity
error StrategyDeployer__BootstrapTargetsHashMismatch(bytes32 expected, bytes32 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__CreationCodeHashMismatch(bytes32,bytes32)`

```solidity
error StrategyDeployer__CreationCodeHashMismatch(bytes32 expected, bytes32 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__CreationCodeLengthMismatch(uint256,uint256)`

```solidity
error StrategyDeployer__CreationCodeLengthMismatch(uint256 expected, uint256 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__DependenciesNotConfigured()`

```solidity
error StrategyDeployer__DependenciesNotConfigured();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__DeploymentFailed()`

```solidity
error StrategyDeployer__DeploymentFailed();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__InvalidBootstrapCommitment(uint256,bytes32)`

```solidity
error StrategyDeployer__InvalidBootstrapCommitment(uint256 count, bytes32 targetsHash);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__InvalidCreationCodeHash()`

```solidity
error StrategyDeployer__InvalidCreationCodeHash();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__InvalidDependencyGraph(address)`

```solidity
error StrategyDeployer__InvalidDependencyGraph(address subject);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__NotProtocolTimelock(address)`

```solidity
error StrategyDeployer__NotProtocolTimelock(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__UnauthorizedInitializer(address)`

```solidity
error StrategyDeployer__UnauthorizedInitializer(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyDeployer__ZeroAddress()`

```solidity
error StrategyDeployer__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

## GBXToken

Source: [`src/token/GBXToken.sol`](../../packages/contracts/src/token/GBXToken.sol)

Artifact: `out/GBXToken.sol/GBXToken.json`

Public ABI: 23 functions, 6 events, 27 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(address controllerInitializer_, contract IEligibilityModule eligibilityModule_);
```

Deploys GBX with a temporary, non-minting initializer used only to assign EmissionController.
No GBX can be minted until a deployed controller is assigned. The initializer cannot replace it later.

**Parameters**

- `controllerInitializer_`: The deployment coordinator authorized to perform the one-time assignment.
- `eligibilityModule_`: An immutable eligibility module, or the zero address for permissionless mode.

### `DOMAIN_SEPARATOR()`

```solidity
function DOMAIN_SEPARATOR() external view returns (bytes32 arg0);
```

Returns the domain separator used in the encoding of the signature for {permit}, as defined by {EIP712}.

### `MAX_CUMULATIVE_MINT()`

```solidity
function MAX_CUMULATIVE_MINT() external view returns (uint256 arg0);
```

The maximum amount of GBX that may ever be minted.

### `allowance(address,address)`

```solidity
function allowance(address owner, address spender) external view returns (uint256 arg0);
```

Returns the remaining number of tokens that `spender` will be allowed to spend on behalf of `owner` through {transferFrom}. This is zero by default. This value changes when {approve} or {transferFrom} are called.

### `approve(address,uint256)`

```solidity
function approve(address spender, uint256 value) external returns (bool arg0);
```

See {IERC20-approve}. NOTE: If `value` is the maximum `uint256`, the allowance is not updated on `transferFrom`. This is semantically equivalent to an infinite approval. Requirements: - `spender` cannot be the zero address.

### `balanceOf(address)`

```solidity
function balanceOf(address account) external view returns (uint256 arg0);
```

Returns the value of tokens owned by `account`.

### `burn(uint256)`

```solidity
function burn(uint256 amount) external;
```

Burns GBX owned by the caller.

**Parameters**

- `amount`: The amount of GBX to burn.

### `burnFrom(address,uint256)`

```solidity
function burnFrom(address account, uint256 amount) external;
```

Burns GBX from an account after spending the caller's allowance.

**Parameters**

- `account`: The account whose GBX is burned.
- `amount`: The amount of GBX to burn.

### `controllerInitializer()`

```solidity
function controllerInitializer() external view returns (address arg0);
```

The deployment address permitted to assign the EmissionController once.

### `cumulativeBurned()`

```solidity
function cumulativeBurned() external view returns (uint256 arg0);
```

Returns the total amount of GBX burned over the token's lifetime.

### `cumulativeMinted()`

```solidity
function cumulativeMinted() external view returns (uint256 arg0);
```

Returns the total amount of GBX minted over the token's lifetime.

### `decimals()`

```solidity
function decimals() external view returns (uint8 arg0);
```

Returns the number of decimals used to get its user representation. For example, if `decimals` equals `2`, a balance of `505` tokens should be displayed to a user as `5.05` (`505 / 10 ** 2`). Tokens usually opt for a value of 18, imitating the relationship between Ether and Wei. This is the default value returned by this function, unless it's overridden. NOTE: This information is only used for _display_ purposes: it in no way affects any of the arithmetic of the contract, including {IERC20-balanceOf} and {IERC20-transfer}.

### `eip712Domain()`

```solidity
function eip712Domain() external view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions);
```

returns the fields and values that describe the domain separator used by this contract for EIP-712 signature.

### `eligibilityModule()`

```solidity
function eligibilityModule() external view returns (contract IEligibilityModule arg0);
```

Returns the optional immutable transfer-eligibility module.

### `emissionController()`

```solidity
function emissionController() external view returns (address arg0);
```

Returns the address authorized to mint GBX.

### `initializeEmissionController(address)`

```solidity
function initializeEmissionController(address controller) external;
```

Assigns the sole GBX minter exactly once.

**Parameters**

- `controller`: The deployed EmissionController address.

### `mint(address,uint256)`

```solidity
function mint(address receiver, uint256 amount) external;
```

Mints GBX without allowing burns to restore mint capacity.

**Parameters**

- `amount`: The amount of GBX to mint.
- `receiver`: The account receiving newly minted GBX.

### `name()`

```solidity
function name() external view returns (string arg0);
```

Returns the name of the token.

### `nonces(address)`

```solidity
function nonces(address owner) external view returns (uint256 arg0);
```

Returns the current nonce for `owner`. This value must be included whenever a signature is generated for {permit}. Every successful call to {permit} increases `owner`'s nonce by one. This prevents a signature from being used multiple times.

### `permit(address,address,uint256,uint256,uint8,bytes32,bytes32)`

```solidity
function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
```

Sets `value` as the allowance of `spender` over `owner`'s tokens, given `owner`'s signed approval. IMPORTANT: The same issues {IERC20-approve} has related to transaction ordering also applies here. Emits an {Approval} event. Requirements: - `spender` cannot be the zero address. - `deadline` must be a timestamp in the future. - `v`, `r` and `s` must be a valid `secp256k1` signature from `owner` over the EIP712-formatted function arguments. - the signature must use `owner`'s current nonce (see {nonces}). For more information on the signature format, see the https://eips.ethereum.org/EIPS/eip-2612#specification[relevant EIP section]. CAUTION: See Security Considerations above.

### `symbol()`

```solidity
function symbol() external view returns (string arg0);
```

Returns the symbol of the token, usually a shorter version of the name.

### `totalSupply()`

```solidity
function totalSupply() external view returns (uint256 arg0);
```

Returns the value of tokens in existence.

### `transfer(address,uint256)`

```solidity
function transfer(address to, uint256 value) external returns (bool arg0);
```

See {IERC20-transfer}. Requirements: - `to` cannot be the zero address. - the caller must have a balance of at least `value`.

### `transferFrom(address,address,uint256)`

```solidity
function transferFrom(address from, address to, uint256 value) external returns (bool arg0);
```

See {IERC20-transferFrom}. Skips emitting an {Approval} event indicating an allowance update. This is not required by the ERC. See {xref-ERC20-\_approve-address-address-uint256-bool-}[_approve]. NOTE: Does not update the allowance if the current allowance is the maximum `uint256`. Requirements: - `from` and `to` cannot be the zero address. - `from` must have a balance of at least `value`. - the caller must have allowance for `from`'s tokens of at least `value`.

### Events

#### `Approval(address,address,uint256)`

```solidity
event Approval(address indexed owner, address indexed spender, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EIP712DomainChanged()`

```solidity
event EIP712DomainChanged();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__Burned(address,address,uint256,uint256)`

```solidity
event GBXToken__Burned(address indexed operator, address indexed account, uint256 amount, uint256 cumulativeBurnedAfter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__EmissionControllerInitialized(address)`

```solidity
event GBXToken__EmissionControllerInitialized(address indexed controller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__Minted(address,uint256,uint256)`

```solidity
event GBXToken__Minted(address indexed receiver, uint256 amount, uint256 cumulativeMintedAfter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Transfer(address,address,uint256)`

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `ECDSAInvalidSignature()`

```solidity
error ECDSAInvalidSignature();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ECDSAInvalidSignatureLength(uint256)`

```solidity
error ECDSAInvalidSignatureLength(uint256 length);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ECDSAInvalidSignatureS(bytes32)`

```solidity
error ECDSAInvalidSignatureS(bytes32 s);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ERC20InsufficientAllowance(address,uint256,uint256)`

```solidity
error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ERC20InsufficientBalance(address,uint256,uint256)`

```solidity
error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ERC20InvalidApprover(address)`

```solidity
error ERC20InvalidApprover(address approver);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ERC20InvalidReceiver(address)`

```solidity
error ERC20InvalidReceiver(address receiver);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ERC20InvalidSender(address)`

```solidity
error ERC20InvalidSender(address sender);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ERC20InvalidSpender(address)`

```solidity
error ERC20InvalidSpender(address spender);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ERC2612ExpiredSignature(uint256)`

```solidity
error ERC2612ExpiredSignature(uint256 deadline);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ERC2612InvalidSigner(address,address)`

```solidity
error ERC2612InvalidSigner(address signer, address owner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__CumulativeMintCapExceeded(uint256,uint256)`

```solidity
error GBXToken__CumulativeMintCapExceeded(uint256 requestedAmount, uint256 remainingCapacity);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__EligibilityCheckFailed(address)`

```solidity
error GBXToken__EligibilityCheckFailed(address module);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__EligibilityModuleMustBeContract(address)`

```solidity
error GBXToken__EligibilityModuleMustBeContract(address module);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__EmissionControllerAlreadyInitialized()`

```solidity
error GBXToken__EmissionControllerAlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__EmissionControllerMustBeContract(address)`

```solidity
error GBXToken__EmissionControllerMustBeContract(address controller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__IneligibleHolder(address)`

```solidity
error GBXToken__IneligibleHolder(address account);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__IneligibleTransfer(address,address,uint256)`

```solidity
error GBXToken__IneligibleTransfer(address from, address to, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__UnauthorizedControllerInitializer(address)`

```solidity
error GBXToken__UnauthorizedControllerInitializer(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__UnauthorizedMinter(address)`

```solidity
error GBXToken__UnauthorizedMinter(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__ZeroAccount()`

```solidity
error GBXToken__ZeroAccount();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__ZeroAmount()`

```solidity
error GBXToken__ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__ZeroControllerInitializer()`

```solidity
error GBXToken__ZeroControllerInitializer();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__ZeroEmissionController()`

```solidity
error GBXToken__ZeroEmissionController();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidAccountNonce(address,uint256)`

```solidity
error InvalidAccountNonce(address account, uint256 currentNonce);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidShortString()`

```solidity
error InvalidShortString();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StringTooLong(string)`

```solidity
error StringTooLong(string str);
```

_No additional NatSpec notice is present in the compiled artifact._

## AssetRegistry

Source: [`src/vault/AssetRegistry.sol`](../../packages/contracts/src/vault/AssetRegistry.sol)

Artifact: `out/AssetRegistry.sol/AssetRegistry.json`

Public ABI: 25 functions, 6 events, 35 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address)`

```solidity
constructor(address usdG_, address protocolTimelock_, address emergencyGuardian_, address strategyDeployer_);
```

Creates the registry with immutable maintenance authorities and canonical USDG.

**Parameters**

- `emergencyGuardian_`: The stop-only authority permitted to disable acquisitions.
- `protocolTimelock_`: The purpose-limited delayed registration and maintenance authority.
- `strategyDeployer_`: The immutable exact-bytecode strategy provenance registry.
- `usdG_`: The canonical USDG asset that must be registered first.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Stop-only authority permitted to disable new acquisitions.

### `MAX_ASSETS()`

```solidity
function MAX_ASSETS() external view returns (uint256 arg0);
```

Maximum number of registered basket assets.

### `MAX_STRATEGIES()`

```solidity
function MAX_STRATEGIES() external view returns (uint256 arg0);
```

Maximum number of asset-linked plus standalone strategies.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Purpose-limited delayed registration and maintenance authority.

### `STRATEGY_DEPLOYER()`

```solidity
function STRATEGY_DEPLOYER() external view returns (contract IStrategyDeployer arg0);
```

Immutable provenance registry for exact canonical strategy deployments.

### `USDG()`

```solidity
function USDG() external view returns (address arg0);
```

Canonical USDG address that must occupy registry index zero.

### `assetAt(uint256)`

```solidity
function assetAt(uint256 index) external view returns (address arg0);
```

Returns the registered token address at a bounded index.

**Parameters**

- `index`: The zero-based asset index.

**Returns**

- `_0`: The registered token address.

### `assetCount()`

```solidity
function assetCount() external view returns (uint256 arg0);
```

Returns the number of registered assets.

**Returns**

- `_0`: The bounded asset count.

### `configFor(address)`

```solidity
function configFor(address token) external view returns (struct IAssetRegistry.AssetConfig arg0);
```

Returns the full configuration for a registered token.

**Parameters**

- `token`: The registered token address.

**Returns**

- `_0`: The asset configuration.

### `configureVault(address)`

```solidity
function configureVault(address vault_) external;
```

Configures the vault exactly once to resolve constructor-order circularity.
Must be called by the timelock before the first asset registration.

**Parameters**

- `vault_`: The deployed canonical GumBallVault contract.

### `disableAcquisition(address)`

```solidity
function disableAcquisition(address token) external;
```

Immediately disables new acquisition for a broken or halted asset.
Already-acquired balances stay registered and redeemable.

**Parameters**

- `token`: The registered asset whose acquisition strategy is disabled.

### `disableStandaloneStrategy(address)`

```solidity
function disableStandaloneStrategy(address strategy) external;
```

Immediately disables a standalone strategy such as buyback.

**Parameters**

- `strategy`: The registered non-asset strategy to disable.

### `enableAcquisition(address)`

```solidity
function enableAcquisition(address token) external;
```

Re-enables a directly deployed strategy after delayed protocol review.

**Parameters**

- `token`: The registered asset whose acquisition strategy is re-enabled.

### `enableStandaloneStrategy(address)`

```solidity
function enableStandaloneStrategy(address strategy) external;
```

Re-enables a reviewed standalone strategy through the protocol timelock.

**Parameters**

- `strategy`: The registered non-asset strategy to re-enable.

### `isLiveStrategy(address)`

```solidity
function isLiveStrategy(address strategy) external view returns (bool arg0);
```

Returns whether a directly deployed strategy is registered and acquisition-enabled.

**Parameters**

- `strategy`: The candidate strategy address.

**Returns**

- `_0`: Whether the strategy is live.

### `isRegisteredAsset(address)`

```solidity
function isRegisteredAsset(address token) external view returns (bool arg0);
```

Returns whether the address is a registered asset token.

**Parameters**

- `token`: The candidate token address.

**Returns**

- `_0`: Whether the token is registered.

### `registerAsset((address,bytes32,bytes32,uint8,address,address,bool,bool,bool))`

```solidity
function registerAsset(struct IAssetRegistry.AssetConfig config) external;
```

Registers a validated canonical token and its directly deployed strategy metadata.
The first registered token must be canonical USDG. Arrays are bounded by MAX_ASSETS.

**Parameters**

- `config`: The complete immutable identity and initial status record for the asset.

### `registerStandaloneStrategy(address)`

```solidity
function registerStandaloneStrategy(address strategy) external;
```

Registers the one canonical directly deployed buyback without adding GBX to the redemption list.

**Parameters**

- `strategy`: The canonical BuybackBurnStrategy deployed through STRATEGY_DEPLOYER.

### `registerStockAsset((address,bytes32,bytes32,uint8,address,address,bool,bool,bool),(bytes32,address,bytes32,address,bytes32,uint256))`

```solidity
function registerStockAsset(struct IAssetRegistry.AssetConfig config, struct IAssetRegistry.StockTokenDependency dependency) external;
```

Registers a stock token only while its exact reviewed beacon-proxy dependency graph is unchanged.
Every check executes atomically with registration, closing the seven-day timelock execution TOCTOU.

### `setRedemptionEnabled(address,bool)`

```solidity
function setRedemptionEnabled(address token, bool enabled) external;
```

Updates redemption metadata only when the vault has no balance of the asset.
GumBallVault still includes every registered token in pro-rata redemptions, preventing donated backing from becoming trapped. This flag is therefore an integration readiness marker rather than a pause mechanism.

**Parameters**

- `enabled`: The new integration-readiness status; it cannot disable a nonzero vault balance.
- `token`: The registered asset whose integration-readiness metadata is updated.

### `stockTokenDependencyFor(address)`

```solidity
function stockTokenDependencyFor(address token) external view returns (struct IAssetRegistry.StockTokenDependency arg0);
```

Returns the immutable registration-time beacon identity for a stock token.

**Parameters**

- `token`: The registered stock-token proxy address.

**Returns**

- `_0`: The registration-time token, beacon, implementation, and multiplier identity.

### `strategyAt(uint256)`

```solidity
function strategyAt(uint256 index) external view returns (address arg0);
```

Returns a directly deployed strategy at a bounded index.

**Parameters**

- `index`: The zero-based strategy index.

**Returns**

- `_0`: The directly deployed strategy address.

### `strategyCount()`

```solidity
function strategyCount() external view returns (uint256 arg0);
```

Returns the number of directly deployed signal strategies, including standalone buyback.

**Returns**

- `_0`: The bounded strategy count.

### `tokenForStrategy(address)`

```solidity
function tokenForStrategy(address strategy) external view returns (address token);
```

Registered target token for each asset-linked strategy, or zero for a standalone strategy.

### `vault()`

```solidity
function vault() external view returns (address arg0);
```

Canonical GumBallVault bound exactly once before asset registration.

### Events

#### `AssetRegistry__AcquisitionStatusSet(address,address,bool)`

```solidity
event AssetRegistry__AcquisitionStatusSet(address indexed token, address indexed strategy, bool enabled);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__AssetRegistered(address,address,address,bytes32,bytes32,uint8,bool,bool,bool)`

```solidity
event AssetRegistry__AssetRegistered(address indexed token, address indexed strategy, address indexed rewards, bytes32 assetId, bytes32 symbolHash, uint8 decimals, bool isStockToken, bool acquisitionEnabled, bool redemptionEnabled);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__RedemptionStatusSet(address,bool)`

```solidity
event AssetRegistry__RedemptionStatusSet(address indexed token, bool enabled);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__StandaloneStrategyRegistered(address)`

```solidity
event AssetRegistry__StandaloneStrategyRegistered(address indexed strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__StockTokenDependencyValidated(address,address,address,uint256)`

```solidity
event AssetRegistry__StockTokenDependencyValidated(address indexed token, address indexed beacon, address indexed implementation, uint256 uiMultiplier);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__VaultConfigured(address)`

```solidity
event AssetRegistry__VaultConfigured(address indexed vault);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `AssetRegistry__AlreadyRegistered(address)`

```solidity
error AssetRegistry__AlreadyRegistered(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__AssetIdRequired()`

```solidity
error AssetRegistry__AssetIdRequired();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__AssetLimitReached()`

```solidity
error AssetRegistry__AssetLimitReached();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__BeaconIdentityMismatch(address)`

```solidity
error AssetRegistry__BeaconIdentityMismatch(address beacon);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__DecimalsMismatch(address,uint8,uint8)`

```solidity
error AssetRegistry__DecimalsMismatch(address token, uint8 expected, uint8 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__DependencyCodeHashMismatch(address,bytes32,bytes32)`

```solidity
error AssetRegistry__DependencyCodeHashMismatch(address dependency, bytes32 expected, bytes32 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__FirstAssetMustBeUSDG(address)`

```solidity
error AssetRegistry__FirstAssetMustBeUSDG(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__InvalidStrategyGraph(address)`

```solidity
error AssetRegistry__InvalidStrategyGraph(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__InvalidStrategyProvenance(address)`

```solidity
error AssetRegistry__InvalidStrategyProvenance(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__NotGuardianOrTimelock(address)`

```solidity
error AssetRegistry__NotGuardianOrTimelock(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__NotProtocolTimelock(address)`

```solidity
error AssetRegistry__NotProtocolTimelock(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__RewardsNotAllowed(address)`

```solidity
error AssetRegistry__RewardsNotAllowed(address rewards);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__RewardsRequired()`

```solidity
error AssetRegistry__RewardsRequired();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__StandaloneStrategyNotCanonical(address)`

```solidity
error AssetRegistry__StandaloneStrategyNotCanonical(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__StockIdentityMismatch(address)`

```solidity
error AssetRegistry__StockIdentityMismatch(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__StockIdentityRequired(address)`

```solidity
error AssetRegistry__StockIdentityRequired(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__StockTokenPaused(address)`

```solidity
error AssetRegistry__StockTokenPaused(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__StockTransferAccountBlocked(address,address)`

```solidity
error AssetRegistry__StockTransferAccountBlocked(address token, address account);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__StrategyAlreadyRegistered(address)`

```solidity
error AssetRegistry__StrategyAlreadyRegistered(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__StrategyDecimalsMismatch(address,uint8,uint8,uint8,uint8)`

```solidity
error AssetRegistry__StrategyDecimalsMismatch(address strategy, uint8 expectedUSDG, uint8 actualUSDG, uint8 expectedSubject, uint8 actualSubject);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__StrategyHasNoCode(address)`

```solidity
error AssetRegistry__StrategyHasNoCode(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__StrategyRequired()`

```solidity
error AssetRegistry__StrategyRequired();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__SymbolCallFailed(address)`

```solidity
error AssetRegistry__SymbolCallFailed(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__SymbolCharacterInvalid(address,uint256,bytes1)`

```solidity
error AssetRegistry__SymbolCharacterInvalid(address token, uint256 index, bytes1 character);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__SymbolEncodingInvalid(address)`

```solidity
error AssetRegistry__SymbolEncodingInvalid(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__SymbolHashMismatch(address,bytes32,bytes32)`

```solidity
error AssetRegistry__SymbolHashMismatch(address token, bytes32 expected, bytes32 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__SymbolHashRequired()`

```solidity
error AssetRegistry__SymbolHashRequired();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__SymbolLengthInvalid(address,uint256)`

```solidity
error AssetRegistry__SymbolLengthInvalid(address token, uint256 length);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__TokenHasNoCode(address)`

```solidity
error AssetRegistry__TokenHasNoCode(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__UnknownAsset(address)`

```solidity
error AssetRegistry__UnknownAsset(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__VaultAlreadyConfigured(address)`

```solidity
error AssetRegistry__VaultAlreadyConfigured(address vault);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__VaultHasNoCode(address)`

```solidity
error AssetRegistry__VaultHasNoCode(address vault);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__VaultHasTokenBalance(address,uint256)`

```solidity
error AssetRegistry__VaultHasTokenBalance(address token, uint256 balance);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__VaultNotConfigured()`

```solidity
error AssetRegistry__VaultNotConfigured();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__ZeroAddress()`

```solidity
error AssetRegistry__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

## IAcquisitionRegistrationIdentity

Source: [`src/vault/AssetRegistry.sol`](../../packages/contracts/src/vault/AssetRegistry.sol)

Artifact: `out/AssetRegistry.sol/IAcquisitionRegistrationIdentity.json`

Public ABI: 4 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `TARGET_DECIMALS()`

```solidity
function TARGET_DECIMALS() external view returns (uint8 arg0);
```

Returns the target-token decimals cached by the strategy at deployment.

### `TARGET_TOKEN()`

```solidity
function TARGET_TOKEN() external view returns (address arg0);
```

Returns the acquisition strategy's immutable target token.

### `USDG_DECIMALS()`

```solidity
function USDG_DECIMALS() external view returns (uint8 arg0);
```

Returns the USDG decimals cached by the strategy at deployment.

### `managerRewards()`

```solidity
function managerRewards() external view returns (address arg0);
```

Returns the strategy-specific ManagerRewards accumulator.

## IBuybackRegistrationIdentity

Source: [`src/vault/AssetRegistry.sol`](../../packages/contracts/src/vault/AssetRegistry.sol)

Artifact: `out/AssetRegistry.sol/IBuybackRegistrationIdentity.json`

Public ABI: 2 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `GBX_DECIMALS()`

```solidity
function GBX_DECIMALS() external view returns (uint8 arg0);
```

Returns the GBX decimals cached by the buyback at deployment.

### `USDG_DECIMALS()`

```solidity
function USDG_DECIMALS() external view returns (uint8 arg0);
```

Returns the USDG decimals cached by the buyback at deployment.

## IManagerRewardsRegistrationIdentity

Source: [`src/vault/AssetRegistry.sol`](../../packages/contracts/src/vault/AssetRegistry.sol)

Artifact: `out/AssetRegistry.sol/IManagerRewardsRegistrationIdentity.json`

Public ABI: 2 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `REWARD_TOKEN()`

```solidity
function REWARD_TOKEN() external view returns (address arg0);
```

Returns the immutable token distributed by ManagerRewards.

### `STRATEGY()`

```solidity
function STRATEGY() external view returns (address arg0);
```

Returns the immutable acquisition strategy authorized to notify rewards.

## IStockTokenBeacon

Source: [`src/vault/AssetRegistry.sol`](../../packages/contracts/src/vault/AssetRegistry.sol)

Artifact: `out/AssetRegistry.sol/IStockTokenBeacon.json`

Public ABI: 3 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `implementation()`

```solidity
function implementation() external view returns (address arg0);
```

Returns the implementation currently selected by the shared stock-token beacon.

### `isBlocked(address)`

```solidity
function isBlocked(address account) external view returns (bool arg0);
```

Returns whether the issuer blocks an account from stock-token transfers.

### `paused()`

```solidity
function paused() external view returns (bool arg0);
```

Returns whether the issuer has globally paused the stock-token system.

## IStockTokenIdentity

Source: [`src/vault/AssetRegistry.sol`](../../packages/contracts/src/vault/AssetRegistry.sol)

Artifact: `out/AssetRegistry.sol/IStockTokenIdentity.json`

Public ABI: 15 functions, 2 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `ACCESS_CONTROLLED_REGISTRY()`

```solidity
function ACCESS_CONTROLLED_REGISTRY() external view returns (address arg0);
```

Returns the shared issuer access-control registry used by this proxy.

### `allowance(address,address)`

```solidity
function allowance(address owner, address spender) external view returns (uint256 arg0);
```

Returns the remaining number of tokens that `spender` will be allowed to spend on behalf of `owner` through {transferFrom}. This is zero by default. This value changes when {approve} or {transferFrom} are called.

### `approve(address,uint256)`

```solidity
function approve(address spender, uint256 value) external returns (bool arg0);
```

Sets a `value` amount of tokens as the allowance of `spender` over the caller's tokens. Returns a boolean value indicating whether the operation succeeded. IMPORTANT: Beware that changing an allowance with this method brings the risk that someone may use both the old and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards: https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729 Emits an {Approval} event.

### `balanceOf(address)`

```solidity
function balanceOf(address account) external view returns (uint256 arg0);
```

Returns the value of tokens owned by `account`.

### `decimals()`

```solidity
function decimals() external view returns (uint8 arg0);
```

Returns the decimals places of the token.

### `name()`

```solidity
function name() external view returns (string arg0);
```

Returns the name of the token.

### `oraclePaused()`

```solidity
function oraclePaused() external view returns (bool arg0);
```

Returns whether oracle-driven corporate-action updates for this token are paused.

### `paused()`

```solidity
function paused() external view returns (bool arg0);
```

Returns whether the shared issuer control plane pauses all token transfers.

### `symbol()`

```solidity
function symbol() external view returns (string arg0);
```

Returns the symbol of the token.

### `tokenPaused()`

```solidity
function tokenPaused() external view returns (bool arg0);
```

Returns whether transfers for this individual token are paused.

### `totalSupply()`

```solidity
function totalSupply() external view returns (uint256 arg0);
```

Returns the value of tokens in existence.

### `transfer(address,uint256)`

```solidity
function transfer(address to, uint256 value) external returns (bool arg0);
```

Moves a `value` amount of tokens from the caller's account to `to`. Returns a boolean value indicating whether the operation succeeded. Emits a {Transfer} event.

### `transferFrom(address,address,uint256)`

```solidity
function transferFrom(address from, address to, uint256 value) external returns (bool arg0);
```

Moves a `value` amount of tokens from `from` to `to` using the allowance mechanism. `value` is then deducted from the caller's allowance. Returns a boolean value indicating whether the operation succeeded. Emits a {Transfer} event.

### `uiMultiplier()`

```solidity
function uiMultiplier() external view returns (uint256 arg0);
```

Returns the issuer-defined 18-decimal UI multiplier.

### `uid()`

```solidity
function uid() external view returns (bytes32 arg0);
```

Returns the stock-token UID recorded by the canonical issuer registry.

### Events

#### `Approval(address,address,uint256)`

```solidity
event Approval(address indexed owner, address indexed spender, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Transfer(address,address,uint256)`

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

## GumBallVault

Source: [`src/vault/GumBallVault.sol`](../../packages/contracts/src/vault/GumBallVault.sol)

Artifact: `out/GumBallVault.sol/GumBallVault.json`

Public ABI: 8 functions, 3 events, 13 custom errors, 1 constructor, 1 receive entry, 0 fallback entries.

### `constructor(address,address,address,address,address)`

```solidity
constructor(address usdG_, address gbx_, address assetRegistry_, address allocationVoter_, address eligibilityModule_);
```

Wires immutable protocol components. None can be replaced after deployment.

**Parameters**

- `allocationVoter_`: The canonical virtual budget accountant scaled during redemption.
- `assetRegistry_`: The canonical bounded list of basket assets and live strategies.
- `eligibilityModule_`: The immutable receiver eligibility policy.
- `gbx_`: The canonical GBX claim token burned during redemption.
- `usdG_`: The canonical USDG token held as both backing and strategy budget custody.

### `receive()`

```solidity
receive() external payable;
```

Rejects normal native-ETH transfers so vault assets follow the ERC-20 redemption path.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (contract IAllocationVoter arg0);
```

Canonical virtual USDG budget accountant.

### `ASSET_REGISTRY()`

```solidity
function ASSET_REGISTRY() external view returns (contract IAssetRegistry arg0);
```

Canonical bounded basket-asset and live-strategy registry.

### `ELIGIBILITY_MODULE()`

```solidity
function ELIGIBILITY_MODULE() external view returns (contract IEligibilityModule arg0);
```

Immutable policy used to validate redemption receivers.

### `GBX()`

```solidity
function GBX() external view returns (contract IGBXToken arg0);
```

Canonical GBX burned when holders redeem their pro-rata basket claim.

### `USDG()`

```solidity
function USDG() external view returns (contract IERC20 arg0);
```

Canonical USDG held as redeemable backing and physically released for strategy fills.

### `rawBalance(address)`

```solidity
function rawBalance(address token) external view returns (uint256 balance);
```

Returns the raw vault balance of any token without treating unsupported tokens as backing.

**Parameters**

- `token`: The ERC-20 token whose physical balance is queried.

**Returns**

- `balance`: The vault's raw token balance; registry support is intentionally not inferred.

### `redeem(uint256,address)`

```solidity
function redeem(uint256 shares, address receiver) external returns (uint256[] amountsOut);
```

Burns shares and sends the receiver the same pro-rata fraction of every registered asset.
Uses total supply before burning. Locked, unclaimed, LP-held, escrowed, and wallet-held GBX all remain in the denominator. Every asset balance is snapshotted before the first external state transition.

**Parameters**

- `receiver`: The eligible account receiving every redemption asset.
- `shares`: The GBX amount to burn.

**Returns**

- `amountsOut`: The raw amount of each registered asset transferred in registry order.

### `releaseUSDG(address,uint256)`

```solidity
function releaseUSDG(address receiver, uint256 amount) external;
```

Releases budgeted USDG during a fill initiated by an approved live strategy.
The directly deployed caller is the only authority selecting the fill receiver. Its virtual budget is decremented by AllocationVoter before physical USDG leaves the vault.

**Parameters**

- `amount`: The raw USDG amount released.
- `receiver`: The fill-selected USDG receiver.

### Events

#### `GumBallVault__AssetRedeemed(address,address,uint256)`

```solidity
event GumBallVault__AssetRedeemed(address indexed receiver, address indexed asset, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallVault__Redeemed(address,address,uint256,uint256)`

```solidity
event GumBallVault__Redeemed(address indexed owner, address indexed receiver, uint256 shares, uint256 supplyBefore);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallVault__USDGReleased(address,address,uint256)`

```solidity
event GumBallVault__USDGReleased(address indexed strategy, address indexed receiver, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `GumBallVault__IneligibleReceiver(address)`

```solidity
error GumBallVault__IneligibleReceiver(address receiver);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallVault__InsufficientPhysicalUSDG(uint256,uint256)`

```solidity
error GumBallVault__InsufficientPhysicalUSDG(uint256 requested, uint256 available);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallVault__NativeETHNotAccepted()`

```solidity
error GumBallVault__NativeETHNotAccepted();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallVault__NoSupply()`

```solidity
error GumBallVault__NoSupply();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallVault__ObservedDebitMismatch(address,uint256,uint256)`

```solidity
error GumBallVault__ObservedDebitMismatch(address token, uint256 expected, uint256 observed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallVault__ObservedReceiptMismatch(address,address,uint256,uint256)`

```solidity
error GumBallVault__ObservedReceiptMismatch(address token, address receiver, uint256 expected, uint256 observed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallVault__UnauthorizedStrategy(address)`

```solidity
error GumBallVault__UnauthorizedStrategy(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallVault__ZeroAddress()`

```solidity
error GumBallVault__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallVault__ZeroAmount()`

```solidity
error GumBallVault__ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallVault__ZeroReceiver()`

```solidity
error GumBallVault__ZeroReceiver();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallVault__ZeroShares()`

```solidity
error GumBallVault__ZeroShares();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeERC20FailedOperation(address)`

```solidity
error SafeERC20FailedOperation(address token);
```

_No additional NatSpec notice is present in the compiled artifact._
