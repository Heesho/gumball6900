# Contract API reference

> Generated from Foundry artifacts by `packages/contracts/scripts/generate-contract-docs.mjs`. Do not edit by
> hand. Run `pnpm docs:generate` after changing a public Solidity surface or NatSpec.

Compiler artifact versions: `0.8.26+commit.8a97fa7a`.

Documented source surfaces: 17. Documented ABI entries: 480. Documented public ABI functions: 249.

## Bribe

Source: [`src/core/Bribe.sol`](../../packages/contracts/src/core/Bribe.sol)

Artifact: `out/Bribe.sol/Bribe.json`

Public ABI: 19 functions, 5 events, 10 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address)`

```solidity
constructor(address voter_);
```

Creates a reward stream controlled by `voter_`.

**Parameters**

- `voter_`: Voter exclusively authorized to maintain virtual balances.

### `REWARD_DURATION()`

```solidity
function REWARD_DURATION() external view returns (uint256 arg0);
```

Duration of each reward stream.

### `REWARD_PRECISION()`

```solidity
function REWARD_PRECISION() external view returns (uint256 arg0);
```

Fixed-point precision used for cumulative rewards per unit of voting weight.

### `addRewardToken(address)`

```solidity
function addRewardToken(address rewardToken) external;
```

Registers an additional token that may be distributed by this Bribe.

**Parameters**

- `rewardToken`: Token to register.

### `balanceOf(address)`

```solidity
function balanceOf(address account) external view returns (uint256 balance);
```

Virtual voting weight assigned to each account.

### `claimRewards(address)`

```solidity
function claimRewards(address account) external;
```

Claims every registered reward token earned by `account`.
Anyone may trigger a claim, but rewards are always sent directly to `account`.

**Parameters**

- `account`: Account whose accrued rewards are paid.

### `deposit(uint256,address)`

```solidity
function deposit(uint256 amount, address account) external;
```

Adds virtual voting weight for `account`.

**Parameters**

- `account`: Account whose virtual balance increases.
- `amount`: Weight to add.

### `earned(address,address)`

```solidity
function earned(address account, address rewardToken) external view returns (uint256 amount);
```

Returns rewards accrued by `account` for `rewardToken`.

**Parameters**

- `account`: Account whose rewards are queried.
- `rewardToken`: Reward token to query.

**Returns**

- `amount`: Accrued, unclaimed reward amount.

### `isRewardToken(address)`

```solidity
function isRewardToken(address token) external view returns (bool isReward);
```

Whether a token is registered as a reward for this Bribe.

### `lastTimeRewardApplicable(address)`

```solidity
function lastTimeRewardApplicable(address rewardToken) external view returns (uint256 timestamp);
```

Returns the last timestamp that contributes to the current reward period.

**Parameters**

- `rewardToken`: Token whose stream is queried.

**Returns**

- `timestamp`: Current time capped at the stream's finishing time.

### `left(address)`

```solidity
function left(address rewardToken) external view returns (uint256 amount);
```

Returns rewards still scheduled for distribution.

**Parameters**

- `rewardToken`: Token whose stream is queried.

**Returns**

- `amount`: Undistributed rewards remaining in the active stream.

### `notifyRewardAmount(address,uint256)`

```solidity
function notifyRewardAmount(address rewardToken, uint256 amount) external;
```

Adds `amount` to a seven-day reward stream for `rewardToken`.
Existing undistributed rewards are rolled into the new stream. BribeRouter avoids calling this function until the amount can sustain a non-zero rate and exceeds the remaining stream.

**Parameters**

- `amount`: Amount pulled from the caller and added to the stream.
- `rewardToken`: Registered token to stream.

### `rewardData(address)`

```solidity
function rewardData(address token) external view returns (uint256 periodFinish, uint256 rewardRate, uint256 lastUpdateTime, uint256 rewardPerTokenStored);
```

Streaming state for each registered reward token.

### `rewardPerToken(address)`

```solidity
function rewardPerToken(address rewardToken) external view returns (uint256 accumulatedReward);
```

Returns cumulative rewards per unit of virtual voting weight.

**Parameters**

- `rewardToken`: Token whose cumulative index is queried.

**Returns**

- `accumulatedReward`: Cumulative reward per unit of weight, scaled by `REWARD_PRECISION`.

### `rewardTokens()`

```solidity
function rewardTokens() external view returns (address[] tokens);
```

Returns all registered reward tokens.

**Returns**

- `tokens`: Registered reward tokens in insertion order.

### `rewards(address,address)`

```solidity
function rewards(address account, address token) external view returns (uint256 amount);
```

Accrued, unclaimed reward balance for an account and token.

### `totalSupply()`

```solidity
function totalSupply() external view returns (uint256 arg0);
```

Total virtual voting weight assigned to this Bribe.

### `userRewardPerTokenPaid(address,address)`

```solidity
function userRewardPerTokenPaid(address account, address token) external view returns (uint256 paid);
```

Cumulative reward-per-weight checkpoint already accounted to an account.

### `voter()`

```solidity
function voter() external view returns (address arg0);
```

Voter contract allowed to maintain virtual balances and register reward tokens.

### `withdraw(uint256,address)`

```solidity
function withdraw(uint256 amount, address account) external;
```

Removes virtual voting weight for `account`.

**Parameters**

- `account`: Account whose virtual balance decreases.
- `amount`: Weight to remove.

### Events

#### `RewardAdded(address)`

```solidity
event RewardAdded(address indexed rewardToken);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RewardNotified(address,uint256)`

```solidity
event RewardNotified(address indexed rewardToken, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RewardPaid(address,address,uint256)`

```solidity
event RewardPaid(address indexed account, address indexed rewardToken, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `VotingWeightDeposited(address,uint256)`

```solidity
event VotingWeightDeposited(address indexed account, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `VotingWeightWithdrawn(address,uint256)`

```solidity
event VotingWeightWithdrawn(address indexed account, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `InexactRewardTransfer(uint256,uint256)`

```solidity
error InexactRewardTransfer(uint256 expected, uint256 received);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `NotRewardToken(address)`

```solidity
error NotRewardToken(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `NotVoter(address)`

```solidity
error NotVoter(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RewardAlreadyAdded(address)`

```solidity
error RewardAlreadyAdded(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RewardBelowDuration(uint256)`

```solidity
error RewardBelowDuration(uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RewardBelowRemaining(uint256,uint256)`

```solidity
error RewardBelowRemaining(uint256 amount, uint256 remaining);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeERC20FailedOperation(address)`

```solidity
error SafeERC20FailedOperation(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroAddress()`

```solidity
error ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroAmount()`

```solidity
error ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

## BribeFactory

Source: [`src/core/BribeFactory.sol`](../../packages/contracts/src/core/BribeFactory.sol)

Artifact: `out/BribeFactory.sol/BribeFactory.json`

Public ABI: 6 functions, 3 events, 5 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address)`

```solidity
constructor(address initialOwner);
```

Creates an unbound factory whose owner may set Voter exactly once.

**Parameters**

- `initialOwner`: Deployment-time owner responsible for binding Voter.

### `createBribe()`

```solidity
function createBribe() external returns (contract Bribe bribe);
```

Deploys a Bribe controlled by the bound Voter.

**Returns**

- `bribe`: Newly deployed Bribe.

### `owner()`

```solidity
function owner() external view returns (address arg0);
```

Returns the address of the current owner.

### `renounceOwnership()`

```solidity
function renounceOwnership() external;
```

Leaves the contract without owner. It will not be possible to call `onlyOwner` functions. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby disabling any functionality that is only available to the owner.

### `setVoter(address)`

```solidity
function setVoter(address voter_) external;
```

Binds the only Voter allowed to deploy Bribes.

**Parameters**

- `voter_`: Voter address to bind permanently.

### `transferOwnership(address)`

```solidity
function transferOwnership(address newOwner) external;
```

Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.

### `voter()`

```solidity
function voter() external view returns (address arg0);
```

Voter exclusively authorized to create Bribes.

### Events

#### `BribeCreated(address,address)`

```solidity
event BribeCreated(address indexed bribe, address indexed voter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnershipTransferred(address,address)`

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `VoterSet(address)`

```solidity
event VoterSet(address indexed voter);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `NotVoter(address)`

```solidity
error NotVoter(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnableInvalidOwner(address)`

```solidity
error OwnableInvalidOwner(address owner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnableUnauthorizedAccount(address)`

```solidity
error OwnableUnauthorizedAccount(address account);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `VoterAlreadySet(address)`

```solidity
error VoterAlreadySet(address voter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroAddress()`

```solidity
error ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

## BribeRouter

Source: [`src/core/BribeRouter.sol`](../../packages/contracts/src/core/BribeRouter.sol)

Artifact: `out/BribeRouter.sol/BribeRouter.json`

Public ABI: 7 functions, 3 events, 6 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address)`

```solidity
constructor(address strategy_, contract Bribe bribe_, contract IERC20 rewardToken_, address fund_);
```

Creates the fixed route between one Strategy, one reward token, its Bribe, and Fund.

**Parameters**

- `bribe_`: Bribe that streams rewards to voters.
- `fund_`: Treasury receiving rewards when no voter weight exists.
- `rewardToken_`: Strategy payment token distributed as rewards.
- `strategy_`: Strategy exclusively allowed to queue rewards.

### `bribe()`

```solidity
function bribe() external view returns (contract Bribe arg0);
```

Bribe that streams the queued rewards.

### `distribute()`

```solidity
function distribute() external returns (uint256 distributed);
```

Permissionlessly distributes queued rewards or returns them to Fund when there are no voters.

**Returns**

- `distributed`: Amount sent to Bribe. Returns zero when rewards are queued or returned to Fund.

### `fund()`

```solidity
function fund() external view returns (address arg0);
```

Treasury that receives rewards when the Bribe has no voting weight.

### `pendingRewards()`

```solidity
function pendingRewards() external view returns (uint256 amount);
```

Returns payment-token rewards currently waiting in the router.

**Returns**

- `amount`: Current queued reward balance.

### `rewardToken()`

```solidity
function rewardToken() external view returns (contract IERC20 arg0);
```

Strategy payment token distributed as rewards.

### `routeRewards(uint256)`

```solidity
function routeRewards(uint256 amount) external returns (uint256 distributed);
```

Pulls a newly earned bribe share from Strategy and attempts to start a reward stream.

**Parameters**

- `amount`: Amount of `rewardToken` to pull from Strategy.

**Returns**

- `distributed`: Amount sent immediately to Bribe, or zero when retained or returned to Fund.

### `strategy()`

```solidity
function strategy() external view returns (address arg0);
```

Strategy exclusively authorized to queue newly earned rewards.

### Events

#### `RewardsDistributed(address,address,uint256)`

```solidity
event RewardsDistributed(address indexed bribe, address indexed rewardToken, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RewardsQueued(address,uint256)`

```solidity
event RewardsQueued(address indexed strategy, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RewardsReturnedToFund(address,address,uint256)`

```solidity
event RewardsReturnedToFund(address indexed fund, address indexed rewardToken, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `InexactTransfer(uint256,uint256)`

```solidity
error InexactTransfer(uint256 expected, uint256 received);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `NotStrategy(address)`

```solidity
error NotStrategy(address caller);
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

#### `ZeroAddress()`

```solidity
error ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroAmount()`

```solidity
error ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

## Fund

Source: [`src/core/Fund.sol`](../../packages/contracts/src/core/Fund.sol)

Artifact: `out/Fund.sol/Fund.json`

Public ABI: 10 functions, 5 events, 13 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(contract GBX gbx_, address initialOwner);
```

Creates a registry-free treasury for `gbx_` and assigns migration authority to `initialOwner`.

**Parameters**

- `gbx_`: GBX token backed by this Fund.
- `initialOwner`: Timelock that may configure the one-way successor.

### `burnGBX(uint256)`

```solidity
function burnGBX(uint256 amount) external;
```

Burns GBX already held by Fund, including GBX received during a buyback.

**Parameters**

- `amount`: Amount of GBX to burn.

### `gbx()`

```solidity
function gbx() external view returns (contract GBX arg0);
```

GBX token burned by redemptions and buybacks.

### `migrate(address[])`

```solidity
function migrate(address[] tokens) external;
```

Moves the complete Fund balance of each selected token to the configured successor.
Anyone may execute migration in gas-bounded batches. GBX cannot be migrated and remains burnable here.

**Parameters**

- `tokens`: Unique, non-GBX token addresses whose complete balances should move.

### `owner()`

```solidity
function owner() external view returns (address arg0);
```

Returns the address of the current owner.

### `pendingGBX()`

```solidity
function pendingGBX() external view returns (uint256 amount);
```

Returns GBX currently held by Fund and available to burn.

**Returns**

- `amount`: GBX balance currently held by Fund.

### `redeem(uint256,address,address[])`

```solidity
function redeem(uint256 gbxAmount, address receiver, address[] tokens) external;
```

Burns GBX and returns the caller-selected pro-rata share of Fund assets.
Every payout uses the same total supply captured before GBX is burned. Tokens omitted by the caller remain in Fund for the remaining GBX supply, and a failure in any selected transfer reverts the entire operation.

**Parameters**

- `gbxAmount`: Amount of GBX to burn.
- `receiver`: Address that receives the selected assets.
- `tokens`: Unique, non-GBX token addresses to include in this redemption.

### `renounceOwnership()`

```solidity
function renounceOwnership() external;
```

Leaves the contract without owner. It will not be possible to call `onlyOwner` functions. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby disabling any functionality that is only available to the owner.

### `setSuccessor(address)`

```solidity
function setSuccessor(address newSuccessor) external;
```

Permanently enables one-way, token-by-token migration to `newSuccessor`.
The successor must be a Fund-compatible contract backed by this exact GBX token.

**Parameters**

- `newSuccessor`: Fund-compatible destination to set permanently.

### `successor()`

```solidity
function successor() external view returns (address arg0);
```

One-way migration destination. The zero address means migration is not enabled.

### `transferOwnership(address)`

```solidity
function transferOwnership(address newOwner) external;
```

Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.

### Events

#### `GBXBurned(address,uint256)`

```solidity
event GBXBurned(address indexed caller, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnershipTransferred(address,address)`

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Redeemed(address,address,uint256,uint256)`

```solidity
event Redeemed(address indexed account, address indexed receiver, uint256 gbxAmount, uint256 tokenCount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SuccessorSet(address)`

```solidity
event SuccessorSet(address indexed successor);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `TokenMigrated(address,address,address,uint256)`

```solidity
event TokenMigrated(address indexed caller, address indexed token, address indexed successor, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `DuplicateToken(address)`

```solidity
error DuplicateToken(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmptyTokenList()`

```solidity
error EmptyTokenList();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ForbiddenToken(address)`

```solidity
error ForbiddenToken(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InexactTransfer(address,uint256,uint256)`

```solidity
error InexactTransfer(address token, uint256 expected, uint256 received);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidReceiver(address)`

```solidity
error InvalidReceiver(address receiver);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidSuccessor(address)`

```solidity
error InvalidSuccessor(address successor);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnableInvalidOwner(address)`

```solidity
error OwnableInvalidOwner(address owner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnableUnauthorizedAccount(address)`

```solidity
error OwnableUnauthorizedAccount(address account);
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

#### `SuccessorAlreadySet(address)`

```solidity
error SuccessorAlreadySet(address successor);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SuccessorNotSet()`

```solidity
error SuccessorNotSet();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroAmount()`

```solidity
error ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

## Fundraiser

Source: [`src/core/Fundraiser.sol`](../../packages/contracts/src/core/Fundraiser.sol)

Artifact: `out/Fundraiser.sol/Fundraiser.json`

Public ABI: 23 functions, 3 events, 11 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address)`

```solidity
constructor(contract GBX gbx_, contract IERC20 usdg_, address voterRouter_);
```

Creates the fixed contribution schedule and immutable revenue route.

**Parameters**

- `gbx_`: GBX token minted to contributors.
- `usdg_`: USDG token accepted as contributions.
- `voterRouter_`: Router that forwards every contribution to Voter.

### `DAILY_DECAY()`

```solidity
function DAILY_DECAY() external view returns (uint256 arg0);
```

Daily fixed-point multiplier that halves scheduled emissions every 1,460 epochs.

### `DISTRIBUTION_ALLOCATION()`

```solidity
function DISTRIBUTION_ALLOCATION() external view returns (uint256 arg0);
```

Maximum GBX nominally available to Fundraiser contributors.

### `DISTRIBUTION_EPOCHS()`

```solidity
function DISTRIBUTION_EPOCHS() external view returns (uint256 arg0);
```

Number of daily epochs with a nonzero scheduled emission.

### `EPOCH_DURATION()`

```solidity
function EPOCH_DURATION() external view returns (uint256 arg0);
```

Duration of every contribution epoch.

### `INITIAL_DAILY_EMISSION()`

```solidity
function INITIAL_DAILY_EMISSION() external view returns (uint256 arg0);
```

First daily emission in the four-year half-life schedule.

### `MIN_CONTRIBUTION()`

```solidity
function MIN_CONTRIBUTION() external view returns (uint256 arg0);
```

Smallest accepted raw USDG contribution.

### `WAD()`

```solidity
function WAD() external view returns (uint256 arg0);
```

Fixed-point scale used by the daily decay calculation.

### `accountContributions(uint256,address)`

```solidity
function accountContributions(uint256 epoch, address account) external view returns (uint256 amount);
```

USDG contribution credited to an account in an epoch.

### `accountHasClaimed(uint256,address)`

```solidity
function accountHasClaimed(uint256 epoch, address account) external view returns (bool hasClaimed);
```

Whether an account's GBX reward has been claimed for an epoch.

### `claim(address,uint256)`

```solidity
function claim(address account, uint256 epoch) external returns (uint256 reward);
```

Mints an account's proportional GBX reward for a completed epoch.
Anyone may trigger the claim, but GBX is always minted directly to `account`.

**Parameters**

- `account`: Contributor that receives GBX.
- `epoch`: Completed epoch to claim.

**Returns**

- `reward`: Amount of GBX minted to `account`.

### `contribute(address,uint256)`

```solidity
function contribute(address beneficiary, uint256 amount) external;
```

Contributes USDG and credits `beneficiary` with a proportional claim on the current epoch's emission.
USDG is transferred directly from the payer to VoterRouter, then routed to Voter in the same transaction.

**Parameters**

- `amount`: Amount of USDG to contribute.
- `beneficiary`: Account credited with the contribution.

### `currentEpoch()`

```solidity
function currentEpoch() external view returns (uint256 epoch);
```

Returns the active zero-indexed contribution epoch.

**Returns**

- `epoch`: Active epoch identifier.

### `currentScheduledEmission()`

```solidity
function currentScheduledEmission() external view returns (uint256 arg0);
```

Scheduled emission for `nextEpochToSettle`.

### `epochContributions(uint256)`

```solidity
function epochContributions(uint256 epoch) external view returns (uint256 amount);
```

Total USDG contributed during each epoch.

### `epochEmission(uint256)`

```solidity
function epochEmission(uint256 epoch) external view returns (uint256 amount);
```

GBX allocated to contributors in a settled epoch, or zero when that epoch was empty.

### `epochSettled(uint256)`

```solidity
function epochSettled(uint256 epoch) external view returns (bool settled);
```

Whether an ended epoch has been advanced through the sequential schedule.

### `gbx()`

```solidity
function gbx() external view returns (contract GBX arg0);
```

GBX minted to successful epoch claimants.

### `nextEpochToSettle()`

```solidity
function nextEpochToSettle() external view returns (uint256 arg0);
```

First epoch that has not yet been settled.

### `pendingReward(uint256,address)`

```solidity
function pendingReward(uint256 epoch, address account) external view returns (uint256 reward);
```

Returns an account's currently claimable GBX for a completed epoch.

**Parameters**

- `account`: Contributor whose reward is queried.
- `epoch`: Completed epoch to inspect.

**Returns**

- `reward`: Amount currently claimable, or zero when no claim is available.

### `settleEpochs(uint256)`

```solidity
function settleEpochs(uint256 maximumEpochs) external returns (uint256 settledCount);
```

Advances as many ended epochs as the caller permits through the exact sequential decay schedule.
Empty epochs consume their scheduled emission without minting it. Bounded batching keeps catch-up calls usable even after long periods of inactivity, while strict ordering preserves the original floor rounding.

**Parameters**

- `maximumEpochs`: Maximum number of epochs to settle in this transaction.

**Returns**

- `settledCount`: Number of epochs actually settled.

### `startedAt()`

```solidity
function startedAt() external view returns (uint256 arg0);
```

Timestamp at which epoch zero began.

### `usdg()`

```solidity
function usdg() external view returns (contract IERC20 arg0);
```

Revenue token accepted from contributors.

### `voterRouter()`

```solidity
function voterRouter() external view returns (address arg0);
```

Router that forwards every contribution into Voter.

### Events

#### `Claimed(address,uint256,uint256)`

```solidity
event Claimed(address indexed account, uint256 indexed epoch, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Contributed(address,address,uint256,uint256)`

```solidity
event Contributed(address indexed payer, address indexed beneficiary, uint256 indexed epoch, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EpochSettled(uint256,uint256,uint256,uint256)`

```solidity
event EpochSettled(uint256 indexed epoch, uint256 scheduledEmission, uint256 contributorEmission, uint256 nextScheduledEmission);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `AlreadyClaimed(uint256,address)`

```solidity
error AlreadyClaimed(uint256 epoch, address account);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BelowMinimumContribution(uint256)`

```solidity
error BelowMinimumContribution(uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `DistributionComplete()`

```solidity
error DistributionComplete();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EpochNotEnded(uint256)`

```solidity
error EpochNotEnded(uint256 epoch);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EpochNotSettled(uint256)`

```solidity
error EpochNotSettled(uint256 epoch);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InexactTransfer(uint256,uint256)`

```solidity
error InexactTransfer(uint256 expected, uint256 received);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidSettlementLimit()`

```solidity
error InvalidSettlementLimit();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `NoContribution(uint256,address)`

```solidity
error NoContribution(uint256 epoch, address account);
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

#### `ZeroAddress()`

```solidity
error ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

## GBX

Source: [`src/core/GBX.sol`](../../packages/contracts/src/core/GBX.sol)

Artifact: `out/GBX.sol/GBX.json`

Public ABI: 34 functions, 8 events, 27 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(address genesisLiquidityRecipient, address initialMinter);
```

Creates the fixed genesis allocation and assigns deployment-time minting authority.

**Parameters**

- `genesisLiquidityRecipient`: Recipient of the 20 million GBX liquidity allocation.
- `initialMinter`: Deployment coordinator that must permanently hand minting to Fundraiser.

### `CLOCK_MODE()`

```solidity
function CLOCK_MODE() external view returns (string arg0);
```

Machine-readable description of the clock as specified in ERC-6372.

### `DOMAIN_SEPARATOR()`

```solidity
function DOMAIN_SEPARATOR() external view returns (bytes32 arg0);
```

Returns the domain separator used in the encoding of the signature for {permit}, as defined by {EIP712}.

### `FUNDRAISER_ALLOCATION()`

```solidity
function FUNDRAISER_ALLOCATION() external view returns (uint256 arg0);
```

Remaining lifetime mint capacity reserved for Fundraiser rewards.

### `GENESIS_LIQUIDITY_ALLOCATION()`

```solidity
function GENESIS_LIQUIDITY_ALLOCATION() external view returns (uint256 arg0);
```

GBX created once for the canonical single-sided Uniswap v4 position.

### `MAX_LIFETIME_MINT()`

```solidity
function MAX_LIFETIME_MINT() external view returns (uint256 arg0);
```

Maximum number of GBX that may ever be minted.

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

Permanently burns GBX held by the caller.

**Parameters**

- `amount`: Amount of GBX to burn.

### `checkpoints(address,uint32)`

```solidity
function checkpoints(address account, uint32 pos) external view returns (struct Checkpoints.Checkpoint208 arg0);
```

Get the `pos`-th checkpoint for `account`.

### `clock()`

```solidity
function clock() external view returns (uint48 arg0);
```

Clock used for flagging checkpoints. Can be overridden to implement timestamp based checkpoints (and voting), in which case {CLOCK_MODE} should be overridden as well to match.

### `decimals()`

```solidity
function decimals() external view returns (uint8 arg0);
```

Returns the number of decimals used to get its user representation. For example, if `decimals` equals `2`, a balance of `505` tokens should be displayed to a user as `5.05` (`505 / 10 ** 2`). Tokens usually opt for a value of 18, imitating the relationship between Ether and Wei. This is the default value returned by this function, unless it's overridden. NOTE: This information is only used for _display_ purposes: it in no way affects any of the arithmetic of the contract, including {IERC20-balanceOf} and {IERC20-transfer}.

### `delegate(address)`

```solidity
function delegate(address delegatee) external;
```

Delegates votes from the sender to `delegatee`.

### `delegateBySig(address,uint256,uint256,uint8,bytes32,bytes32)`

```solidity
function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external;
```

Delegates votes from signer to `delegatee`.

### `delegates(address)`

```solidity
function delegates(address account) external view returns (address arg0);
```

Returns the delegate that `account` has chosen.

### `eip712Domain()`

```solidity
function eip712Domain() external view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions);
```

returns the fields and values that describe the domain separator used by this contract for EIP-712 signature.

### `getPastTotalSupply(uint256)`

```solidity
function getPastTotalSupply(uint256 timepoint) external view returns (uint256 arg0);
```

Returns the total supply of votes available at a specific moment in the past. If the `clock()` is configured to use block numbers, this will return the value at the end of the corresponding block. NOTE: This value is the sum of all available votes, which is not necessarily the sum of all delegated votes. Votes that have not been delegated are still part of total supply, even though they would not participate in a vote. Requirements: - `timepoint` must be in the past. If operating using block numbers, the block must be already mined.

### `getPastVotes(address,uint256)`

```solidity
function getPastVotes(address account, uint256 timepoint) external view returns (uint256 arg0);
```

Returns the amount of votes that `account` had at a specific moment in the past. If the `clock()` is configured to use block numbers, this will return the value at the end of the corresponding block. Requirements: - `timepoint` must be in the past. If operating using block numbers, the block must be already mined.

### `getVotes(address)`

```solidity
function getVotes(address account) external view returns (uint256 arg0);
```

Returns the current amount of votes that `account` has.

### `lifetimeBurned()`

```solidity
function lifetimeBurned() external view returns (uint256 arg0);
```

Total GBX permanently burned.

### `lifetimeMinted()`

```solidity
function lifetimeMinted() external view returns (uint256 arg0);
```

Total GBX minted over the lifetime of the contract, including tokens later burned.

### `mint(address,uint256)`

```solidity
function mint(address account, uint256 amount) external;
```

Mints GBX to `account` without exceeding the lifetime ceiling.

**Parameters**

- `account`: Address that receives the newly minted GBX.
- `amount`: Amount of GBX to mint.

### `minter()`

```solidity
function minter() external view returns (address arg0);
```

Address currently authorized to mint GBX.

### `minterLocked()`

```solidity
function minterLocked() external view returns (bool arg0);
```

Whether the one-time minter handover has been used.

### `name()`

```solidity
function name() external view returns (string arg0);
```

Returns the name of the token.

### `nonces(address)`

```solidity
function nonces(address owner) external view returns (uint256 nonce);
```

Returns the current ERC-2612 permit nonce for `owner`.

**Parameters**

- `owner`: Account whose nonce is queried.

**Returns**

- `nonce`: Current permit nonce.

### `numCheckpoints(address)`

```solidity
function numCheckpoints(address account) external view returns (uint32 arg0);
```

Get number of checkpoints for `account`.

### `permit(address,address,uint256,uint256,uint8,bytes32,bytes32)`

```solidity
function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
```

Sets `value` as the allowance of `spender` over `owner`'s tokens, given `owner`'s signed approval. IMPORTANT: The same issues {IERC20-approve} has related to transaction ordering also applies here. Emits an {Approval} event. Requirements: - `spender` cannot be the zero address. - `deadline` must be a timestamp in the future. - `v`, `r` and `s` must be a valid `secp256k1` signature from `owner` over the EIP712-formatted function arguments. - the signature must use `owner`'s current nonce (see {nonces}). For more information on the signature format, see the https://eips.ethereum.org/EIPS/eip-2612#specification[relevant EIP section]. CAUTION: See Security Considerations above.

### `remainingMintableSupply()`

```solidity
function remainingMintableSupply() external view returns (uint256 amount);
```

Returns how much GBX can still be minted over the contract's lifetime.

**Returns**

- `amount`: Remaining lifetime mint capacity.

### `setMinter(address)`

```solidity
function setMinter(address newMinter) external;
```

Permanently hands minting authority to `newMinter`.
The current minter may perform this handover exactly once. This supports deployment-time wiring to the Fundraiser without leaving a mutable governance-controlled minter.

**Parameters**

- `newMinter`: Address that will permanently receive minting authority.

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

#### `Burned(address,uint256)`

```solidity
event Burned(address indexed account, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `DelegateChanged(address,address,address)`

```solidity
event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `DelegateVotesChanged(address,uint256,uint256)`

```solidity
event DelegateVotesChanged(address indexed delegate, uint256 previousVotes, uint256 newVotes);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EIP712DomainChanged()`

```solidity
event EIP712DomainChanged();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Minted(address,uint256)`

```solidity
event Minted(address indexed account, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MinterSet(address,address)`

```solidity
event MinterSet(address indexed previousMinter, address indexed newMinter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Transfer(address,address,uint256)`

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `CheckpointUnorderedInsertion()`

```solidity
error CheckpointUnorderedInsertion();
```

_No additional NatSpec notice is present in the compiled artifact._

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

#### `ERC20ExceededSafeSupply(uint256,uint256)`

```solidity
error ERC20ExceededSafeSupply(uint256 increasedSupply, uint256 cap);
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

#### `ERC5805FutureLookup(uint256,uint48)`

```solidity
error ERC5805FutureLookup(uint256 timepoint, uint48 clock);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ERC6372InconsistentClock()`

```solidity
error ERC6372InconsistentClock();
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

#### `LifetimeMintCapExceeded(uint256,uint256)`

```solidity
error LifetimeMintCapExceeded(uint256 requested, uint256 remaining);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MinterAlreadyLocked()`

```solidity
error MinterAlreadyLocked();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MinterNotLocked()`

```solidity
error MinterNotLocked();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `NotMinter(address)`

```solidity
error NotMinter(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeCastOverflowedUintDowncast(uint8,uint256)`

```solidity
error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SameMinter()`

```solidity
error SameMinter();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StringTooLong(string)`

```solidity
error StringTooLong(string str);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `VotesExpiredSignature(uint256)`

```solidity
error VotesExpiredSignature(uint256 expiry);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroAddress()`

```solidity
error ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroAmount()`

```solidity
error ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

## LiquidityPosition

Source: [`src/core/LiquidityPosition.sol`](../../packages/contracts/src/core/LiquidityPosition.sol)

Artifact: `out/LiquidityPosition.sol/LiquidityPosition.json`

Public ABI: 25 functions, 5 events, 23 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor((address,address,uint256,address,address,address,address),(address,address,uint24,int24,address),int24,int24)`

```solidity
constructor(struct LiquidityPosition.Dependencies dependencies, struct PoolKey canonicalPoolKey, int24 tickLower, int24 tickUpper);
```

Fixes the exact v4 pool, range, NFT, fee route, and timelocked migration authority.

**Parameters**

- `canonicalPoolKey`: Exact hookless GBX/USDG pool identity.
- `dependencies`: Immutable protocol and PositionManager dependencies.
- `tickLower`: Expected lower tick of the precommitted single-sided position.
- `tickUpper`: Expected upper tick of the precommitted single-sided position.

### `collectFees()`

```solidity
function collectFees() external returns (uint256 gbxBurned, uint256 usdgRouted);
```

Collects fees without removing principal, burns all held GBX, and routes all held USDG to Voter.
Processing complete balances also makes direct GBX or USDG transfers harmless. A failure in collection, burning, transfer, or routing reverts the entire operation atomically.

**Returns**

- `gbxBurned`: GBX permanently burned in this call.
- `usdgRouted`: USDG delivered to VoterRouter in this call.

### `currency0()`

```solidity
function currency0() external view returns (address arg0);
```

Lower-address token of the canonical pool.

### `currency1()`

```solidity
function currency1() external view returns (address arg0);
```

Higher-address token of the canonical pool.

### `expectedPositionTokenId()`

```solidity
function expectedPositionTokenId() external view returns (uint256 arg0);
```

Precommitted token ID of the genesis position.

### `expectedTickLower()`

```solidity
function expectedTickLower() external view returns (int24 arg0);
```

Expected lower tick of the genesis position.

### `expectedTickUpper()`

```solidity
function expectedTickUpper() external view returns (int24 arg0);
```

Expected upper tick of the genesis position.

### `gbx()`

```solidity
function gbx() external view returns (contract GBX arg0);
```

GBX token burned when collected as fees.

### `migratePosition()`

```solidity
function migratePosition() external;
```

Moves the exact canonical position to the configured compatible successor.
Execution is permissionless after the timelocked owner has committed to the successor.

### `onERC721Received(address,address,uint256,bytes)`

```solidity
function onERC721Received(address operator, address from, uint256 tokenId, bytes data) external returns (bytes4 selector);
```

Records and validates the first and only accepted PositionManager NFT.

**Parameters**

- `data`: Optional transfer data; ignored.
- `from`: Previous position owner.
- `operator`: Account that initiated the safe transfer.
- `tokenId`: PositionManager token ID.

**Returns**

- `selector`: ERC-721 receiver acceptance selector.

### `owner()`

```solidity
function owner() external view returns (address arg0);
```

Returns the address of the current owner.

### `poolFee()`

```solidity
function poolFee() external view returns (uint24 arg0);
```

Fee tier of the canonical pool.

### `poolKey()`

```solidity
function poolKey() external view returns (struct PoolKey key);
```

Returns the immutable canonical hookless pool identity.

**Returns**

- `key`: Canonical GBX/USDG PoolKey.

### `poolKeyHash()`

```solidity
function poolKeyHash() external view returns (bytes32 arg0);
```

Hash of the complete hookless GBX/USDG pool key.

### `positionDepositor()`

```solidity
function positionDepositor() external view returns (address arg0);
```

One-time account expected to deliver the genesis position.

### `positionInCustody()`

```solidity
function positionInCustody() external view returns (bool inCustody);
```

Returns whether this contract currently owns the exact recorded position.

**Returns**

- `inCustody`: Whether this contract currently owns the position NFT.

### `positionManager()`

```solidity
function positionManager() external view returns (contract IPositionManager arg0);
```

Canonical Uniswap v4 PositionManager.

### `positionRecorded()`

```solidity
function positionRecorded() external view returns (bool arg0);
```

Whether the expected position has been received and validated.

### `positionTokenId()`

```solidity
function positionTokenId() external view returns (uint256 arg0);
```

The canonical PositionManager NFT held by this contract.

### `renounceOwnership()`

```solidity
function renounceOwnership() external;
```

Leaves the contract without owner. It will not be possible to call `onlyOwner` functions. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby disabling any functionality that is only available to the owner.

### `setSuccessor(address)`

```solidity
function setSuccessor(address newSuccessor) external;
```

Permanently binds one replacement contract with identical immutable position configuration.

**Parameters**

- `newSuccessor`: Compatible LiquidityPosition that expects this contract to deliver the same NFT.

### `successor()`

```solidity
function successor() external view returns (address arg0);
```

One-way compatible migration target, or zero before governance binds one.

### `tickSpacing()`

```solidity
function tickSpacing() external view returns (int24 arg0);
```

Tick spacing of the canonical pool.

### `transferOwnership(address)`

```solidity
function transferOwnership(address newOwner) external;
```

Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.

### `usdg()`

```solidity
function usdg() external view returns (contract IERC20 arg0);
```

USDG token routed to Voter.

### `voterRouter()`

```solidity
function voterRouter() external view returns (address arg0);
```

Router receiving all collected USDG.

### Events

#### `FeesProcessed(uint256,address,uint256,uint256)`

```solidity
event FeesProcessed(uint256 indexed positionTokenId, address indexed caller, uint256 gbxBurned, uint256 usdgRouted);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnershipTransferred(address,address)`

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PositionMigrated(uint256,address,address)`

```solidity
event PositionMigrated(uint256 indexed positionTokenId, address indexed caller, address indexed successor);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PositionRecorded(uint256,address,bytes32)`

```solidity
event PositionRecorded(uint256 indexed positionTokenId, address indexed previousOwner, bytes32 indexed poolKeyHash);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SuccessorSet(address)`

```solidity
event SuccessorSet(address indexed successor);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `AddressHasNoCode(address)`

```solidity
error AddressHasNoCode(address account);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmptyPosition(uint256)`

```solidity
error EmptyPosition(uint256 positionTokenId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `IncompatibleSuccessor(address)`

```solidity
error IncompatibleSuccessor(address successor);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InexactUSDGTransfer(uint256,uint256,uint256)`

```solidity
error InexactUSDGTransfer(uint256 expected, uint256 debited, uint256 received);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidPoolCurrencies(address,address)`

```solidity
error InvalidPoolCurrencies(address currency0, address currency1);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidPoolKey(bytes32,bytes32)`

```solidity
error InvalidPoolKey(bytes32 expected, bytes32 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidPositionTicks(int24,int24,int24,int24)`

```solidity
error InvalidPositionTicks(int24 expectedLower, int24 expectedUpper, int24 actualLower, int24 actualUpper);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidTickRange(int24,int24)`

```solidity
error InvalidTickRange(int24 tickLower, int24 tickUpper);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `NoPositionRecorded()`

```solidity
error NoPositionRecorded();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `NonzeroHook(address)`

```solidity
error NonzeroHook(address hook);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnableInvalidOwner(address)`

```solidity
error OwnableInvalidOwner(address owner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnableUnauthorizedAccount(address)`

```solidity
error OwnableUnauthorizedAccount(address account);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PositionAlreadyRecorded(uint256)`

```solidity
error PositionAlreadyRecorded(uint256 positionTokenId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PositionNotInCustody(uint256)`

```solidity
error PositionNotInCustody(uint256 positionTokenId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PositionNotOwned(uint256,address)`

```solidity
error PositionNotOwned(uint256 positionTokenId, address owner);
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

#### `SuccessorAlreadySet(address)`

```solidity
error SuccessorAlreadySet(address successor);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SuccessorNotSet()`

```solidity
error SuccessorNotSet();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `UnexpectedNFTSender(address)`

```solidity
error UnexpectedNFTSender(address sender);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `UnexpectedPositionDepositor(address)`

```solidity
error UnexpectedPositionDepositor(address depositor);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `UnexpectedPositionTokenId(uint256,uint256)`

```solidity
error UnexpectedPositionTokenId(uint256 expected, uint256 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroAddress()`

```solidity
error ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

## SignalGBX

Source: [`src/core/SignalGBX.sol`](../../packages/contracts/src/core/SignalGBX.sol)

Artifact: `out/SignalGBX.sol/SignalGBX.json`

Public ABI: 31 functions, 9 events, 29 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(contract IERC20 gbx_, address initialOwner);
```

Creates the non-transferable staking receipt and assigns deployment-time ownership.

**Parameters**

- `gbx_`: GBX token deposited by stakers.
- `initialOwner`: Deployment-time owner responsible for binding Voter.

### `CLOCK_MODE()`

```solidity
function CLOCK_MODE() external view returns (string arg0);
```

Machine-readable description of the clock as specified in ERC-6372.

### `DOMAIN_SEPARATOR()`

```solidity
function DOMAIN_SEPARATOR() external view returns (bytes32 arg0);
```

Returns the domain separator used in the encoding of the signature for {permit}, as defined by {EIP712}.

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

### `checkpoints(address,uint32)`

```solidity
function checkpoints(address account, uint32 pos) external view returns (struct Checkpoints.Checkpoint208 arg0);
```

Get the `pos`-th checkpoint for `account`.

### `clock()`

```solidity
function clock() external view returns (uint48 arg0);
```

Clock used for flagging checkpoints. Can be overridden to implement timestamp based checkpoints (and voting), in which case {CLOCK_MODE} should be overridden as well to match.

### `decimals()`

```solidity
function decimals() external view returns (uint8 arg0);
```

Returns the number of decimals used to get its user representation. For example, if `decimals` equals `2`, a balance of `505` tokens should be displayed to a user as `5.05` (`505 / 10 ** 2`). Tokens usually opt for a value of 18, imitating the relationship between Ether and Wei. This is the default value returned by this function, unless it's overridden. NOTE: This information is only used for _display_ purposes: it in no way affects any of the arithmetic of the contract, including {IERC20-balanceOf} and {IERC20-transfer}.

### `delegate(address)`

```solidity
function delegate(address delegatee) external;
```

Delegates votes from the sender to `delegatee`.

### `delegateBySig(address,uint256,uint256,uint8,bytes32,bytes32)`

```solidity
function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external;
```

Delegates votes from signer to `delegatee`.

### `delegates(address)`

```solidity
function delegates(address account) external view returns (address arg0);
```

Returns the delegate that `account` has chosen.

### `eip712Domain()`

```solidity
function eip712Domain() external view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions);
```

returns the fields and values that describe the domain separator used by this contract for EIP-712 signature.

### `gbx()`

```solidity
function gbx() external view returns (contract IERC20 arg0);
```

Underlying GBX held one-for-one against the SignalGBX supply.

### `getPastTotalSupply(uint256)`

```solidity
function getPastTotalSupply(uint256 timepoint) external view returns (uint256 arg0);
```

Returns the total supply of votes available at a specific moment in the past. If the `clock()` is configured to use block numbers, this will return the value at the end of the corresponding block. NOTE: This value is the sum of all available votes, which is not necessarily the sum of all delegated votes. Votes that have not been delegated are still part of total supply, even though they would not participate in a vote. Requirements: - `timepoint` must be in the past. If operating using block numbers, the block must be already mined.

### `getPastVotes(address,uint256)`

```solidity
function getPastVotes(address account, uint256 timepoint) external view returns (uint256 arg0);
```

Returns the amount of votes that `account` had at a specific moment in the past. If the `clock()` is configured to use block numbers, this will return the value at the end of the corresponding block. Requirements: - `timepoint` must be in the past. If operating using block numbers, the block must be already mined.

### `getVotes(address)`

```solidity
function getVotes(address account) external view returns (uint256 arg0);
```

Returns the current amount of votes that `account` has.

### `name()`

```solidity
function name() external view returns (string arg0);
```

Returns the name of the token.

### `nonces(address)`

```solidity
function nonces(address owner) external view returns (uint256 nonce);
```

Returns the current ERC-2612 permit nonce for `owner`.

**Parameters**

- `owner`: Account whose nonce is queried.

**Returns**

- `nonce`: Current permit nonce.

### `numCheckpoints(address)`

```solidity
function numCheckpoints(address account) external view returns (uint32 arg0);
```

Get number of checkpoints for `account`.

### `owner()`

```solidity
function owner() external view returns (address arg0);
```

Returns the address of the current owner.

### `permit(address,address,uint256,uint256,uint8,bytes32,bytes32)`

```solidity
function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
```

Sets `value` as the allowance of `spender` over `owner`'s tokens, given `owner`'s signed approval. IMPORTANT: The same issues {IERC20-approve} has related to transaction ordering also applies here. Emits an {Approval} event. Requirements: - `spender` cannot be the zero address. - `deadline` must be a timestamp in the future. - `v`, `r` and `s` must be a valid `secp256k1` signature from `owner` over the EIP712-formatted function arguments. - the signature must use `owner`'s current nonce (see {nonces}). For more information on the signature format, see the https://eips.ethereum.org/EIPS/eip-2612#specification[relevant EIP section]. CAUTION: See Security Considerations above.

### `renounceOwnership()`

```solidity
function renounceOwnership() external;
```

Leaves the contract without owner. It will not be possible to call `onlyOwner` functions. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby disabling any functionality that is only available to the owner.

### `setVoter(address)`

```solidity
function setVoter(address voter_) external;
```

Binds the Voter dependency once during deployment.

**Parameters**

- `voter_`: Voter address to bind permanently.

### `stake(uint256)`

```solidity
function stake(uint256 amount) external;
```

Stakes GBX and mints the same amount of non-transferable SignalGBX.

**Parameters**

- `amount`: Amount of GBX to stake.

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

### `transferOwnership(address)`

```solidity
function transferOwnership(address newOwner) external;
```

Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.

### `unstake(uint256)`

```solidity
function unstake(uint256 amount) external;
```

Burns SignalGBX and returns the underlying GBX immediately after all votes are cleared.

**Parameters**

- `amount`: Amount of SignalGBX to burn and GBX to withdraw.

### `voter()`

```solidity
function voter() external view returns (address arg0);
```

Voter that tracks whether an account still has active allocations.

### Events

#### `Approval(address,address,uint256)`

```solidity
event Approval(address indexed owner, address indexed spender, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `DelegateChanged(address,address,address)`

```solidity
event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `DelegateVotesChanged(address,uint256,uint256)`

```solidity
event DelegateVotesChanged(address indexed delegate, uint256 previousVotes, uint256 newVotes);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EIP712DomainChanged()`

```solidity
event EIP712DomainChanged();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnershipTransferred(address,address)`

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Staked(address,uint256)`

```solidity
event Staked(address indexed account, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Transfer(address,address,uint256)`

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Unstaked(address,uint256)`

```solidity
event Unstaked(address indexed account, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `VoterSet(address)`

```solidity
event VoterSet(address indexed voter);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `ActiveVotes(address,uint256)`

```solidity
error ActiveVotes(address account, uint256 usedWeight);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `CheckpointUnorderedInsertion()`

```solidity
error CheckpointUnorderedInsertion();
```

_No additional NatSpec notice is present in the compiled artifact._

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

#### `ERC20ExceededSafeSupply(uint256,uint256)`

```solidity
error ERC20ExceededSafeSupply(uint256 increasedSupply, uint256 cap);
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

#### `ERC5805FutureLookup(uint256,uint48)`

```solidity
error ERC5805FutureLookup(uint256 timepoint, uint48 clock);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ERC6372InconsistentClock()`

```solidity
error ERC6372InconsistentClock();
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

#### `OwnableInvalidOwner(address)`

```solidity
error OwnableInvalidOwner(address owner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnableUnauthorizedAccount(address)`

```solidity
error OwnableUnauthorizedAccount(address account);
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

#### `StringTooLong(string)`

```solidity
error StringTooLong(string str);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `TransferDisabled()`

```solidity
error TransferDisabled();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `VoterAlreadySet(address)`

```solidity
error VoterAlreadySet(address voter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `VotesExpiredSignature(uint256)`

```solidity
error VotesExpiredSignature(uint256 expiry);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroAddress()`

```solidity
error ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroAmount()`

```solidity
error ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

## Strategy

Source: [`src/core/Strategy.sol`](../../packages/contracts/src/core/Strategy.sol)

Artifact: `out/Strategy.sol/Strategy.json`

Public ABI: 22 functions, 1 event, 13 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,uint8,(uint256,uint256,uint256,uint256))`

```solidity
constructor(address voter_, contract IERC20 revenueToken_, contract IERC20 paymentToken_, address fund_, enum Strategy.Kind kind_, struct Strategy.Config config);
```

Creates one immutable acquisition or buyback Strategy.

**Parameters**

- `config`: Immutable auction configuration.
- `fund_`: Treasury receiving acquisition payments or buyback GBX.
- `kind_`: Whether this Strategy acquires an asset or performs GBX buybacks.
- `paymentToken_`: Asset buyers pay to fill this Strategy.
- `revenueToken_`: USDG token sold by this Strategy.
- `voter_`: Voter that provides the reward share and paired BribeRouter.

### `ABSOLUTE_MAXIMUM_PRICE()`

```solidity
function ABSOLUTE_MAXIMUM_PRICE() external view returns (uint256 arg0);
```

Absolute upper bound for a starting or minimum price.

### `ABSOLUTE_MINIMUM_PRICE()`

```solidity
function ABSOLUTE_MINIMUM_PRICE() external view returns (uint256 arg0);
```

Absolute lower bound for a configured minimum price.

### `BPS_SCALE()`

```solidity
function BPS_SCALE() external view returns (uint256 arg0);
```

Basis-point denominator used for the acquisition payment split.

### `MAX_EPOCH_DURATION()`

```solidity
function MAX_EPOCH_DURATION() external view returns (uint256 arg0);
```

Longest permitted price-decay period.

### `MAX_PRICE_MULTIPLIER()`

```solidity
function MAX_PRICE_MULTIPLIER() external view returns (uint256 arg0);
```

Largest multiplier permitted for the next starting price.

### `MIN_EPOCH_DURATION()`

```solidity
function MIN_EPOCH_DURATION() external view returns (uint256 arg0);
```

Shortest permitted price-decay period.

### `MIN_PRICE_MULTIPLIER()`

```solidity
function MIN_PRICE_MULTIPLIER() external view returns (uint256 arg0);
```

Smallest multiplier permitted for the next starting price.

### `PRICE_SCALE()`

```solidity
function PRICE_SCALE() external view returns (uint256 arg0);
```

Fixed-point precision for the next-price multiplier.

### `availableRevenue()`

```solidity
function availableRevenue() external view returns (uint256 amount);
```

Returns USDG currently available for purchase.

**Returns**

- `amount`: USDG currently held by this Strategy.

### `buy(address,uint256,uint256,uint256)`

```solidity
function buy(address revenueReceiver, uint256 expectedEpochId, uint256 deadline, uint256 maximumPayment) external returns (uint256 paymentAmount);
```

Purchases the Strategy's complete USDG balance at the current declining price.

**Parameters**

- `deadline`: Latest timestamp at which this transaction may execute.
- `expectedEpochId`: Expected epoch, protecting the buyer from another fill changing the price first.
- `maximumPayment`: Maximum payment accepted by the buyer.
- `revenueReceiver`: Address that receives the accumulated USDG.

**Returns**

- `paymentAmount`: Actual payment required at execution time.

### `currentPrice()`

```solidity
function currentPrice() external view returns (uint256 price);
```

Returns the current linearly declining price.

**Returns**

- `price`: Payment required to fill the active auction epoch.

### `epochDuration()`

```solidity
function epochDuration() external view returns (uint256 arg0);
```

Number of seconds over which price declines to zero.

### `epochId()`

```solidity
function epochId() external view returns (uint256 arg0);
```

Current auction epoch identifier.

### `epochStartedAt()`

```solidity
function epochStartedAt() external view returns (uint256 arg0);
```

Timestamp at which the active epoch began.

### `fund()`

```solidity
function fund() external view returns (address arg0);
```

Treasury that receives acquisition proceeds or buyback GBX.

### `initialPrice()`

```solidity
function initialPrice() external view returns (uint256 arg0);
```

Price at the beginning of the active epoch.

### `kind()`

```solidity
function kind() external view returns (enum Strategy.Kind arg0);
```

Whether this Strategy performs an acquisition or GBX buyback.

### `minimumPrice()`

```solidity
function minimumPrice() external view returns (uint256 arg0);
```

Floor applied to the next epoch's starting price.

### `paymentToken()`

```solidity
function paymentToken() external view returns (contract IERC20 arg0);
```

Asset required from a buyer.

### `priceMultiplier()`

```solidity
function priceMultiplier() external view returns (uint256 arg0);
```

Fixed-point multiplier applied to a completed epoch's payment.

### `revenueToken()`

```solidity
function revenueToken() external view returns (contract IERC20 arg0);
```

USDG sold by this Strategy.

### `voter()`

```solidity
function voter() external view returns (address arg0);
```

Voter that supplies the current bribe share and paired BribeRouter.

### Events

#### `Purchased(address,address,uint256,uint256,uint256)`

```solidity
event Purchased(address indexed buyer, address indexed revenueReceiver, uint256 indexed epochId, uint256 revenueAmount, uint256 paymentAmount);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `DeadlinePassed(uint256)`

```solidity
error DeadlinePassed(uint256 deadline);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmptyRevenue()`

```solidity
error EmptyRevenue();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EpochDurationOutOfRange(uint256)`

```solidity
error EpochDurationOutOfRange(uint256 duration);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EpochIdMismatch(uint256,uint256)`

```solidity
error EpochIdMismatch(uint256 expected, uint256 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InexactPayment(uint256,uint256)`

```solidity
error InexactPayment(uint256 expected, uint256 received);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InitialPriceOutOfRange(uint256)`

```solidity
error InitialPriceOutOfRange(uint256 price);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidBuybackToken(address)`

```solidity
error InvalidBuybackToken(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MaximumPaymentExceeded(uint256,uint256)`

```solidity
error MaximumPaymentExceeded(uint256 payment, uint256 maximum);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MinimumPriceOutOfRange(uint256)`

```solidity
error MinimumPriceOutOfRange(uint256 price);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PriceMultiplierOutOfRange(uint256)`

```solidity
error PriceMultiplierOutOfRange(uint256 multiplier);
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

#### `ZeroAddress()`

```solidity
error ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

## StrategyFactory

Source: [`src/core/StrategyFactory.sol`](../../packages/contracts/src/core/StrategyFactory.sol)

Artifact: `out/StrategyFactory.sol/StrategyFactory.json`

Public ABI: 6 functions, 3 events, 5 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address)`

```solidity
constructor(address initialOwner);
```

Creates an unbound factory whose owner may set Voter exactly once.

**Parameters**

- `initialOwner`: Deployment-time owner responsible for binding Voter.

### `createStrategy(address,address,address,address,uint8,(uint256,uint256,uint256,uint256))`

```solidity
function createStrategy(contract IERC20 revenueToken, contract IERC20 paymentToken, address fund, contract Bribe bribe, enum Strategy.Kind kind, struct Strategy.Config config) external returns (contract Strategy strategy, contract BribeRouter bribeRouter);
```

Deploys a Strategy and the BribeRouter paired with it.

**Parameters**

- `bribe`: Bribe that streams the Strategy's voter share.
- `config`: Immutable auction configuration.
- `fund`: Treasury receiving acquisition proceeds or GBX buybacks.
- `kind`: Whether the Strategy acquires an asset or performs GBX buybacks.
- `paymentToken`: Asset buyers pay to fill the Strategy.
- `revenueToken`: USDG token sold by the Strategy.

**Returns**

- `bribeRouter`: Newly deployed BribeRouter paired with `strategy`.
- `strategy`: Newly deployed Strategy.

### `owner()`

```solidity
function owner() external view returns (address arg0);
```

Returns the address of the current owner.

### `renounceOwnership()`

```solidity
function renounceOwnership() external;
```

Leaves the contract without owner. It will not be possible to call `onlyOwner` functions. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby disabling any functionality that is only available to the owner.

### `setVoter(address)`

```solidity
function setVoter(address voter_) external;
```

Binds the only Voter allowed to create Strategies.

**Parameters**

- `voter_`: Voter address to bind permanently.

### `transferOwnership(address)`

```solidity
function transferOwnership(address newOwner) external;
```

Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.

### `voter()`

```solidity
function voter() external view returns (address arg0);
```

Voter exclusively authorized to create Strategy graphs.

### Events

#### `OwnershipTransferred(address,address)`

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyCreated(address,address,address,uint8)`

```solidity
event StrategyCreated(address indexed strategy, address indexed bribeRouter, address indexed paymentToken, enum Strategy.Kind kind);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `VoterSet(address)`

```solidity
event VoterSet(address indexed voter);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `NotVoter(address)`

```solidity
error NotVoter(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnableInvalidOwner(address)`

```solidity
error OwnableInvalidOwner(address owner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnableUnauthorizedAccount(address)`

```solidity
error OwnableUnauthorizedAccount(address account);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `VoterAlreadySet(address)`

```solidity
error VoterAlreadySet(address voter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroAddress()`

```solidity
error ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

## Voter

Source: [`src/core/Voter.sol`](../../packages/contracts/src/core/Voter.sol)

Artifact: `out/Voter.sol/Voter.json`

Public ABI: 42 functions, 10 events, 16 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,address,address)`

```solidity
constructor(contract IERC20 signalGBX_, contract IERC20 usdg_, address fund_, contract BribeFactory bribeFactory_, contract StrategyFactory strategyFactory_, address initialOwner);
```

Creates the allocation system with immutable token, Fund, and factory dependencies.

**Parameters**

- `bribeFactory_`: Factory used to deploy one Bribe per Strategy.
- `fund_`: Treasury receiving unallocated or disabled-Strategy revenue.
- `initialOwner`: Typed timelock authorized to administer the system.
- `signalGBX_`: Non-transferable staking receipt used as voting power.
- `strategyFactory_`: Factory used to deploy Strategies and BribeRouters.
- `usdg_`: Revenue token allocated among Strategies.

### `BPS_SCALE()`

```solidity
function BPS_SCALE() external view returns (uint256 arg0);
```

Basis-point denominator for acquisition reward shares.

### `DEFAULT_BRIBE_BPS()`

```solidity
function DEFAULT_BRIBE_BPS() external view returns (uint256 arg0);
```

Initial 10% share of acquisition payments streamed to voters.

### `INDEX_PRECISION()`

```solidity
function INDEX_PRECISION() external view returns (uint256 arg0);
```

Fixed-point precision for indexed USDG revenue.

### `MAX_BRIBE_BPS()`

```solidity
function MAX_BRIBE_BPS() external view returns (uint256 arg0);
```

Maximum 50% share governance may stream to voters.

### `accountStrategies(address)`

```solidity
function accountStrategies(address account) external view returns (address[] strategyList);
```

Returns the Strategies currently selected by `account`.

**Parameters**

- `account`: Voting account to inspect.

**Returns**

- `strategyList`: Strategies currently selected by `account`.

### `accountUsedWeight(address)`

```solidity
function accountUsedWeight(address account) external view returns (uint256 weight);
```

Total voting weight currently allocated by an account.

### `accountVotes(address,address)`

```solidity
function accountVotes(address account, address strategy) external view returns (uint256 votes);
```

Voting weight an account assigned to a Strategy.

### `addBribeReward(address,address)`

```solidity
function addBribeReward(address strategy, address rewardToken) external;
```

Registers an additional reward token on a Strategy's Bribe.

**Parameters**

- `rewardToken`: Token to register.
- `strategy`: Strategy whose Bribe should accept the token.

### `addStrategy(address,uint8,(uint256,uint256,uint256,uint256))`

```solidity
function addStrategy(contract IERC20 paymentToken, enum Strategy.Kind kind, struct Strategy.Config config) external returns (address strategyAddress, address bribeAddress, address bribeRouterAddress);
```

Creates a Strategy, its Bribe, and its BribeRouter as one Voter-controlled graph.

**Parameters**

- `config`: Immutable auction configuration.
- `kind`: Whether the Strategy acquires an asset or performs GBX buybacks.
- `paymentToken`: Asset buyers pay to fill the Strategy.

**Returns**

- `bribeAddress`: Bribe paired with the Strategy.
- `bribeRouterAddress`: BribeRouter paired with the Strategy and Bribe.
- `strategyAddress`: Newly deployed Strategy.

### `bribeBps()`

```solidity
function bribeBps() external view returns (uint256 arg0);
```

Share of acquisition payments streamed to voters, expressed in basis points.

### `bribeFactory()`

```solidity
function bribeFactory() external view returns (contract BribeFactory arg0);
```

Factory used to create one Bribe per Strategy.

### `bribeFor(address)`

```solidity
function bribeFor(address strategy) external view returns (address bribe);
```

Bribe associated with each Strategy.

### `bribeRouterFor(address)`

```solidity
function bribeRouterFor(address strategy) external view returns (address router);
```

BribeRouter associated with each Strategy.

### `claimRewards(address[])`

```solidity
function claimRewards(address[] requestedStrategies) external;
```

Claims rewards from the Bribes associated with `strategies` for the caller.

**Parameters**

- `requestedStrategies`: Strategies whose Bribes should pay the caller.

### `claimableRevenue(address)`

```solidity
function claimableRevenue(address strategy) external view returns (uint256 amount);
```

Indexed USDG available to distribute to each Strategy.

### `distribute(address)`

```solidity
function distribute(address strategy) external returns (uint256 amount);
```

Transfers a Strategy's indexed USDG allocation to that Strategy.

**Parameters**

- `strategy`: Strategy whose indexed revenue should be transferred.

**Returns**

- `amount`: Amount of USDG distributed.

### `distributeAll()`

```solidity
function distributeAll() external;
```

Distributes currently claimable revenue to every Strategy.

### `distributeRange(uint256,uint256)`

```solidity
function distributeRange(uint256 start, uint256 end) external;
```

Distributes revenue to a bounded half-open range of Strategies: `[start, end)`.

**Parameters**

- `end`: Exclusive index, capped at the current Strategy count.
- `start`: Inclusive index in the Strategy list.

### `fund()`

```solidity
function fund() external view returns (address arg0);
```

Treasury that receives zero-weight and disabled-Strategy revenue.

### `isStrategy(address)`

```solidity
function isStrategy(address strategy) external view returns (bool isValid);
```

Whether an address is a Voter-created Strategy.

### `isStrategyAlive(address)`

```solidity
function isStrategyAlive(address strategy) external view returns (bool isAlive);
```

Whether a Strategy remains eligible for future USDG.

### `killStrategy(address)`

```solidity
function killStrategy(address strategy) external;
```

Stops a Strategy from receiving future USDG; its already indexed revenue is returned to Fund.
Existing voter weights remain until their owners replace or reset them. Their dead-Strategy revenue share is routed to Fund whenever that Strategy's index is updated.

**Parameters**

- `strategy`: Strategy to disable permanently.

### `notifyRevenue(uint256)`

```solidity
function notifyRevenue(uint256 amount) external;
```

Pulls USDG from VoterRouter and adds it to the global revenue index.

**Parameters**

- `amount`: Amount of USDG to pull and index.

### `owner()`

```solidity
function owner() external view returns (address arg0);
```

Returns the address of the current owner.

### `paymentTokenFor(address)`

```solidity
function paymentTokenFor(address strategy) external view returns (address paymentToken);
```

Payment token required by each Strategy.

### `pendingRevenue(address)`

```solidity
function pendingRevenue(address strategy) external view returns (uint256 amount);
```

Returns revenue accrued since `strategy` was last updated.

**Parameters**

- `strategy`: Strategy whose uncheckpointed revenue is queried.

**Returns**

- `amount`: Revenue accrued since the Strategy's last index update.

### `renounceOwnership()`

```solidity
function renounceOwnership() external;
```

Leaves the contract without owner. It will not be possible to call `onlyOwner` functions. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby disabling any functionality that is only available to the owner.

### `reset()`

```solidity
function reset() external;
```

Clears every allocation immediately, allowing SignalGBX to be unstaked in the same transaction.

### `revenueIndex()`

```solidity
function revenueIndex() external view returns (uint256 arg0);
```

Cumulative USDG revenue per unit of voting weight.

### `setBribeBps(uint256)`

```solidity
function setBribeBps(uint256 newBribeBps) external;
```

Sets the acquisition payment share streamed to voters.

**Parameters**

- `newBribeBps`: New share in basis points, capped by `MAX_BRIBE_BPS`.

### `setVoterRouter(address)`

```solidity
function setVoterRouter(address voterRouter_) external;
```

Binds the sole VoterRouter revenue source once during deployment.

**Parameters**

- `voterRouter_`: VoterRouter address to bind permanently.

### `signalGBX()`

```solidity
function signalGBX() external view returns (contract IERC20 arg0);
```

Non-transferable staking receipt used as current voting power.

### `strategies()`

```solidity
function strategies() external view returns (address[] strategyList);
```

Returns all protocol Strategies in creation order.

**Returns**

- `strategyList`: Strategy addresses in creation order.

### `strategyFactory()`

```solidity
function strategyFactory() external view returns (contract StrategyFactory arg0);
```

Factory used to create Strategies and their BribeRouters.

### `strategyRevenueIndex(address)`

```solidity
function strategyRevenueIndex(address strategy) external view returns (uint256 index);
```

Global revenue index last accounted for each Strategy.

### `strategyWeight(address)`

```solidity
function strategyWeight(address strategy) external view returns (uint256 weight);
```

Total SignalGBX weight allocated to each Strategy.

### `totalWeight()`

```solidity
function totalWeight() external view returns (uint256 arg0);
```

Total SignalGBX weight currently allocated across all Strategies.

### `transferOwnership(address)`

```solidity
function transferOwnership(address newOwner) external;
```

Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.

### `updateStrategy(address)`

```solidity
function updateStrategy(address strategy) external;
```

Updates one Strategy's stored revenue without transferring it.

**Parameters**

- `strategy`: Strategy whose index checkpoint should advance.

### `usdg()`

```solidity
function usdg() external view returns (contract IERC20 arg0);
```

Revenue token distributed among Strategies.

### `vote(address[],uint256[])`

```solidity
function vote(address[] requestedStrategies, uint256[] relativeWeights) external;
```

Replaces the caller's complete allocation using relative weights.
Relative inputs are normalized against the caller's current SignalGBX balance. There is no epoch gate.

**Parameters**

- `relativeWeights`: Relative allocation assigned to each corresponding Strategy.
- `requestedStrategies`: Strategies to receive the caller's voting weight.

### `voterRouter()`

```solidity
function voterRouter() external view returns (address arg0);
```

Sole router authorized to notify USDG revenue.

### Events

#### `BribeBpsSet(uint256,uint256)`

```solidity
event BribeBpsSet(uint256 previousBps, uint256 newBps);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BribeRewardAdded(address,address,address)`

```solidity
event BribeRewardAdded(address indexed strategy, address indexed bribe, address indexed rewardToken);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnershipTransferred(address,address)`

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RevenueDistributed(address,address,uint256)`

```solidity
event RevenueDistributed(address indexed caller, address indexed strategy, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RevenueNotified(address,uint256)`

```solidity
event RevenueNotified(address indexed voterRouter, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyAdded(address,address,address,address,uint8)`

```solidity
event StrategyAdded(address indexed strategy, address indexed bribe, address indexed bribeRouter, address paymentToken, enum Strategy.Kind kind);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyKilled(address)`

```solidity
event StrategyKilled(address indexed strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `VoteCast(address,address,uint256)`

```solidity
event VoteCast(address indexed account, address indexed strategy, uint256 weight);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `VoteReset(address,address,uint256)`

```solidity
event VoteReset(address indexed account, address indexed strategy, uint256 weight);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `VoterRouterSet(address)`

```solidity
event VoterRouterSet(address indexed voterRouter);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `BribeBpsAboveMaximum(uint256)`

```solidity
error BribeBpsAboveMaximum(uint256 requested);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `DuplicateStrategy(address)`

```solidity
error DuplicateStrategy(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InexactRevenueTransfer(uint256,uint256)`

```solidity
error InexactRevenueTransfer(uint256 expected, uint256 received);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `LengthMismatch()`

```solidity
error LengthMismatch();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnableInvalidOwner(address)`

```solidity
error OwnableInvalidOwner(address owner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnableUnauthorizedAccount(address)`

```solidity
error OwnableUnauthorizedAccount(address account);
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

#### `StrategyAlreadyDead(address)`

```solidity
error StrategyAlreadyDead(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyNotFound(address)`

```solidity
error StrategyNotFound(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `UnauthorizedRevenueSource(address)`

```solidity
error UnauthorizedRevenueSource(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `VoterRouterAlreadySet(address)`

```solidity
error VoterRouterAlreadySet(address voterRouter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroAddress()`

```solidity
error ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroAmount()`

```solidity
error ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroTotalWeight()`

```solidity
error ZeroTotalWeight();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroVoteWeight(address)`

```solidity
error ZeroVoteWeight(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

## VoterRouter

Source: [`src/core/VoterRouter.sol`](../../packages/contracts/src/core/VoterRouter.sol)

Artifact: `out/VoterRouter.sol/VoterRouter.json`

Public ABI: 4 functions, 1 event, 5 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(contract IERC20 usdg_, address voter_);
```

Creates a fixed USDG route into `voter_`.

**Parameters**

- `usdg_`: USDG token forwarded by the router.
- `voter_`: Voter that receives and indexes routed USDG.

### `pendingRevenue()`

```solidity
function pendingRevenue() external view returns (uint256 amount);
```

Returns USDG waiting to be routed.

**Returns**

- `amount`: Current USDG balance of the router.

### `route()`

```solidity
function route() external returns (uint256 amount);
```

Routes the complete USDG balance to Voter.

**Returns**

- `amount`: Amount delivered to Voter in this call.

### `usdg()`

```solidity
function usdg() external view returns (contract IERC20 arg0);
```

USDG revenue token forwarded by this router.

### `voter()`

```solidity
function voter() external view returns (address arg0);
```

Voter that receives and indexes routed USDG.

### Events

#### `RevenueRouted(address,uint256)`

```solidity
event RevenueRouted(address indexed caller, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `NoRevenue()`

```solidity
error NoRevenue();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ReentrancyGuardReentrantCall()`

```solidity
error ReentrancyGuardReentrantCall();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RevenueRetained(uint256)`

```solidity
error RevenueRetained(uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeERC20FailedOperation(address)`

```solidity
error SafeERC20FailedOperation(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroAddress()`

```solidity
error ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

## IBribe

Source: [`src/core/interfaces/IBribe.sol`](../../packages/contracts/src/core/interfaces/IBribe.sol)

Artifact: `out/IBribe.sol/IBribe.json`

Public ABI: 3 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `left(address)`

```solidity
function left(address rewardToken) external view returns (uint256 amount);
```

Returns rewards remaining in a token's active stream.

**Parameters**

- `rewardToken`: Token whose active stream is queried.

**Returns**

- `amount`: Undistributed amount remaining in the stream.

### `notifyRewardAmount(address,uint256)`

```solidity
function notifyRewardAmount(address rewardToken, uint256 amount) external;
```

Starts or extends a reward stream.

**Parameters**

- `amount`: Amount pulled from the caller and added to the stream.
- `rewardToken`: Token to stream.

### `totalSupply()`

```solidity
function totalSupply() external view returns (uint256 weight);
```

Returns total virtual voting weight.

**Returns**

- `weight`: Total weight assigned to the Bribe.

## ICoreVoter

Source: [`src/core/interfaces/ICoreVoter.sol`](../../packages/contracts/src/core/interfaces/ICoreVoter.sol)

Artifact: `out/ICoreVoter.sol/ICoreVoter.json`

Public ABI: 4 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `accountUsedWeight(address)`

```solidity
function accountUsedWeight(address account) external view returns (uint256 usedWeight);
```

Returns voting weight currently allocated by an account.

**Parameters**

- `account`: Account whose allocation is queried.

**Returns**

- `usedWeight`: Voting weight currently assigned by `account`.

### `bribeBps()`

```solidity
function bribeBps() external view returns (uint256 shareBps);
```

Returns the acquisition payment share streamed to voters.

**Returns**

- `shareBps`: Reward share expressed in basis points.

### `bribeRouterFor(address)`

```solidity
function bribeRouterFor(address strategy) external view returns (address router);
```

Returns the reward router paired with a Strategy.

**Parameters**

- `strategy`: Strategy whose router is queried.

**Returns**

- `router`: BribeRouter paired with `strategy`.

### `notifyRevenue(uint256)`

```solidity
function notifyRevenue(uint256 amount) external;
```

Pulls and indexes newly routed USDG revenue.

**Parameters**

- `amount`: Amount of USDG to pull from the caller.

## IFund

Source: [`src/core/interfaces/IFund.sol`](../../packages/contracts/src/core/interfaces/IFund.sol)

Artifact: `out/IFund.sol/IFund.json`

Public ABI: 2 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `burnGBX(uint256)`

```solidity
function burnGBX(uint256 amount) external;
```

Burns GBX already held by the Fund.

**Parameters**

- `amount`: Amount of GBX to burn.

### `gbx()`

```solidity
function gbx() external view returns (address token);
```

Returns the GBX token backed by the Fund.

**Returns**

- `token`: GBX token address.

## ILiquidityPosition

Source: [`src/core/interfaces/ILiquidityPosition.sol`](../../packages/contracts/src/core/interfaces/ILiquidityPosition.sol)

Artifact: `out/ILiquidityPosition.sol/ILiquidityPosition.json`

Public ABI: 10 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `expectedPositionTokenId()`

```solidity
function expectedPositionTokenId() external view returns (uint256 tokenId);
```

Returns the precommitted PositionManager token ID.

**Returns**

- `tokenId`: Expected position token ID.

### `expectedTickLower()`

```solidity
function expectedTickLower() external view returns (int24 tickLower);
```

Returns the committed lower position tick.

**Returns**

- `tickLower`: Committed lower tick.

### `expectedTickUpper()`

```solidity
function expectedTickUpper() external view returns (int24 tickUpper);
```

Returns the committed upper position tick.

**Returns**

- `tickUpper`: Committed upper tick.

### `gbx()`

```solidity
function gbx() external view returns (address token);
```

Returns the canonical GBX token.

**Returns**

- `token`: Canonical GBX address.

### `poolKeyHash()`

```solidity
function poolKeyHash() external view returns (bytes32 keyHash);
```

Returns the hash of the complete canonical v4 PoolKey.

**Returns**

- `keyHash`: Canonical PoolKey hash.

### `positionDepositor()`

```solidity
function positionDepositor() external view returns (address depositor);
```

Returns the account expected to deliver the position NFT.

**Returns**

- `depositor`: Expected NFT depositor.

### `positionManager()`

```solidity
function positionManager() external view returns (address manager);
```

Returns the canonical Uniswap v4 PositionManager.

**Returns**

- `manager`: Canonical PositionManager address.

### `positionRecorded()`

```solidity
function positionRecorded() external view returns (bool recorded);
```

Returns whether this contract has already accepted its expected NFT.

**Returns**

- `recorded`: Whether the expected position was recorded.

### `usdg()`

```solidity
function usdg() external view returns (address token);
```

Returns the canonical USDG token.

**Returns**

- `token`: Canonical USDG address.

### `voterRouter()`

```solidity
function voterRouter() external view returns (address router);
```

Returns the immutable USDG fee router.

**Returns**

- `router`: VoterRouter address.

## IVoterRouter

Source: [`src/core/interfaces/IVoterRouter.sol`](../../packages/contracts/src/core/interfaces/IVoterRouter.sol)

Artifact: `out/IVoterRouter.sol/IVoterRouter.json`

Public ABI: 1 function, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `route()`

```solidity
function route() external returns (uint256 amount);
```

Routes the complete pending USDG balance to Voter.

**Returns**

- `amount`: Amount of USDG delivered to Voter.
