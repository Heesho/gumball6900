# Contract API reference

> Generated from Foundry artifacts by `packages/contracts/scripts/generate-contract-docs.mjs`. Do not edit by
> hand. Run `pnpm docs:generate` after changing a public Solidity surface or NatSpec.

Compiler artifact versions: `0.8.26+commit.8a97fa7a`.

Documented source surfaces: 34. Documented ABI entries: 581. Documented public ABI functions: 348.

## EmergencyGuardian

Source: [`src/access/EmergencyGuardian.sol`](../../packages/contracts/src/access/EmergencyGuardian.sol)

Artifact: `out/EmergencyGuardian.sol/EmergencyGuardian.json`

Public ABI: 11 functions, 5 events, 4 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(address operator, address targetInitializer);
```

Configures the fixed guardian operator and one-time target initializer.

### `OPERATOR()`

```solidity
function OPERATOR() external view returns (address arg0);
```

Account allowed to invoke the stop-only guardian actions.

### `TARGET_INITIALIZER()`

```solidity
function TARGET_INITIALIZER() external view returns (address arg0);
```

Deployment coordinator allowed to bind guardian targets once.

### `allocationVoter()`

```solidity
function allocationVoter() external view returns (contract IAllocationVoter arg0);
```

Allocation voter whose signal increases the guardian can pause.

### `assetRegistry()`

```solidity
function assetRegistry() external view returns (contract IAssetRegistry arg0);
```

Registry whose live strategies the guardian can disable.

### `disableStrategy(address)`

```solidity
function disableStrategy(address strategy) external;
```

Terminally disables one live strategy in both registry and voter.

### `initializeTargets(address,address,address)`

```solidity
function initializeTargets(contract IMiningPool miningPool_, contract IAllocationVoter allocationVoter_, contract IAssetRegistry assetRegistry_) external;
```

Binds the mining pool, allocation voter, and asset registry once.

### `miningPool()`

```solidity
function miningPool() external view returns (contract IMiningPool arg0);
```

Mining pool whose contributions the guardian can pause.

### `pauseMiningContributions()`

```solidity
function pauseMiningContributions() external;
```

Stops new mining contributions through the configured pool.

### `pauseSignalIncreases()`

```solidity
function pauseSignalIncreases() external;
```

Stops allocation-signal increases through the configured voter.

### `pauseStrategyFills(address)`

```solidity
function pauseStrategyFills(address strategy) external;
```

Stops fills on one currently live strategy.

### `targetsInitialized()`

```solidity
function targetsInitialized() external view returns (bool arg0);
```

Whether the three emergency targets have been bound.

### Events

#### `EmergencyGuardian__MiningPaused(address)`

```solidity
event EmergencyGuardian__MiningPaused(address indexed miningPool);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__SignalIncreasesPaused(address)`

```solidity
event EmergencyGuardian__SignalIncreasesPaused(address indexed voter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__StrategyDisabled(address)`

```solidity
event EmergencyGuardian__StrategyDisabled(address indexed strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__StrategyFillsPaused(address)`

```solidity
event EmergencyGuardian__StrategyFillsPaused(address indexed strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__TargetsInitialized(address,address,address)`

```solidity
event EmergencyGuardian__TargetsInitialized(address indexed miningPool, address indexed allocationVoter, address indexed assetRegistry);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `EmergencyGuardian__AlreadyInitialized()`

```solidity
error EmergencyGuardian__AlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__StrategyNotLive(address)`

```solidity
error EmergencyGuardian__StrategyNotLive(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__Unauthorized(address)`

```solidity
error EmergencyGuardian__Unauthorized(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmergencyGuardian__ZeroAddress()`

```solidity
error EmergencyGuardian__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

## IEmergencyAssetRegistry

Source: [`src/access/EmergencyGuardian.sol`](../../packages/contracts/src/access/EmergencyGuardian.sol)

Artifact: `out/EmergencyGuardian.sol/IEmergencyAssetRegistry.json`

Public ABI: 1 function, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `disableStrategy(address)`

```solidity
function disableStrategy(address strategy) external;
```

Irreversibly disables one registered strategy.

## IEmergencyStrategyPause

Source: [`src/access/EmergencyGuardian.sol`](../../packages/contracts/src/access/EmergencyGuardian.sol)

Artifact: `out/EmergencyGuardian.sol/IEmergencyStrategyPause.json`

Public ABI: 1 function, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `pauseFills()`

```solidity
function pauseFills() external;
```

Stops new auction fills.

## ITimelockedAssetRegistry

Source: [`src/access/ProtocolTimelock.sol`](../../packages/contracts/src/access/ProtocolTimelock.sol)

Artifact: `out/ProtocolTimelock.sol/ITimelockedAssetRegistry.json`

Public ABI: 3 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `disableStrategy(address)`

```solidity
function disableStrategy(address strategy) external;
```

Irreversibly disables one registered strategy.

### `registerAsset(address,address,address)`

```solidity
function registerAsset(address token, address strategy, address rewards) external;
```

Registers one target asset and its strategy-rewards graph.

### `registerStandaloneStrategy(address)`

```solidity
function registerStandaloneStrategy(address strategy) external;
```

Registers a strategy that does not add an asset to the basket.

## ITimelockedLiquidityCustodian

Source: [`src/access/ProtocolTimelock.sol`](../../packages/contracts/src/access/ProtocolTimelock.sol)

Artifact: `out/ProtocolTimelock.sol/ITimelockedLiquidityCustodian.json`

Public ABI: 1 function, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `transferPosition(address)`

```solidity
function transferPosition(address recipient) external;
```

Transfers the recorded position NFT to a reviewed contract.

## ITimelockedStrategy

Source: [`src/access/ProtocolTimelock.sol`](../../packages/contracts/src/access/ProtocolTimelock.sol)

Artifact: `out/ProtocolTimelock.sol/ITimelockedStrategy.json`

Public ABI: 1 function, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `resumeFills()`

```solidity
function resumeFills() external;
```

Re-enables auction fills.

## ProtocolTimelock

Source: [`src/access/ProtocolTimelock.sol`](../../packages/contracts/src/access/ProtocolTimelock.sol)

Artifact: `out/ProtocolTimelock.sol/ProtocolTimelock.json`

Public ABI: 23 functions, 6 events, 4 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address)`

```solidity
constructor(address proposer);
```

Configures the sole operation proposer.

### `DELAY()`

```solidity
function DELAY() external view returns (uint256 arg0);
```

Fixed delay applied to every typed operation.

### `PROPOSER()`

```solidity
function PROPOSER() external view returns (address arg0);
```

Account allowed to schedule typed operations.

### `executeAssetRegistration(address,address,address,address,bytes32)`

```solidity
function executeAssetRegistration(address registry, address token, address strategy, address rewards, bytes32 salt) external;
```

Executes a ready target asset and strategy-rewards registration.

### `executeEmissionControllerReplacement(address,address,bytes32)`

```solidity
function executeEmissionControllerReplacement(contract IGBXToken token, address controller, bytes32 salt) external;
```

Executes a ready GBX emission-controller replacement.

### `executeMiningResume(address,bytes32)`

```solidity
function executeMiningResume(contract IMiningPool miningPool, bytes32 salt) external;
```

Executes a ready resumption of mining contributions.

### `executePositionTransfer(address,address,bytes32)`

```solidity
function executePositionTransfer(address custodian, address recipient, bytes32 salt) external;
```

Executes a ready transfer of a custodian's recorded position NFT.

### `executeSignalResume(address,bytes32)`

```solidity
function executeSignalResume(contract IAllocationVoter voter, bytes32 salt) external;
```

Executes a ready resumption of allocation-signal increases.

### `executeStandaloneStrategyRegistration(address,address,bytes32)`

```solidity
function executeStandaloneStrategyRegistration(address registry, address strategy, bytes32 salt) external;
```

Executes a ready standalone strategy registration.

### `executeStrategyDisablement(address,address,address,bytes32)`

```solidity
function executeStrategyDisablement(address registry, contract IAllocationVoter voter, address strategy, bytes32 salt) external;
```

Executes a ready terminal strategy disablement.

### `executeStrategyResume(address,bytes32)`

```solidity
function executeStrategyResume(address strategy, bytes32 salt) external;
```

Executes a ready resumption of strategy fills.

### `executeTeamAddressUpdate(address,address,bytes32)`

```solidity
function executeTeamAddressUpdate(contract IMiningPool miningPool, address team, bytes32 salt) external;
```

Executes a ready mining team-fee receiver update.

### `hashEmissionControllerReplacement(address,address,bytes32)`

```solidity
function hashEmissionControllerReplacement(contract IGBXToken token, address controller, bytes32 salt) external view returns (bytes32 arg0);
```

Derives the chain- and timelock-bound identifier for a controller replacement.

### `hashPositionTransfer(address,address,bytes32)`

```solidity
function hashPositionTransfer(address custodian, address recipient, bytes32 salt) external view returns (bytes32 arg0);
```

Derives the chain- and timelock-bound identifier for a position transfer.

### `operationReadyAt(bytes32)`

```solidity
function operationReadyAt(bytes32 operationId) external view returns (uint64 readyAt);
```

Returns the execution timestamp for a scheduled operation identifier.

### `scheduleAssetRegistration(address,address,address,address,bytes32)`

```solidity
function scheduleAssetRegistration(address registry, address token, address strategy, address rewards, bytes32 salt) external returns (bytes32 operationId);
```

Schedules one target asset and strategy-rewards registration.

### `scheduleEmissionControllerReplacement(address,address,bytes32)`

```solidity
function scheduleEmissionControllerReplacement(contract IGBXToken token, address controller, bytes32 salt) external returns (bytes32 operationId);
```

Schedules a compatible GBX emission-controller replacement.

### `scheduleMiningResume(address,bytes32)`

```solidity
function scheduleMiningResume(contract IMiningPool miningPool, bytes32 salt) external returns (bytes32 operationId);
```

Schedules resumption of mining contributions.

### `schedulePositionTransfer(address,address,bytes32)`

```solidity
function schedulePositionTransfer(address custodian, address recipient, bytes32 salt) external returns (bytes32 operationId);
```

Schedules transfer of a custodian's recorded position NFT.

### `scheduleSignalResume(address,bytes32)`

```solidity
function scheduleSignalResume(contract IAllocationVoter voter, bytes32 salt) external returns (bytes32 operationId);
```

Schedules resumption of allocation-signal increases.

### `scheduleStandaloneStrategyRegistration(address,address,bytes32)`

```solidity
function scheduleStandaloneStrategyRegistration(address registry, address strategy, bytes32 salt) external returns (bytes32 operationId);
```

Schedules one standalone strategy registration.

### `scheduleStrategyDisablement(address,address,address,bytes32)`

```solidity
function scheduleStrategyDisablement(address registry, contract IAllocationVoter voter, address strategy, bytes32 salt) external returns (bytes32 operationId);
```

Schedules terminal disablement of one strategy in registry and voter.

### `scheduleStrategyResume(address,bytes32)`

```solidity
function scheduleStrategyResume(address strategy, bytes32 salt) external returns (bytes32 operationId);
```

Schedules resumption of fills for one strategy.

### `scheduleTeamAddressUpdate(address,address,bytes32)`

```solidity
function scheduleTeamAddressUpdate(contract IMiningPool miningPool, address team, bytes32 salt) external returns (bytes32 operationId);
```

Schedules an update to the optional mining team-fee receiver.

### Events

#### `ProtocolTimelock__ControllerReplacementExecuted(bytes32,address,address)`

```solidity
event ProtocolTimelock__ControllerReplacementExecuted(bytes32 indexed operationId, address indexed token, address indexed controller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__ControllerReplacementScheduled(bytes32,address,address,uint256)`

```solidity
event ProtocolTimelock__ControllerReplacementScheduled(bytes32 indexed operationId, address indexed token, address indexed controller, uint256 readyAt);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__OperationExecuted(bytes32,uint8)`

```solidity
event ProtocolTimelock__OperationExecuted(bytes32 indexed operationId, enum ProtocolTimelock.Action indexed action);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__OperationScheduled(bytes32,uint8,uint256)`

```solidity
event ProtocolTimelock__OperationScheduled(bytes32 indexed operationId, enum ProtocolTimelock.Action indexed action, uint256 readyAt);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__PositionTransferExecuted(bytes32,address,address)`

```solidity
event ProtocolTimelock__PositionTransferExecuted(bytes32 indexed operationId, address indexed custodian, address indexed recipient);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProtocolTimelock__PositionTransferScheduled(bytes32,address,address,uint256)`

```solidity
event ProtocolTimelock__PositionTransferScheduled(bytes32 indexed operationId, address indexed custodian, address indexed recipient, uint256 readyAt);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `ProtocolTimelock__AlreadyScheduled(bytes32)`

```solidity
error ProtocolTimelock__AlreadyScheduled(bytes32 operationId);
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

#### `ProtocolTimelock__Unauthorized(address)`

```solidity
error ProtocolTimelock__Unauthorized(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

## IAllocationVoter

Source: [`src/interfaces/IAllocationVoter.sol`](../../packages/contracts/src/interfaces/IAllocationVoter.sol)

Artifact: `out/IAllocationVoter.sol/IAllocationVoter.json`

Public ABI: 10 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `consumeStrategyBudget(address,uint256)`

```solidity
function consumeStrategyBudget(address strategy, uint256 amount) external;
```

Consumes USDG budget assigned to a live strategy.

### `disableStrategy(address)`

```solidity
function disableStrategy(address strategy) external;
```

Terminally removes a registry-disabled strategy from allocation.

### `notifyRevenue(uint256)`

```solidity
function notifyRevenue(uint256 amount) external;
```

Accounts newly deposited USDG revenue for signal allocation.

### `pauseSignalIncreases()`

```solidity
function pauseSignalIncreases() external;
```

Stops signal-weight increases while preserving reductions and exits.

### `previewStrategyBudget(address)`

```solidity
function previewStrategyBudget(address strategy) external view returns (uint256 arg0);
```

Previews the strategy's currently accrued USDG budget.

### `resumeSignalIncreases()`

```solidity
function resumeSignalIncreases() external;
```

Re-enables signal-weight increases.

### `scaleBudgetsAfterRedemption(uint256,uint256)`

```solidity
function scaleBudgetsAfterRedemption(uint256 shares, uint256 supplyBefore) external;
```

Scales all accounted budgets after an in-kind GBX redemption.

### `strategyWeight(address)`

```solidity
function strategyWeight(address strategy) external view returns (uint256 arg0);
```

Returns the active signal weight assigned to a strategy.

### `totalActiveWeight()`

```solidity
function totalActiveWeight() external view returns (uint256 arg0);
```

Returns the aggregate active signal weight.

### `usedWeight(address)`

```solidity
function usedWeight(address user) external view returns (uint256 arg0);
```

Returns the user's total active signal weight.

## IAssetRegistry

Source: [`src/interfaces/IAssetRegistry.sol`](../../packages/contracts/src/interfaces/IAssetRegistry.sol)

Artifact: `out/IAssetRegistry.sol/IAssetRegistry.json`

Public ABI: 10 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `MAX_ASSETS()`

```solidity
function MAX_ASSETS() external view returns (uint256 arg0);
```

Returns the maximum number of registered redeemable assets.

### `assetAt(uint256)`

```solidity
function assetAt(uint256 index) external view returns (address arg0);
```

Returns the registered asset at an index.

### `assetCount()`

```solidity
function assetCount() external view returns (uint256 arg0);
```

Returns the number of registered redeemable assets.

### `configFor(address)`

```solidity
function configFor(address token) external view returns (struct IAssetRegistry.AssetConfig arg0);
```

Returns the immutable configuration for a registered asset.

### `isLiveStrategy(address)`

```solidity
function isLiveStrategy(address strategy) external view returns (bool arg0);
```

Returns whether a strategy is registered and not disabled.

### `isRegisteredAsset(address)`

```solidity
function isRegisteredAsset(address token) external view returns (bool arg0);
```

Returns whether a token belongs to the redeemable basket.

### `rewardsForStrategy(address)`

```solidity
function rewardsForStrategy(address strategy) external view returns (address arg0);
```

Returns the rewards contract associated with a strategy, if any.

### `strategyAt(uint256)`

```solidity
function strategyAt(uint256 index) external view returns (address arg0);
```

Returns the registered strategy at an index.

### `strategyCount()`

```solidity
function strategyCount() external view returns (uint256 arg0);
```

Returns the number of registered strategies.

### `tokenForStrategy(address)`

```solidity
function tokenForStrategy(address strategy) external view returns (address arg0);
```

Returns the redeemable token associated with a strategy, if any.

## IClaimsSource

Source: [`src/interfaces/IClaimsSource.sol`](../../packages/contracts/src/interfaces/IClaimsSource.sol)

Artifact: `out/IClaimsSource.sol/IClaimsSource.json`

Public ABI: 1 function, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `claimData(uint256,address)`

```solidity
function claimData(uint256 epochId, address beneficiary) external view returns (uint256 entitlement, uint256 totalAllocation, bool settled);
```

Returns one beneficiary's settled epoch entitlement and total allocation.

## IEmissionController

Source: [`src/interfaces/IEmissionController.sol`](../../packages/contracts/src/interfaces/IEmissionController.sol)

Artifact: `out/IEmissionController.sol/IEmissionController.json`

Public ABI: 8 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `INITIAL_DAILY_SCHEDULED_EMISSION()`

```solidity
function INITIAL_DAILY_SCHEDULED_EMISSION() external view returns (uint256 arg0);
```

Returns the canonical first daily scheduled emission.

### `currentScheduledEmission()`

```solidity
function currentScheduledEmission() external view returns (uint256 arg0);
```

Returns the scheduled emission for the next epoch.

### `gbx()`

```solidity
function gbx() external view returns (contract IGBXToken arg0);
```

Returns the GBX token controlled by this scheduler.

### `miningPool()`

```solidity
function miningPool() external view returns (address arg0);
```

Returns the mining pool authorized to settle epochs.

### `nextMiningEpochId()`

```solidity
function nextMiningEpochId() external view returns (uint256 arg0);
```

Returns the next epoch identifier accepted for settlement.

### `remainingMintCapacity()`

```solidity
function remainingMintCapacity() external view returns (uint256 arg0);
```

Returns GBX's remaining lifetime mint capacity.

### `scheduledEmission(uint256)`

```solidity
function scheduledEmission(uint256 epochId) external view returns (uint256 arg0);
```

Returns the canonical scheduled emission at an epoch index.

### `settleMiningEpoch(uint256,address,bool)`

```solidity
function settleMiningEpoch(uint256 epochId, address claimsReceiver, bool nonEmpty) external returns (uint256 emission);
```

Settles one sequential mining epoch and mints only when it is nonempty.

## IGBXToken

Source: [`src/interfaces/IGBXToken.sol`](../../packages/contracts/src/interfaces/IGBXToken.sol)

Artifact: `out/IGBXToken.sol/IGBXToken.json`

Public ABI: 18 functions, 2 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `GENESIS_LIQUIDITY_ALLOCATION()`

```solidity
function GENESIS_LIQUIDITY_ALLOCATION() external view returns (uint256 arg0);
```

Returns the fixed genesis-liquidity allocation.

### `MAX_CUMULATIVE_MINT()`

```solidity
function MAX_CUMULATIVE_MINT() external view returns (uint256 arg0);
```

Returns the one-billion-token lifetime mint ceiling.

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

### `burnFrom(address,uint256)`

```solidity
function burnFrom(address account, uint256 amount) external;
```

Burns approved GBX from an account.

### `canonicalMiningPool()`

```solidity
function canonicalMiningPool() external view returns (address arg0);
```

Returns the mining pool pinned by the initial controller binding.

### `cumulativeBurned()`

```solidity
function cumulativeBurned() external view returns (uint256 arg0);
```

Returns all GBX burned over the token's lifetime.

### `cumulativeMinted()`

```solidity
function cumulativeMinted() external view returns (uint256 arg0);
```

Returns all GBX minted over the token's lifetime.

### `emissionController()`

```solidity
function emissionController() external view returns (address arg0);
```

Returns the currently authorized mining controller.

### `initializeEmissionController(address)`

```solidity
function initializeEmissionController(address controller) external;
```

Binds the initial emission controller once.

### `mintMiningEmission(address,uint256)`

```solidity
function mintMiningEmission(address receiver, uint256 amount) external;
```

Mints a mining emission through the current controller.

### `remainingMintCapacity()`

```solidity
function remainingMintCapacity() external view returns (uint256 arg0);
```

Returns the remaining lifetime mint capacity.

### `replaceEmissionController(address)`

```solidity
function replaceEmissionController(address controller) external;
```

Replaces the emission controller through the protocol timelock.

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

## IGumBallVault

Source: [`src/interfaces/IGumBallVault.sol`](../../packages/contracts/src/interfaces/IGumBallVault.sol)

Artifact: `out/IGumBallVault.sol/IGumBallVault.json`

Public ABI: 2 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `redeem(uint256,address)`

```solidity
function redeem(uint256 shares, address receiver) external returns (uint256[] amounts);
```

Burns GBX and returns its raw fraction of each basket asset.

### `releaseUSDG(address,uint256)`

```solidity
function releaseUSDG(address receiver, uint256 amount) external;
```

Releases allocated USDG for the calling live strategy.

## IMiningClaims

Source: [`src/interfaces/IMiningClaims.sol`](../../packages/contracts/src/interfaces/IMiningClaims.sol)

Artifact: `out/IMiningClaims.sol/IMiningClaims.json`

Public ABI: 3 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `claim(address,uint256)`

```solidity
function claim(address beneficiary, uint256 epochId) external returns (uint256 amount);
```

Pays one beneficiary's unclaimed settled epoch entitlement.

### `initializeSource(address)`

```solidity
function initializeSource(address source) external;
```

Binds the claims data source once.

### `previewClaim(address,uint256)`

```solidity
function previewClaim(address beneficiary, uint256 epochId) external view returns (uint256 amount);
```

Previews one beneficiary's currently claimable epoch entitlement.

## IMiningPool

Source: [`src/interfaces/IMiningPool.sol`](../../packages/contracts/src/interfaces/IMiningPool.sol)

Artifact: `out/IMiningPool.sol/IMiningPool.json`

Public ABI: 4 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `pauseContributions()`

```solidity
function pauseContributions() external;
```

Stops new contributions without blocking settlement or claims.

### `resumeContributions()`

```solidity
function resumeContributions() external;
```

Re-enables new contributions.

### `setTeamAddress(address)`

```solidity
function setTeamAddress(address team) external;
```

Updates the optional team-fee receiver.

### `start()`

```solidity
function start() external;
```

Starts epoch zero after deployment invariants are satisfied.

## IStrategyRewards

Source: [`src/interfaces/IStrategyRewards.sol`](../../packages/contracts/src/interfaces/IStrategyRewards.sol)

Artifact: `out/IStrategyRewards.sol/IStrategyRewards.json`

Public ABI: 5 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `REWARD_TOKEN()`

```solidity
function REWARD_TOKEN() external view returns (address arg0);
```

Returns the token distributed as rewards.

### `STRATEGY()`

```solidity
function STRATEGY() external view returns (address arg0);
```

Returns the strategy authorized to notify rewards.

### `notifyReward(uint256)`

```solidity
function notifyReward(uint256 amount) external;
```

Accounts rewards already transferred into the rewards contract.

### `setWeight(address,uint256)`

```solidity
function setWeight(address user, uint256 newWeight) external;
```

Replaces one user's reward weight.

### `totalWeight()`

```solidity
function totalWeight() external view returns (uint256 arg0);
```

Returns the aggregate active reward weight.

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

## LiquidityCustodian

Source: [`src/liquidity/LiquidityCustodian.sol`](../../packages/contracts/src/liquidity/LiquidityCustodian.sol)

Artifact: `out/LiquidityCustodian.sol/LiquidityCustodian.json`

Public ABI: 20 functions, 3 events, 16 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor((address,address,uint256,address,address,address,address,address),(address,address,uint24,int24,address))`

```solidity
constructor(struct LiquidityCustodian.Dependencies dependencies, struct PoolKey canonicalPoolKey);
```

Configures the sole accepted v4 position and its fixed protocol dependencies.

**Parameters**

- `canonicalPoolKey`: Exact hookless GBX/USDG pool identity accepted for the one position.
- `dependencies`: Fixed protocol contracts and assets.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (contract IAllocationVoter arg0);
```

Allocation ledger notified only after the vault receives USDG.

### `CURRENCY0()`

```solidity
function CURRENCY0() external view returns (address arg0);
```

Lower-address token in the canonical v4 pool.

### `CURRENCY1()`

```solidity
function CURRENCY1() external view returns (address arg0);
```

Higher-address token in the canonical v4 pool.

### `EXPECTED_POSITION_TOKEN_ID()`

```solidity
function EXPECTED_POSITION_TOKEN_ID() external view returns (uint256 arg0);
```

Precommitted PositionManager token ID for the genesis position.

### `GBX()`

```solidity
function GBX() external view returns (contract IGBXToken arg0);
```

Canonical GBX token whose collected fees are burned.

### `GUM_BALL_VAULT()`

```solidity
function GUM_BALL_VAULT() external view returns (address arg0);
```

Passive protocol vault receiving collected USDG.

### `POOL_FEE()`

```solidity
function POOL_FEE() external view returns (uint24 arg0);
```

Fee tier of the canonical v4 pool.

### `POOL_KEY_HASH()`

```solidity
function POOL_KEY_HASH() external view returns (bytes32 arg0);
```

Hash of the complete canonical hookless pool key.

### `POSITION_DEPOSITOR()`

```solidity
function POSITION_DEPOSITOR() external view returns (address arg0);
```

Reviewed one-time account allowed to deliver the genesis position.

### `POSITION_MANAGER()`

```solidity
function POSITION_MANAGER() external view returns (contract IPositionManager arg0);
```

Canonical Uniswap v4 position NFT contract.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Purpose-limited timelock authorized to transfer the exact recorded position.

### `TICK_SPACING()`

```solidity
function TICK_SPACING() external view returns (int24 arg0);
```

Tick spacing of the canonical v4 pool.

### `USDG()`

```solidity
function USDG() external view returns (contract IERC20 arg0);
```

Canonical USDG token whose collected fees are deposited into the vault.

### `collectFees()`

```solidity
function collectFees() external returns (uint256 gbxBurned, uint256 usdGToVault);
```

Collects fees without removing liquidity, burns GBX, and deposits USDG before voter notification.

**Returns**

- `gbxBurned`: Collected GBX irreversibly burned by this call.
- `usdGToVault`: Collected USDG actually received by GumBallVault and notified to AllocationVoter.

### `onERC721Received(address,address,uint256,bytes)`

```solidity
function onERC721Received(address arg0, address from, uint256 tokenId, bytes arg3) external returns (bytes4 arg0);
```

Records the first and only canonical PositionManager NFT received by safe transfer.

### `poolKey()`

```solidity
function poolKey() external view returns (struct PoolKey arg0);
```

Returns the immutable canonical hookless pool identity.

### `positionInCustody()`

```solidity
function positionInCustody() external view returns (bool arg0);
```

Returns whether the exact recorded position currently remains owned by this custodian.

### `positionRecorded()`

```solidity
function positionRecorded() external view returns (bool arg0);
```

Whether the reviewed deployment transfer has recorded the canonical position.

### `positionTokenId()`

```solidity
function positionTokenId() external view returns (uint256 arg0);
```

The sole canonical PositionManager token ID accepted by this custodian.

### `transferPosition(address)`

```solidity
function transferPosition(address recipient) external;
```

Transfers only the recorded canonical NFT to a deployed replacement contract through ProtocolTimelock.

**Parameters**

- `recipient`: Reviewed replacement custodian or migration contract receiving the canonical position.

### Events

#### `LiquidityCustodian__FeesCollected(uint256,address,uint256,uint256)`

```solidity
event LiquidityCustodian__FeesCollected(uint256 indexed positionId, address indexed caller, uint256 gbxBurned, uint256 usdGToVault);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityCustodian__PositionRecorded(uint256,address,bytes32)`

```solidity
event LiquidityCustodian__PositionRecorded(uint256 indexed positionId, address indexed previousOwner, bytes32 indexed poolKeyHash);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityCustodian__PositionTransferred(uint256,address)`

```solidity
event LiquidityCustodian__PositionTransferred(uint256 indexed positionId, address indexed recipient);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `LiquidityCustodian__AddressHasNoCode(address)`

```solidity
error LiquidityCustodian__AddressHasNoCode(address account);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityCustodian__InexactUSDGTransfer(uint256,uint256,uint256)`

```solidity
error LiquidityCustodian__InexactUSDGTransfer(uint256 expected, uint256 debit, uint256 receipt);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityCustodian__InvalidPoolCurrencies(address,address)`

```solidity
error LiquidityCustodian__InvalidPoolCurrencies(address currency0, address currency1);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityCustodian__InvalidPoolKey(bytes32,bytes32)`

```solidity
error LiquidityCustodian__InvalidPoolKey(bytes32 expected, bytes32 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityCustodian__NoPositionRecorded()`

```solidity
error LiquidityCustodian__NoPositionRecorded();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityCustodian__NonzeroHook(address)`

```solidity
error LiquidityCustodian__NonzeroHook(address hook);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityCustodian__NotProtocolTimelock(address)`

```solidity
error LiquidityCustodian__NotProtocolTimelock(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityCustodian__PositionAlreadyRecorded(uint256)`

```solidity
error LiquidityCustodian__PositionAlreadyRecorded(uint256 positionId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityCustodian__PositionNotInCustody(uint256)`

```solidity
error LiquidityCustodian__PositionNotInCustody(uint256 positionId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityCustodian__PositionNotOwned(uint256,address)`

```solidity
error LiquidityCustodian__PositionNotOwned(uint256 positionId, address owner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityCustodian__UnexpectedNFTSender(address)`

```solidity
error LiquidityCustodian__UnexpectedNFTSender(address sender);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityCustodian__UnexpectedPositionDepositor(address)`

```solidity
error LiquidityCustodian__UnexpectedPositionDepositor(address depositor);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityCustodian__UnexpectedPositionTokenId(uint256,uint256)`

```solidity
error LiquidityCustodian__UnexpectedPositionTokenId(uint256 expected, uint256 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LiquidityCustodian__ZeroAddress()`

```solidity
error LiquidityCustodian__ZeroAddress();
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

## EmissionController

Source: [`src/mining/EmissionController.sol`](../../packages/contracts/src/mining/EmissionController.sol)

Artifact: `out/EmissionController.sol/EmissionController.json`

Public ABI: 8 functions, 1 event, 5 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,uint256,uint256)`

```solidity
constructor(contract IGBXToken gbx_, address miningPool_, uint256 nextEpochId_, uint256 scheduledEmission_);
```

Configures a sequential scheduler at an explicit epoch and emission checkpoint.

**Parameters**

- `gbx_`: Canonical token whose currently authorized controller may mint.
- `miningPool_`: Only caller allowed to settle an epoch.
- `nextEpochId_`: Next epoch expected by this controller (zero for the initial controller).
- `scheduledEmission_`: Scheduled amount for nextEpochId\_ (canonical initial amount for initial deployment).

### `INITIAL_DAILY_SCHEDULED_EMISSION()`

```solidity
function INITIAL_DAILY_SCHEDULED_EMISSION() external view returns (uint256 arg0);
```

Canonical first scheduled daily emission for the 980M post-genesis allocation.

### `currentScheduledEmission()`

```solidity
function currentScheduledEmission() external view returns (uint256 arg0);
```

Scheduled emission for the next epoch.

### `gbx()`

```solidity
function gbx() external view returns (contract IGBXToken arg0);
```

Canonical GBX token whose current controller may mint.

### `miningPool()`

```solidity
function miningPool() external view returns (address arg0);
```

Mining pool exclusively authorized to settle epochs.

### `nextMiningEpochId()`

```solidity
function nextMiningEpochId() external view returns (uint256 arg0);
```

Next sequential epoch identifier accepted for settlement.

### `remainingMintCapacity()`

```solidity
function remainingMintCapacity() external view returns (uint256 arg0);
```

Returns GBX's remaining lifetime mint capacity.

### `scheduledEmission(uint256)`

```solidity
function scheduledEmission(uint256 epochId) external pure returns (uint256 arg0);
```

Returns the canonical floor-rounded scheduled emission for an epoch index.

### `settleMiningEpoch(uint256,address,bool)`

```solidity
function settleMiningEpoch(uint256 epochId, address claimsReceiver, bool nonEmpty) external returns (uint256 emission);
```

Advances exactly one daily schedule step and mints the complete available amount iff nonempty.

### Events

#### `EmissionController__MiningEpochSettled(uint256,address,bool,uint256,uint256,uint256)`

```solidity
event EmissionController__MiningEpochSettled(uint256 indexed epochId, address indexed claimsReceiver, bool nonEmpty, uint256 emission, uint256 scheduledEmission, uint256 nextScheduledEmission);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `EmissionController__ControllerMismatch(address)`

```solidity
error EmissionController__ControllerMismatch(address configuredController);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__InvalidConfiguration()`

```solidity
error EmissionController__InvalidConfiguration();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__Unauthorized(address)`

```solidity
error EmissionController__Unauthorized(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__UnexpectedEpoch(uint256,uint256)`

```solidity
error EmissionController__UnexpectedEpoch(uint256 expected, uint256 provided);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionController__ZeroReceiver()`

```solidity
error EmissionController__ZeroReceiver();
```

_No additional NatSpec notice is present in the compiled artifact._

## MiningClaims

Source: [`src/mining/MiningClaims.sol`](../../packages/contracts/src/mining/MiningClaims.sol)

Artifact: `out/MiningClaims.sol/MiningClaims.json`

Public ABI: 7 functions, 2 events, 8 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(contract IGBXToken gbx, address sourceInitializer);
```

Configures the GBX escrow token and one-time source initializer.

### `GBX()`

```solidity
function GBX() external view returns (contract IGBXToken arg0);
```

GBX token escrowed for settled mining claims.

### `SOURCE_INITIALIZER()`

```solidity
function SOURCE_INITIALIZER() external view returns (address arg0);
```

Deployment coordinator allowed to bind the claims source once.

### `claim(address,uint256)`

```solidity
function claim(address beneficiary, uint256 epochId) external returns (uint256 amount);
```

Permissionlessly pays one beneficiary's unclaimed settled epoch entitlement.

### `hasClaimed(uint256,address)`

```solidity
function hasClaimed(uint256 epochId, address beneficiary) external view returns (bool claimed);
```

Returns whether a beneficiary has claimed a settled epoch.

### `initializeSource(address)`

```solidity
function initializeSource(address source_) external;
```

Binds the mining claims data source once.

### `previewClaim(address,uint256)`

```solidity
function previewClaim(address beneficiary, uint256 epochId) external view returns (uint256 amount);
```

Returns one beneficiary's currently claimable epoch entitlement.

### `source()`

```solidity
function source() external view returns (contract IClaimsSource arg0);
```

Bound source of beneficiary epoch entitlements.

### Events

#### `MiningClaims__Claimed(uint256,address,address,uint256)`

```solidity
event MiningClaims__Claimed(uint256 indexed epochId, address indexed beneficiary, address indexed caller, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningClaims__SourceInitialized(address)`

```solidity
event MiningClaims__SourceInitialized(address indexed source);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `MiningClaims__AlreadyClaimed(uint256,address)`

```solidity
error MiningClaims__AlreadyClaimed(uint256 epochId, address beneficiary);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningClaims__AlreadyInitialized()`

```solidity
error MiningClaims__AlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningClaims__NoClaim(uint256,address)`

```solidity
error MiningClaims__NoClaim(uint256 epochId, address beneficiary);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningClaims__NotSettled(uint256)`

```solidity
error MiningClaims__NotSettled(uint256 epochId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningClaims__Unauthorized(address)`

```solidity
error MiningClaims__Unauthorized(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningClaims__ZeroAddress()`

```solidity
error MiningClaims__ZeroAddress();
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

## ILiquidityCustodianStatus

Source: [`src/mining/MiningPool.sol`](../../packages/contracts/src/mining/MiningPool.sol)

Artifact: `out/MiningPool.sol/ILiquidityCustodianStatus.json`

Public ABI: 1 function, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `positionInCustody()`

```solidity
function positionInCustody() external view returns (bool arg0);
```

Returns whether the canonical position remains held by its custodian.

## MiningPool

Source: [`src/mining/MiningPool.sol`](../../packages/contracts/src/mining/MiningPool.sol)

Artifact: `out/MiningPool.sol/MiningPool.json`

Public ABI: 25 functions, 5 events, 16 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,address,address,address,address,address,address)`

```solidity
constructor(address usdG, address gumBallVault, contract IAllocationVoter allocationVoter, contract IGBXToken gbx, contract IMiningClaims miningClaims, address liquidityCustodian, address emergencyGuardian, address protocolTimelock, address startInitializer, address team);
```

Configures the fixed mining, custody, access-control, and revenue dependencies.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (contract IAllocationVoter arg0);
```

Allocation ledger notified of deposited vault revenue.

### `BPS_DENOMINATOR()`

```solidity
function BPS_DENOMINATOR() external view returns (uint256 arg0);
```

Basis-point denominator used for the team fee.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Stop-only guardian allowed to pause contributions.

### `EPOCH_DURATION()`

```solidity
function EPOCH_DURATION() external view returns (uint256 arg0);
```

Fixed duration of each mining epoch.

### `GBX()`

```solidity
function GBX() external view returns (contract IGBXToken arg0);
```

Lifetime-capped token emitted for nonempty epochs.

### `GUM_BALL_VAULT()`

```solidity
function GUM_BALL_VAULT() external view returns (address arg0);
```

Passive vault receiving net contribution revenue.

### `LIQUIDITY_CUSTODIAN()`

```solidity
function LIQUIDITY_CUSTODIAN() external view returns (contract ILiquidityCustodianStatus arg0);
```

Custodian whose canonical position must exist before mining starts.

### `MINING_CLAIMS()`

```solidity
function MINING_CLAIMS() external view returns (contract IMiningClaims arg0);
```

Escrow receiving minted epoch emissions for beneficiary claims.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Timelock allowed to resume contributions and update the team receiver.

### `START_INITIALIZER()`

```solidity
function START_INITIALIZER() external view returns (address arg0);
```

Deployment coordinator allowed to start epoch zero once.

### `TEAM_FEE_BPS()`

```solidity
function TEAM_FEE_BPS() external view returns (uint256 arg0);
```

Optional team fee in basis points.

### `USDG()`

```solidity
function USDG() external view returns (contract IERC20 arg0);
```

Contribution and revenue token.

### `claimData(uint256,address)`

```solidity
function claimData(uint256 epochId, address beneficiary) external view returns (uint256 entitlement, uint256 totalAllocation, bool settled);
```

Returns a beneficiary's settled pro-rata emission entitlement for an epoch.

### `contribute(address,uint256)`

```solidity
function contribute(address beneficiary, uint256 requestedAmount) external returns (uint256 receivedAmount);
```

Attributes a nonzero USDG contribution to a beneficiary in the active epoch.

### `contributionOf(uint256,address)`

```solidity
function contributionOf(uint256 epochId, address beneficiary) external view returns (uint256 amount);
```

Returns a beneficiary's attributed USDG contribution in an epoch.

### `contributionsPaused()`

```solidity
function contributionsPaused() external view returns (bool arg0);
```

Whether new contributions are paused.

### `currentEpochId()`

```solidity
function currentEpochId() external view returns (uint256 arg0);
```

Identifier of the active contribution epoch.

### `epochs(uint256)`

```solidity
function epochs(uint256 epochId) external view returns (uint64 startTime, uint64 endTime, uint64 settledAt, uint256 totalContributed, uint256 teamFee, uint256 vaultRevenue, uint256 emission, bool settled);
```

Returns stored accounting and settlement data for an epoch.

### `pauseContributions()`

```solidity
function pauseContributions() external;
```

Stops new contributions without blocking settlement or claims.

### `resumeContributions()`

```solidity
function resumeContributions() external;
```

Re-enables new contributions through the protocol timelock.

### `setTeamAddress(address)`

```solidity
function setTeamAddress(address team) external;
```

Updates the optional team-fee receiver through the protocol timelock.

### `settleCurrentEpoch()`

```solidity
function settleCurrentEpoch() external returns (uint256 emission);
```

Permissionlessly settles one ended epoch; empty epochs advance without minting or carry.

### `start()`

```solidity
function start() external;
```

Starts epoch zero only after the canonical NFT is held and the controller is bound.

### `started()`

```solidity
function started() external view returns (bool arg0);
```

Whether epoch zero has been started.

### `teamAddress()`

```solidity
function teamAddress() external view returns (address arg0);
```

Optional receiver of the fixed team fee.

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

#### `MiningPool__EpochSettled(uint256,uint256,uint256,uint256,uint256)`

```solidity
event MiningPool__EpochSettled(uint256 indexed epochId, uint256 totalContributed, uint256 teamFee, uint256 vaultRevenue, uint256 emission);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__MiningStarted(uint256,uint256,uint256)`

```solidity
event MiningPool__MiningStarted(uint256 indexed epochId, uint256 startTime, uint256 endTime);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__TeamAddressSet(address,address)`

```solidity
event MiningPool__TeamAddressSet(address indexed previousTeam, address indexed newTeam);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `MiningPool__AlreadyStarted()`

```solidity
error MiningPool__AlreadyStarted();
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

#### `MiningPool__EmissionsExhausted()`

```solidity
error MiningPool__EmissionsExhausted();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__EpochNotEnded(uint256,uint256)`

```solidity
error MiningPool__EpochNotEnded(uint256 epochId, uint256 endTime);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__InexactTransfer(address,uint256,uint256,uint256)`

```solidity
error MiningPool__InexactTransfer(address token, uint256 expected, uint256 debit, uint256 receipt);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__InvalidConfiguration()`

```solidity
error MiningPool__InvalidConfiguration();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__MiningNotStarted()`

```solidity
error MiningPool__MiningNotStarted();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__ObservedReceiptMismatch(uint256,uint256)`

```solidity
error MiningPool__ObservedReceiptMismatch(uint256 expected, uint256 observed);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__PositionNotInCustody()`

```solidity
error MiningPool__PositionNotInCustody();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningPool__Unauthorized(address)`

```solidity
error MiningPool__Unauthorized(address caller);
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

## StrategyRewards

Source: [`src/rewards/StrategyRewards.sol`](../../packages/contracts/src/rewards/StrategyRewards.sol)

Artifact: `out/StrategyRewards.sol/StrategyRewards.json`

Public ABI: 16 functions, 3 events, 10 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address)`

```solidity
constructor(address rewardToken, address allocationVoter, address strategyInitializer);
```

Configures the reward token, allocation voter, and one-time strategy initializer.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (address arg0);
```

Allocation voter exclusively authorized to update user weights.

### `REWARD_PRECISION()`

```solidity
function REWARD_PRECISION() external view returns (uint256 arg0);
```

Fixed-point precision used by the reward-per-weight index.

### `REWARD_TOKEN()`

```solidity
function REWARD_TOKEN() external view returns (address arg0);
```

Token distributed by this rewards index.

### `STRATEGY()`

```solidity
function STRATEGY() external view returns (address arg0);
```

Strategy exclusively authorized to notify funded rewards.

### `STRATEGY_INITIALIZER()`

```solidity
function STRATEGY_INITIALIZER() external view returns (address arg0);
```

Deployment coordinator allowed to bind the strategy once.

### `accountedRewards()`

```solidity
function accountedRewards() external view returns (uint256 arg0);
```

Total funded rewards not yet paid to beneficiaries.

### `accrued(address)`

```solidity
function accrued(address user) external view returns (uint256 amount);
```

Returns a user's checkpointed unpaid rewards.

### `claim(address)`

```solidity
function claim(address beneficiary) external returns (uint256 amount);
```

Permissionlessly pays a beneficiary to that same beneficiary address.

### `earned(address)`

```solidity
function earned(address user) external view returns (uint256 arg0);
```

Returns a user's checkpointed plus newly indexed unpaid rewards.

### `initializeStrategy(address)`

```solidity
function initializeStrategy(address strategy) external;
```

Binds the sole strategy allowed to notify rewards.

### `notifyReward(uint256)`

```solidity
function notifyReward(uint256 amount) external;
```

Accounts a nonzero reward amount already held by this contract.

### `rewardPerWeightPaid(address)`

```solidity
function rewardPerWeightPaid(address user) external view returns (uint256 index);
```

Returns the reward index last checkpointed for a user.

### `rewardPerWeightStored()`

```solidity
function rewardPerWeightStored() external view returns (uint256 arg0);
```

Cumulative reward per unit of supporter weight.

### `setWeight(address,uint256)`

```solidity
function setWeight(address user, uint256 newWeight) external;
```

Checkpoints and replaces one user's active reward weight.

### `totalWeight()`

```solidity
function totalWeight() external view returns (uint256 arg0);
```

Aggregate supporter weight last synchronized while the strategy was live.

### `weightOf(address)`

```solidity
function weightOf(address user) external view returns (uint256 weight);
```

Returns one user's last synchronized reward weight, including a terminal disabled-strategy snapshot.

### Events

#### `StrategyRewards__Claimed(address,address,uint256)`

```solidity
event StrategyRewards__Claimed(address indexed beneficiary, address indexed caller, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyRewards__RewardNotified(uint256,uint256)`

```solidity
event StrategyRewards__RewardNotified(uint256 amount, uint256 rewardPerWeightAfter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyRewards__WeightSet(address,uint256,uint256)`

```solidity
event StrategyRewards__WeightSet(address indexed user, uint256 previousWeight, uint256 newWeight);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

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

#### `StrategyRewards__AlreadyInitialized()`

```solidity
error StrategyRewards__AlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyRewards__InexactTransfer(uint256,uint256,uint256)`

```solidity
error StrategyRewards__InexactTransfer(uint256 expected, uint256 debit, uint256 receipt);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyRewards__InsufficientFunding(uint256,uint256)`

```solidity
error StrategyRewards__InsufficientFunding(uint256 required, uint256 balance);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyRewards__NoReward(address)`

```solidity
error StrategyRewards__NoReward(address beneficiary);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyRewards__Unauthorized(address)`

```solidity
error StrategyRewards__Unauthorized(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyRewards__ZeroAddress()`

```solidity
error StrategyRewards__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyRewards__ZeroAmount()`

```solidity
error StrategyRewards__ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyRewards__ZeroWeight()`

```solidity
error StrategyRewards__ZeroWeight();
```

_No additional NatSpec notice is present in the compiled artifact._

## AllocationVoter

Source: [`src/signal/AllocationVoter.sol`](../../packages/contracts/src/signal/AllocationVoter.sol)

Artifact: `out/AllocationVoter.sol/AllocationVoter.json`

Public ABI: 35 functions, 9 events, 14 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,address)`

```solidity
constructor(address usdG, contract IAssetRegistry assetRegistry, address protocolTimelock, address emergencyGuardian, address dependencyInitializer);
```

Configures the registry, access-control roles, token, and one-time dependency initializer.

### `ASSET_REGISTRY()`

```solidity
function ASSET_REGISTRY() external view returns (contract IAssetRegistry arg0);
```

Registry defining the bounded live strategy set.

### `DEPENDENCY_INITIALIZER()`

```solidity
function DEPENDENCY_INITIALIZER() external view returns (address arg0);
```

Deployment coordinator allowed to bind circular dependencies once.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Stop-only guardian allowed to pause increases and disable strategies.

### `INDEX_PRECISION()`

```solidity
function INDEX_PRECISION() external view returns (uint256 arg0);
```

Fixed-point precision used by the global revenue index.

### `MAX_USER_STRATEGIES()`

```solidity
function MAX_USER_STRATEGIES() external view returns (uint256 arg0);
```

Maximum simultaneous strategy signals maintained by one user.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Timelock allowed to resume signals and terminally disable strategies.

### `USDG()`

```solidity
function USDG() external view returns (contract IERC20 arg0);
```

Vault revenue token used only for physical-backing checks.

### `accountedVaultUSDG()`

```solidity
function accountedVaultUSDG() external view returns (uint256 arg0);
```

Total vault USDG currently represented by budgets and idle backing.

### `activeStrategies(address)`

```solidity
function activeStrategies(address user) external view returns (address[] arg0);
```

Returns the strategies currently carrying nonzero signal entries for a user.

### `checkpointStrategyBudget(address)`

```solidity
function checkpointStrategyBudget(address strategy) external returns (uint256 budget);
```

Checkpoints and returns one strategy's current USDG budget.

### `consumeStrategyBudget(address,uint256)`

```solidity
function consumeStrategyBudget(address strategy, uint256 amount) external;
```

Debits already accrued USDG budget for the calling vault and strategy.

### `dependenciesInitialized()`

```solidity
function dependenciesInitialized() external view returns (bool arg0);
```

Whether all circular dependencies have been bound.

### `disableStrategy(address)`

```solidity
function disableStrategy(address strategy) external;
```

Removes a registry-disabled strategy from future revenue and strands its budget as idle backing.

### `globalRevenueIndex()`

```solidity
function globalRevenueIndex() external view returns (uint256 arg0);
```

Cumulative USDG revenue index per unit of active weight.

### `idleUSDG()`

```solidity
function idleUSDG() external view returns (uint256 arg0);
```

Accounted vault USDG not assigned to active strategy weight.

### `initializeDependencies(address,address,address,address)`

```solidity
function initializeDependencies(address vault_, address stakedGBX_, address miningPool_, address liquidityCustodian_) external;
```

Binds the vault, staked token, mining pool, and liquidity custodian once.

### `liquidityCustodian()`

```solidity
function liquidityCustodian() external view returns (address arg0);
```

Liquidity custodian authorized to notify deposited fee revenue.

### `miningPool()`

```solidity
function miningPool() external view returns (address arg0);
```

Mining pool authorized to notify deposited revenue.

### `notifyRevenue(uint256)`

```solidity
function notifyRevenue(uint256 amount) external;
```

Accounts newly deposited vault USDG across active strategy weight.

### `pauseSignalIncreases()`

```solidity
function pauseSignalIncreases() external;
```

Stops signal increases while preserving reductions, resets, and unstaking exits.

### `previewStrategyBudget(address)`

```solidity
function previewStrategyBudget(address strategy) external view returns (uint256 budget);
```

Previews one strategy's checkpointed and newly indexed USDG budget.

### `resetSignals()`

```solidity
function resetSignals() external;
```

Clears the caller's complete strategy allocation immediately.

### `resumeSignalIncreases()`

```solidity
function resumeSignalIncreases() external;
```

Re-enables signal increases through the protocol timelock.

### `scaleBudgetsAfterRedemption(uint256,uint256)`

```solidity
function scaleBudgetsAfterRedemption(uint256 shares, uint256 supplyBefore) external;
```

Scales all accounted USDG after an in-kind redemption reduces vault balances.

### `signal(address[],uint256[])`

```solidity
function signal(address[] strategies, uint256[] weights) external;
```

Replaces the caller's complete absolute strategy-weight allocation immediately.

### `signalIncreasesPaused()`

```solidity
function signalIncreasesPaused() external view returns (bool arg0);
```

Whether signal-weight increases are paused.

### `stakedGBX()`

```solidity
function stakedGBX() external view returns (address arg0);
```

Non-transferable staked GBX token that bounds user signals.

### `strategyBudget(address)`

```solidity
function strategyBudget(address strategy) external view returns (uint256 budget);
```

Returns a strategy's checkpointed unconsumed USDG budget.

### `strategyDisabled(address)`

```solidity
function strategyDisabled(address strategy) external view returns (bool disabled);
```

Returns whether a strategy has been terminally disabled in this ledger.

### `strategyIndex(address)`

```solidity
function strategyIndex(address strategy) external view returns (uint256 index);
```

Returns the global revenue index last checkpointed for a strategy.

### `strategyWeight(address)`

```solidity
function strategyWeight(address strategy) external view returns (uint256 weight);
```

Returns the active aggregate signal weight assigned to a strategy.

### `totalActiveWeight()`

```solidity
function totalActiveWeight() external view returns (uint256 arg0);
```

Aggregate active signal weight across all live strategies.

### `usedWeight(address)`

```solidity
function usedWeight(address user) external view returns (uint256 weight);
```

Returns one user's aggregate active signal weight.

### `userWeight(address,address)`

```solidity
function userWeight(address user, address strategy) external view returns (uint256 weight);
```

Returns one user's signal weight assigned to a strategy.

### `vault()`

```solidity
function vault() external view returns (address arg0);
```

Passive vault that physically custodies allocated USDG.

### Events

#### `AllocationVoter__DependenciesInitialized(address,address,address,address)`

```solidity
event AllocationVoter__DependenciesInitialized(address indexed vault, address indexed stakedGBX, address indexed miningPool, address liquidityCustodian);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__RevenueNotified(address,uint256,uint256)`

```solidity
event AllocationVoter__RevenueNotified(address indexed source, uint256 amount, uint256 indexDelta);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__SignalIncreasesPauseSet(bool)`

```solidity
event AllocationVoter__SignalIncreasesPauseSet(bool paused);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__SignalsReset(address)`

```solidity
event AllocationVoter__SignalsReset(address indexed user);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__SignalsSet(address,uint256)`

```solidity
event AllocationVoter__SignalsSet(address indexed user, uint256 totalWeight);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__StrategyBudgetConsumed(address,uint256,uint256)`

```solidity
event AllocationVoter__StrategyBudgetConsumed(address indexed strategy, uint256 amount, uint256 remaining);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__StrategyBudgetScaled(address,uint256)`

```solidity
event AllocationVoter__StrategyBudgetScaled(address indexed strategy, uint256 budgetAfter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__StrategyDisabled(address,uint256)`

```solidity
event AllocationVoter__StrategyDisabled(address indexed strategy, uint256 strandedBudget);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__StrategyWeightSet(address,uint256,uint256)`

```solidity
event AllocationVoter__StrategyWeightSet(address indexed strategy, uint256 previousWeight, uint256 newWeight);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `AllocationVoter__AlreadyInitialized()`

```solidity
error AllocationVoter__AlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__DuplicateStrategy(address)`

```solidity
error AllocationVoter__DuplicateStrategy(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__InsolventNotification(uint256,uint256)`

```solidity
error AllocationVoter__InsolventNotification(uint256 accountedAfter, uint256 physicalBalance);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__InvalidArrayLength()`

```solidity
error AllocationVoter__InvalidArrayLength();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__NotInitialized()`

```solidity
error AllocationVoter__NotInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__SignalIncreasePaused(address)`

```solidity
error AllocationVoter__SignalIncreasePaused(address strategy);
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

#### `AllocationVoter__Unauthorized(address)`

```solidity
error AllocationVoter__Unauthorized(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__UnregisteredStrategy(address)`

```solidity
error AllocationVoter__UnregisteredStrategy(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AllocationVoter__WeightExceedsStake(uint256,uint256)`

```solidity
error AllocationVoter__WeightExceedsStake(uint256 requested, uint256 balance);
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

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

## StakedGBX

Source: [`src/signal/StakedGBX.sol`](../../packages/contracts/src/signal/StakedGBX.sol)

Artifact: `out/StakedGBX.sol/StakedGBX.json`

Public ABI: 13 functions, 4 events, 13 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(contract IGBXToken gbx, contract IAllocationVoter allocationVoter);
```

Configures the underlying GBX token and allocation voter.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (contract IAllocationVoter arg0);
```

Signal ledger that must report zero used weight before unstaking.

### `GBX()`

```solidity
function GBX() external view returns (contract IGBXToken arg0);
```

Canonical GBX token held one-for-one behind sGBX.

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
function stake(uint256 amount) external;
```

Deposits GBX and mints equal non-transferable signal weight.

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

### `unstake(uint256)`

```solidity
function unstake(uint256 amount) external;
```

Burns signal weight and returns equal GBX after all signals are reset.

### Events

#### `Approval(address,address,uint256)`

```solidity
event Approval(address indexed owner, address indexed spender, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StakedGBX__Staked(address,uint256)`

```solidity
event StakedGBX__Staked(address indexed user, uint256 amount);
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

#### `StakedGBX__InexactTransfer(uint256,uint256,uint256)`

```solidity
error StakedGBX__InexactTransfer(uint256 expected, uint256 debit, uint256 receipt);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StakedGBX__NonTransferable()`

```solidity
error StakedGBX__NonTransferable();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StakedGBX__SignalsNotReset(uint256)`

```solidity
error StakedGBX__SignalsNotReset(uint256 usedWeight);
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

## AcquisitionStrategy

Source: [`src/strategies/AcquisitionStrategy.sol`](../../packages/contracts/src/strategies/AcquisitionStrategy.sol)

Artifact: `out/AcquisitionStrategy.sol/AcquisitionStrategy.json`

Public ABI: 29 functions, 2 events, 18 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,address,address,address,uint256,uint256,uint256,uint256,uint256)`

```solidity
constructor(address usdG, address targetToken, contract IGumBallVault gumBallVault, contract IAssetRegistry assetRegistry, contract IStrategyRewards strategyRewards, address emergencyGuardian, address protocolTimelock, uint256 usdGLot, uint256 initPrice_, uint256 epochPeriod_, uint256 priceMultiplier_, uint256 minInitPrice_);
```

Configures one fixed-lot acquisition strategy for later registry-authorized activation.

### `ABS_MAX_INIT_PRICE()`

```solidity
function ABS_MAX_INIT_PRICE() external view returns (uint256 arg0);
```

Absolute maximum permitted initial price.

### `ABS_MIN_INIT_PRICE()`

```solidity
function ABS_MIN_INIT_PRICE() external view returns (uint256 arg0);
```

Absolute minimum permitted price floor.

### `ASSET_REGISTRY()`

```solidity
function ASSET_REGISTRY() external view returns (contract IAssetRegistry arg0);
```

Registry that must keep this strategy live for fills.

### `BPS_DENOMINATOR()`

```solidity
function BPS_DENOMINATOR() external view returns (uint256 arg0);
```

Basis-point denominator used for the supporter reward split.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Stop-only guardian allowed to pause fills.

### `GUM_BALL_VAULT()`

```solidity
function GUM_BALL_VAULT() external view returns (contract IGumBallVault arg0);
```

Passive vault receiving acquired tokens and releasing USDG lots.

### `MAX_EPOCH_PERIOD()`

```solidity
function MAX_EPOCH_PERIOD() external view returns (uint256 arg0);
```

Largest permitted auction duration.

### `MAX_PRICE_MULTIPLIER()`

```solidity
function MAX_PRICE_MULTIPLIER() external view returns (uint256 arg0);
```

Largest permitted next-price multiplier.

### `MIN_EPOCH_PERIOD()`

```solidity
function MIN_EPOCH_PERIOD() external view returns (uint256 arg0);
```

Smallest permitted auction duration.

### `MIN_PRICE_MULTIPLIER()`

```solidity
function MIN_PRICE_MULTIPLIER() external view returns (uint256 arg0);
```

Smallest permitted next-price multiplier.

### `PRECISION()`

```solidity
function PRECISION() external view returns (uint256 arg0);
```

Fixed-point denominator used for the next-price multiplier.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Timelock allowed to resume fills.

### `REWARD_BPS()`

```solidity
function REWARD_BPS() external view returns (uint256 arg0);
```

Active-supporter share of each observed target-token payment.

### `STRATEGY_REWARDS()`

```solidity
function STRATEGY_REWARDS() external view returns (contract IStrategyRewards arg0);
```

Reward index receiving the supporter share when it has weight.

### `TARGET_TOKEN()`

```solidity
function TARGET_TOKEN() external view returns (address arg0);
```

Standard ERC20 acquired by this strategy.

### `USDG()`

```solidity
function USDG() external view returns (contract IERC20 arg0);
```

Token released from the vault as each fixed acquisition lot.

### `USDG_LOT()`

```solidity
function USDG_LOT() external view returns (uint256 arg0);
```

Fixed USDG amount released for every successful fill.

### `activateAuction()`

```solidity
function activateAuction() external;
```

Starts the first auction exactly once, atomically with typed asset registration.

### `epochId()`

```solidity
function epochId() external view returns (uint256 arg0);
```

Identifier of the active auction epoch.

### `epochPeriod()`

```solidity
function epochPeriod() external view returns (uint256 arg0);
```

Fixed duration of each auction epoch.

### `fill(uint256,uint256,uint256)`

```solidity
function fill(uint256 expectedEpochId, uint256 deadline, uint256 maxTargetAmount) external returns (uint256 paymentAmount, uint256 observedPayment);
```

Pays the exact target-token quote first, splits it, then releases the fixed USDG lot.

### `fillsPaused()`

```solidity
function fillsPaused() external view returns (bool arg0);
```

Whether new fills are paused.

### `getPrice()`

```solidity
function getPrice() external view returns (uint256 arg0);
```

Exact give.fun order: branch only after E; arithmetic itself yields zero at E.

### `initPrice()`

```solidity
function initPrice() external view returns (uint256 arg0);
```

Starting price of the active auction epoch.

### `minInitPrice()`

```solidity
function minInitPrice() external view returns (uint256 arg0);
```

Configured lower bound for each next initial price.

### `pauseFills()`

```solidity
function pauseFills() external;
```

Stops new fills through the emergency guardian.

### `priceMultiplier()`

```solidity
function priceMultiplier() external view returns (uint256 arg0);
```

Fixed multiplier applied to a filled epoch's quoted payment.

### `resumeFills()`

```solidity
function resumeFills() external;
```

Re-enables fills through the protocol timelock.

### `startTime()`

```solidity
function startTime() external view returns (uint256 arg0);
```

Timestamp at which the active auction epoch began.

### Events

#### `AcquisitionStrategy__Filled(uint256,address,uint256,uint256,uint256,uint256,uint256)`

```solidity
event AcquisitionStrategy__Filled(uint256 indexed epochId, address indexed filler, uint256 quotedPayment, uint256 observedPayment, uint256 vaultAmount, uint256 rewardAmount, uint256 usdGLot);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__FillsPauseSet(bool)`

```solidity
event AcquisitionStrategy__FillsPauseSet(bool paused);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `AcquisitionStrategy__FillsPaused()`

```solidity
error AcquisitionStrategy__FillsPaused();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__InexactTransfer(address,uint256,uint256,uint256)`

```solidity
error AcquisitionStrategy__InexactTransfer(address token, uint256 expected, uint256 debit, uint256 receipt);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__InvalidConfiguration()`

```solidity
error AcquisitionStrategy__InvalidConfiguration();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__StrategyNotLive()`

```solidity
error AcquisitionStrategy__StrategyNotLive();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__Unauthorized(address)`

```solidity
error AcquisitionStrategy__Unauthorized(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__ZeroAddress()`

```solidity
error AcquisitionStrategy__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AcquisitionStrategy__ZeroAmount()`

```solidity
error AcquisitionStrategy__ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__AlreadyActivated()`

```solidity
error AuctionEngine__AlreadyActivated();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__DeadlinePassed()`

```solidity
error AuctionEngine__DeadlinePassed();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__EpochIdMismatch()`

```solidity
error AuctionEngine__EpochIdMismatch();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__EpochPeriodOutOfRange()`

```solidity
error AuctionEngine__EpochPeriodOutOfRange();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__InitPriceOutOfRange()`

```solidity
error AuctionEngine__InitPriceOutOfRange();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__MaxPaymentAmountExceeded()`

```solidity
error AuctionEngine__MaxPaymentAmountExceeded();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__MinInitPriceOutOfRange()`

```solidity
error AuctionEngine__MinInitPriceOutOfRange();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__NotActivated()`

```solidity
error AuctionEngine__NotActivated();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__PriceMultiplierOutOfRange()`

```solidity
error AuctionEngine__PriceMultiplierOutOfRange();
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

## AuctionEngine

Source: [`src/strategies/AuctionEngine.sol`](../../packages/contracts/src/strategies/AuctionEngine.sol)

Artifact: `out/AuctionEngine.sol/AuctionEngine.json`

Public ABI: 14 functions, 0 events, 9 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `ABS_MAX_INIT_PRICE()`

```solidity
function ABS_MAX_INIT_PRICE() external view returns (uint256 arg0);
```

Absolute maximum permitted initial price.

### `ABS_MIN_INIT_PRICE()`

```solidity
function ABS_MIN_INIT_PRICE() external view returns (uint256 arg0);
```

Absolute minimum permitted price floor.

### `MAX_EPOCH_PERIOD()`

```solidity
function MAX_EPOCH_PERIOD() external view returns (uint256 arg0);
```

Largest permitted auction duration.

### `MAX_PRICE_MULTIPLIER()`

```solidity
function MAX_PRICE_MULTIPLIER() external view returns (uint256 arg0);
```

Largest permitted next-price multiplier.

### `MIN_EPOCH_PERIOD()`

```solidity
function MIN_EPOCH_PERIOD() external view returns (uint256 arg0);
```

Smallest permitted auction duration.

### `MIN_PRICE_MULTIPLIER()`

```solidity
function MIN_PRICE_MULTIPLIER() external view returns (uint256 arg0);
```

Smallest permitted next-price multiplier.

### `PRECISION()`

```solidity
function PRECISION() external view returns (uint256 arg0);
```

Fixed-point denominator used for the next-price multiplier.

### `epochId()`

```solidity
function epochId() external view returns (uint256 arg0);
```

Identifier of the active auction epoch.

### `epochPeriod()`

```solidity
function epochPeriod() external view returns (uint256 arg0);
```

Fixed duration of each auction epoch.

### `getPrice()`

```solidity
function getPrice() external view returns (uint256 arg0);
```

Exact give.fun order: branch only after E; arithmetic itself yields zero at E.

### `initPrice()`

```solidity
function initPrice() external view returns (uint256 arg0);
```

Starting price of the active auction epoch.

### `minInitPrice()`

```solidity
function minInitPrice() external view returns (uint256 arg0);
```

Configured lower bound for each next initial price.

### `priceMultiplier()`

```solidity
function priceMultiplier() external view returns (uint256 arg0);
```

Fixed multiplier applied to a filled epoch's quoted payment.

### `startTime()`

```solidity
function startTime() external view returns (uint256 arg0);
```

Timestamp at which the active auction epoch began.

### Custom errors

#### `AuctionEngine__AlreadyActivated()`

```solidity
error AuctionEngine__AlreadyActivated();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__DeadlinePassed()`

```solidity
error AuctionEngine__DeadlinePassed();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__EpochIdMismatch()`

```solidity
error AuctionEngine__EpochIdMismatch();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__EpochPeriodOutOfRange()`

```solidity
error AuctionEngine__EpochPeriodOutOfRange();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__InitPriceOutOfRange()`

```solidity
error AuctionEngine__InitPriceOutOfRange();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__MaxPaymentAmountExceeded()`

```solidity
error AuctionEngine__MaxPaymentAmountExceeded();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__MinInitPriceOutOfRange()`

```solidity
error AuctionEngine__MinInitPriceOutOfRange();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__NotActivated()`

```solidity
error AuctionEngine__NotActivated();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__PriceMultiplierOutOfRange()`

```solidity
error AuctionEngine__PriceMultiplierOutOfRange();
```

_No additional NatSpec notice is present in the compiled artifact._

## BuybackStrategy

Source: [`src/strategies/BuybackStrategy.sol`](../../packages/contracts/src/strategies/BuybackStrategy.sol)

Artifact: `out/BuybackStrategy.sol/BuybackStrategy.json`

Public ABI: 26 functions, 2 events, 18 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,address,address,uint256,uint256,uint256,uint256,uint256)`

```solidity
constructor(contract IGBXToken gbx, address usdG, contract IGumBallVault gumBallVault, contract IAssetRegistry assetRegistry, address emergencyGuardian, address protocolTimelock, uint256 usdGLot, uint256 initPrice_, uint256 epochPeriod_, uint256 priceMultiplier_, uint256 minInitPrice_);
```

Configures one fixed-lot buyback strategy for later registry-authorized activation.

### `ABS_MAX_INIT_PRICE()`

```solidity
function ABS_MAX_INIT_PRICE() external view returns (uint256 arg0);
```

Absolute maximum permitted initial price.

### `ABS_MIN_INIT_PRICE()`

```solidity
function ABS_MIN_INIT_PRICE() external view returns (uint256 arg0);
```

Absolute minimum permitted price floor.

### `ASSET_REGISTRY()`

```solidity
function ASSET_REGISTRY() external view returns (contract IAssetRegistry arg0);
```

Registry that must keep this strategy live for fills.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Stop-only guardian allowed to pause fills.

### `GBX()`

```solidity
function GBX() external view returns (contract IGBXToken arg0);
```

Canonical token collected and burned by successful fills.

### `GUM_BALL_VAULT()`

```solidity
function GUM_BALL_VAULT() external view returns (contract IGumBallVault arg0);
```

Passive vault releasing allocated USDG lots.

### `MAX_EPOCH_PERIOD()`

```solidity
function MAX_EPOCH_PERIOD() external view returns (uint256 arg0);
```

Largest permitted auction duration.

### `MAX_PRICE_MULTIPLIER()`

```solidity
function MAX_PRICE_MULTIPLIER() external view returns (uint256 arg0);
```

Largest permitted next-price multiplier.

### `MIN_EPOCH_PERIOD()`

```solidity
function MIN_EPOCH_PERIOD() external view returns (uint256 arg0);
```

Smallest permitted auction duration.

### `MIN_PRICE_MULTIPLIER()`

```solidity
function MIN_PRICE_MULTIPLIER() external view returns (uint256 arg0);
```

Smallest permitted next-price multiplier.

### `PRECISION()`

```solidity
function PRECISION() external view returns (uint256 arg0);
```

Fixed-point denominator used for the next-price multiplier.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Timelock allowed to resume fills.

### `USDG()`

```solidity
function USDG() external view returns (contract IERC20 arg0);
```

Token released from the vault as each fixed buyback lot.

### `USDG_LOT()`

```solidity
function USDG_LOT() external view returns (uint256 arg0);
```

Fixed USDG amount released for every successful fill.

### `activateAuction()`

```solidity
function activateAuction() external;
```

Starts the first auction exactly once, atomically with typed standalone registration.

### `epochId()`

```solidity
function epochId() external view returns (uint256 arg0);
```

Identifier of the active auction epoch.

### `epochPeriod()`

```solidity
function epochPeriod() external view returns (uint256 arg0);
```

Fixed duration of each auction epoch.

### `fill(uint256,uint256,uint256)`

```solidity
function fill(uint256 expectedEpochId, uint256 deadline, uint256 maxGBXAmount) external returns (uint256 paymentAmount, uint256 gbxBurned);
```

Collects and burns GBX, releases one USDG lot, and advances the auction.

### `fillsPaused()`

```solidity
function fillsPaused() external view returns (bool arg0);
```

Whether new fills are paused.

### `getPrice()`

```solidity
function getPrice() external view returns (uint256 arg0);
```

Exact give.fun order: branch only after E; arithmetic itself yields zero at E.

### `initPrice()`

```solidity
function initPrice() external view returns (uint256 arg0);
```

Starting price of the active auction epoch.

### `minInitPrice()`

```solidity
function minInitPrice() external view returns (uint256 arg0);
```

Configured lower bound for each next initial price.

### `pauseFills()`

```solidity
function pauseFills() external;
```

Stops new fills through the emergency guardian.

### `priceMultiplier()`

```solidity
function priceMultiplier() external view returns (uint256 arg0);
```

Fixed multiplier applied to a filled epoch's quoted payment.

### `resumeFills()`

```solidity
function resumeFills() external;
```

Re-enables fills through the protocol timelock.

### `startTime()`

```solidity
function startTime() external view returns (uint256 arg0);
```

Timestamp at which the active auction epoch began.

### Events

#### `BuybackStrategy__Filled(uint256,address,uint256,uint256,uint256)`

```solidity
event BuybackStrategy__Filled(uint256 indexed epochId, address indexed filler, uint256 quotedPayment, uint256 gbxBurned, uint256 usdGLot);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackStrategy__FillsPauseSet(bool)`

```solidity
event BuybackStrategy__FillsPauseSet(bool paused);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `AuctionEngine__AlreadyActivated()`

```solidity
error AuctionEngine__AlreadyActivated();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__DeadlinePassed()`

```solidity
error AuctionEngine__DeadlinePassed();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__EpochIdMismatch()`

```solidity
error AuctionEngine__EpochIdMismatch();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__EpochPeriodOutOfRange()`

```solidity
error AuctionEngine__EpochPeriodOutOfRange();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__InitPriceOutOfRange()`

```solidity
error AuctionEngine__InitPriceOutOfRange();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__MaxPaymentAmountExceeded()`

```solidity
error AuctionEngine__MaxPaymentAmountExceeded();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__MinInitPriceOutOfRange()`

```solidity
error AuctionEngine__MinInitPriceOutOfRange();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__NotActivated()`

```solidity
error AuctionEngine__NotActivated();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AuctionEngine__PriceMultiplierOutOfRange()`

```solidity
error AuctionEngine__PriceMultiplierOutOfRange();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackStrategy__FillsPaused()`

```solidity
error BuybackStrategy__FillsPaused();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackStrategy__InexactTransfer(address,uint256,uint256,uint256)`

```solidity
error BuybackStrategy__InexactTransfer(address token, uint256 expected, uint256 debit, uint256 receipt);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackStrategy__InvalidConfiguration()`

```solidity
error BuybackStrategy__InvalidConfiguration();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackStrategy__StrategyNotLive()`

```solidity
error BuybackStrategy__StrategyNotLive();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackStrategy__Unauthorized(address)`

```solidity
error BuybackStrategy__Unauthorized(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackStrategy__ZeroAddress()`

```solidity
error BuybackStrategy__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BuybackStrategy__ZeroAmount()`

```solidity
error BuybackStrategy__ZeroAmount();
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

## GBXToken

Source: [`src/token/GBXToken.sol`](../../packages/contracts/src/token/GBXToken.sol)

Artifact: `out/GBXToken.sol/GBXToken.json`

Public ABI: 23 functions, 6 events, 12 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address)`

```solidity
constructor(address genesisRecipient, address controllerInitializer, address protocolTimelock);
```

Configures access control and mints the fixed 20M genesis allocation.

**Parameters**

- `controllerInitializer`: Deployment coordinator allowed only to bind the first controller.
- `genesisRecipient`: Receiver of the one-time 20M genesis-liquidity allocation.
- `protocolTimelock`: Purpose-limited timelock allowed to replace the controller after seven-day scheduling.

### `CONTROLLER_INITIALIZER()`

```solidity
function CONTROLLER_INITIALIZER() external view returns (address arg0);
```

Deployment coordinator allowed only to bind the first emission controller.

### `GENESIS_LIQUIDITY_ALLOCATION()`

```solidity
function GENESIS_LIQUIDITY_ALLOCATION() external view returns (uint256 arg0);
```

Fixed one-time allocation minted for genesis liquidity.

### `MAX_CUMULATIVE_MINT()`

```solidity
function MAX_CUMULATIVE_MINT() external view returns (uint256 arg0);
```

Irreversible one-billion-token lifetime mint ceiling.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Purpose-limited timelock allowed to replace the emission controller.

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

Burns a nonzero amount of the caller's GBX.

### `burnFrom(address,uint256)`

```solidity
function burnFrom(address account, uint256 amount) external;
```

Burns a nonzero approved amount of GBX from an account.

### `canonicalMiningPool()`

```solidity
function canonicalMiningPool() external view returns (address arg0);
```

Mining pool permanently anchored by the initial controller binding.

### `cumulativeBurned()`

```solidity
function cumulativeBurned() external view returns (uint256 arg0);
```

Total GBX burned over the token's lifetime.

### `cumulativeMinted()`

```solidity
function cumulativeMinted() external view returns (uint256 arg0);
```

Total GBX minted over the token's lifetime, including burned units.

### `decimals()`

```solidity
function decimals() external view returns (uint8 arg0);
```

Returns the number of decimals used to get its user representation. For example, if `decimals` equals `2`, a balance of `505` tokens should be displayed to a user as `5.05` (`505 / 10 ** 2`). Tokens usually opt for a value of 18, imitating the relationship between Ether and Wei. This is the default value returned by this function, unless it's overridden. NOTE: This information is only used for _display_ purposes: it in no way affects any of the arithmetic of the contract, including {IERC20-balanceOf} and {IERC20-transfer}.

### `emissionController()`

```solidity
function emissionController() external view returns (address arg0);
```

Currently authorized mining emission controller.

### `initializeEmissionController(address)`

```solidity
function initializeEmissionController(address controller) external;
```

Binds the first deployed mining controller without granting the initializer mint authority.

### `mintMiningEmission(address,uint256)`

```solidity
function mintMiningEmission(address receiver, uint256 amount) external;
```

Mints a nonzero mining settlement through the currently authorized controller only.

### `name()`

```solidity
function name() external view returns (string arg0);
```

Returns the name of the token.

### `remainingMintCapacity()`

```solidity
function remainingMintCapacity() external view returns (uint256 arg0);
```

Returns capacity remaining below the lifetime mint ceiling.

### `replaceEmissionController(address)`

```solidity
function replaceEmissionController(address controller) external;
```

Atomically revokes the previous controller and authorizes a compatible replacement.
ProtocolTimelock exposes only a named replacement operation with a fixed seven-day delay.

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

#### `GBXToken__EmissionControllerReplaced(address,address)`

```solidity
event GBXToken__EmissionControllerReplaced(address indexed previousController, address indexed newController);
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

#### `GBXToken__AlreadyInitialized()`

```solidity
error GBXToken__AlreadyInitialized();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__CumulativeMintCapExceeded(uint256,uint256)`

```solidity
error GBXToken__CumulativeMintCapExceeded(uint256 requested, uint256 remaining);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__IncompatibleController(address)`

```solidity
error GBXToken__IncompatibleController(address controller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__Unauthorized(address)`

```solidity
error GBXToken__Unauthorized(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__ZeroAddress()`

```solidity
error GBXToken__ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GBXToken__ZeroAmount()`

```solidity
error GBXToken__ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

## AssetRegistry

Source: [`src/vault/AssetRegistry.sol`](../../packages/contracts/src/vault/AssetRegistry.sol)

Artifact: `out/AssetRegistry.sol/AssetRegistry.json`

Public ABI: 17 functions, 3 events, 8 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address)`

```solidity
constructor(address usdG, address protocolTimelock, address emergencyGuardian);
```

Configures access control and registers USDG as basket asset zero.

### `EMERGENCY_GUARDIAN()`

```solidity
function EMERGENCY_GUARDIAN() external view returns (address arg0);
```

Stop-only guardian allowed to disable live strategies.

### `MAX_ASSETS()`

```solidity
function MAX_ASSETS() external view returns (uint256 arg0);
```

Maximum number of redeemable basket assets, including USDG.

### `MAX_STRATEGIES()`

```solidity
function MAX_STRATEGIES() external view returns (uint256 arg0);
```

Maximum number of allocation strategies.

### `PROTOCOL_TIMELOCK()`

```solidity
function PROTOCOL_TIMELOCK() external view returns (address arg0);
```

Timelock allowed to register and disable strategies.

### `USDG()`

```solidity
function USDG() external view returns (address arg0);
```

Canonical USDG asset registered at basket index zero.

### `assetAt(uint256)`

```solidity
function assetAt(uint256 index) external view returns (address arg0);
```

Returns the redeemable basket asset at an index.

### `assetCount()`

```solidity
function assetCount() external view returns (uint256 arg0);
```

Returns the number of registered redeemable basket assets.

### `configFor(address)`

```solidity
function configFor(address token) external view returns (struct IAssetRegistry.AssetConfig arg0);
```

Returns the immutable registration graph and liveness for a basket asset.

### `disableStrategy(address)`

```solidity
function disableStrategy(address strategy) external;
```

Irreversibly stops a strategy from receiving signals or releasing new USDG.

### `isLiveStrategy(address)`

```solidity
function isLiveStrategy(address strategy) external view returns (bool arg0);
```

Returns whether a strategy is registered and not terminally disabled.

### `isRegisteredAsset(address)`

```solidity
function isRegisteredAsset(address token) external view returns (bool arg0);
```

Returns whether a token belongs to the redeemable basket.

### `registerAsset(address,address,address)`

```solidity
function registerAsset(address token, address strategy, address rewards) external;
```

Registers one immutable target/strategy/rewards association through the typed timelock.

### `registerStandaloneStrategy(address)`

```solidity
function registerStandaloneStrategy(address strategy) external;
```

Registers the single buyback strategy without adding GBX to the redeemable asset basket.

### `rewardsForStrategy(address)`

```solidity
function rewardsForStrategy(address strategy) external view returns (address rewards);
```

Returns the supporter rewards contract associated with a strategy, if any.

### `strategyAt(uint256)`

```solidity
function strategyAt(uint256 index) external view returns (address arg0);
```

Returns the registered allocation strategy at an index.

### `strategyCount()`

```solidity
function strategyCount() external view returns (uint256 arg0);
```

Returns the number of registered allocation strategies.

### `tokenForStrategy(address)`

```solidity
function tokenForStrategy(address strategy) external view returns (address token);
```

Returns the redeemable target token associated with a strategy, if any.

### Events

#### `AssetRegistry__AssetRegistered(address,address,address,uint256)`

```solidity
event AssetRegistry__AssetRegistered(address indexed token, address indexed strategy, address indexed rewards, uint256 assetIndex);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__StandaloneStrategyRegistered(address,uint256)`

```solidity
event AssetRegistry__StandaloneStrategyRegistered(address indexed strategy, uint256 strategyIndex);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__StrategyDisabled(address)`

```solidity
event AssetRegistry__StrategyDisabled(address indexed strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `AssetRegistry__AlreadyRegistered(address)`

```solidity
error AssetRegistry__AlreadyRegistered(address account);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__AssetLimitReached()`

```solidity
error AssetRegistry__AssetLimitReached();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__InvalidStrategyGraph(address)`

```solidity
error AssetRegistry__InvalidStrategyGraph(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__StrategyLimitReached()`

```solidity
error AssetRegistry__StrategyLimitReached();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__Unauthorized(address)`

```solidity
error AssetRegistry__Unauthorized(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__UnknownAsset(address)`

```solidity
error AssetRegistry__UnknownAsset(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `AssetRegistry__UnknownStrategy(address)`

```solidity
error AssetRegistry__UnknownStrategy(address strategy);
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

### `ASSET_REGISTRY()`

```solidity
function ASSET_REGISTRY() external view returns (contract IAssetRegistry arg0);
```

Returns the registry against which the strategy checks liveness.

### `STRATEGY_REWARDS()`

```solidity
function STRATEGY_REWARDS() external view returns (address arg0);
```

Returns the fixed rewards index associated with the strategy.

### `TARGET_TOKEN()`

```solidity
function TARGET_TOKEN() external view returns (address arg0);
```

Returns the fixed token acquired by the strategy.

### `activateAuction()`

```solidity
function activateAuction() external;
```

Starts the first auction epoch during registration.

## IBuybackRegistrationIdentity

Source: [`src/vault/AssetRegistry.sol`](../../packages/contracts/src/vault/AssetRegistry.sol)

Artifact: `out/AssetRegistry.sol/IBuybackRegistrationIdentity.json`

Public ABI: 2 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `ASSET_REGISTRY()`

```solidity
function ASSET_REGISTRY() external view returns (contract IAssetRegistry arg0);
```

Returns the registry against which the strategy checks liveness.

### `activateAuction()`

```solidity
function activateAuction() external;
```

Starts the first auction epoch during registration.

## GumBallVault

Source: [`src/vault/GumBallVault.sol`](../../packages/contracts/src/vault/GumBallVault.sol)

Artifact: `out/GumBallVault.sol/GumBallVault.json`

Public ABI: 6 functions, 2 events, 7 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address)`

```solidity
constructor(contract IGBXToken gbx, address usdG, contract IAssetRegistry assetRegistry, contract IAllocationVoter allocationVoter);
```

Configures the share token, basket registry, USDG, and allocation ledger.

### `ALLOCATION_VOTER()`

```solidity
function ALLOCATION_VOTER() external view returns (contract IAllocationVoter arg0);
```

Virtual USDG allocation ledger debited by releases and scaled by redemptions.

### `ASSET_REGISTRY()`

```solidity
function ASSET_REGISTRY() external view returns (contract IAssetRegistry arg0);
```

Bounded registry defining the raw redemption basket.

### `GBX()`

```solidity
function GBX() external view returns (contract IGBXToken arg0);
```

Redeemable share token burned during in-kind exits.

### `USDG()`

```solidity
function USDG() external view returns (contract IERC20 arg0);
```

Canonical USDG basket asset and strategy funding token.

### `redeem(uint256,address)`

```solidity
function redeem(uint256 shares, address receiver) external returns (uint256[] amounts);
```

Burns shares and atomically transfers their raw fraction of every registered balance.

### `releaseUSDG(address,uint256)`

```solidity
function releaseUSDG(address receiver, uint256 amount) external;
```

Releases a live caller strategy's already allocated fixed USDG lot.

### Events

#### `GumBallVault__Redeemed(address,address,uint256,uint256,uint256[])`

```solidity
event GumBallVault__Redeemed(address indexed owner, address indexed receiver, uint256 shares, uint256 supplyBefore, uint256[] amounts);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallVault__USDGReleased(address,address,uint256)`

```solidity
event GumBallVault__USDGReleased(address indexed strategy, address indexed receiver, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `GumBallVault__InexactTransfer(address,uint256,uint256,uint256)`

```solidity
error GumBallVault__InexactTransfer(address token, uint256 expected, uint256 debit, uint256 receipt);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallVault__InsufficientShares(uint256,uint256)`

```solidity
error GumBallVault__InsufficientShares(uint256 requested, uint256 balance);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GumBallVault__StrategyNotLive(address)`

```solidity
error GumBallVault__StrategyNotLive(address strategy);
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
