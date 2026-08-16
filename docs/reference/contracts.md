# Contract API reference

> Generated from Foundry artifacts by `packages/contracts/scripts/generate-contract-docs.mjs`. Do not edit by
> hand. Run `pnpm docs:generate` after changing a public Solidity surface or NatSpec.

Compiler artifact versions: `0.8.26+commit.8a97fa7a`.

Documented source surfaces: 22. Documented ABI entries: 594. Documented public ABI functions: 315.

## Bribe

Source: [`src/core/Bribe.sol`](../../packages/contracts/src/core/Bribe.sol)

Artifact: `out/Bribe.sol/Bribe.json`

Public ABI: 34 functions, 12 events, 13 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address)`

```solidity
constructor(address resonance_);
```

Creates a bounded reward stream controlled by one Resonance.

**Parameters**

- `resonance_`: Resonance exclusively authorized to maintain virtual balances.

### `MAX_REWARD_TOKENS()`

```solidity
function MAX_REWARD_TOKENS() external view returns (uint256 arg0);
```

Immutable upper bound on append-only reward tokens and every mandatory reward loop.

### `REWARD_DURATION()`

```solidity
function REWARD_DURATION() external view returns (uint256 arg0);
```

Fixed duration assigned to each independently started reward stream.

### `REWARD_PRECISION()`

```solidity
function REWARD_PRECISION() external view returns (uint256 arg0);
```

Fixed-point scale used to preserve sub-token reward allocation across checkpoints.

### `accountedRewardBalance(address)`

```solidity
function accountedRewardBalance(address token) external view returns (uint256 amount);
```

Exact supported-token balance notified minus completed user and Fund payouts.

### `accruedRewardLiability(address)`

```solidity
function accruedRewardLiability(address token) external view returns (uint256 amount);
```

Aggregate whole-token user liability represented by `rewards` for each token.

### `addRewardToken(address)`

```solidity
function addRewardToken(address rewardToken) external;
```

Registers another append-only reward token through Resonance governance.

**Parameters**

- `rewardToken`: Token to register.

### `balanceOf(address)`

```solidity
function balanceOf(address account) external view returns (uint256 balance);
```

Virtual signal weight assigned to each account by Resonance.

### `claimReward(address,address)`

```solidity
function claimReward(address account, address rewardToken) external returns (uint256 amount);
```

Claims one registered reward token for `account` without touching any other reward token.
Anyone may trigger the claim, but payment can only reach the entitled account.

**Parameters**

- `account`: Entitled account.
- `rewardToken`: Registered token to claim.

**Returns**

- `amount`: Exact amount paid.

### `claimRewards(address)`

```solidity
function claimRewards(address account) external;
```

Claims every registered reward token earned by `account`.
This bounded convenience path may fail on a broken selected token; scalar claims remain independent.

**Parameters**

- `account`: Account whose accrued rewards are paid.

### `claimRewards(address,address[])`

```solidity
function claimRewards(address account, address[] rewardTokens_) external;
```

Claims a caller-selected bounded set of reward tokens for `account`.
Duplicate or unregistered selections revert deterministically before any token interaction.

**Parameters**

- `account`: Entitled account.
- `rewardTokens_`: Registered unique tokens to claim.

### `deposit(uint256,address)`

```solidity
function deposit(uint256 amount, address account) external;
```

Adds virtual signal weight for `account` after checkpointing all bounded reward state.

**Parameters**

- `account`: Account whose virtual balance increases.
- `amount`: Weight to add.

### `earned(address,address)`

```solidity
function earned(address account, address rewardToken) external view returns (uint256 amount);
```

Returns whole rewards currently claimable by one account for one token.

**Parameters**

- `account`: Account whose rewards are queried.
- `rewardToken`: Registered reward token.

**Returns**

- `amount`: Whole-token accrued amount, including previewed stream progress.

### `fund()`

```solidity
function fund() external view returns (address arg0);
```

Fixed treasury destination derived once from Resonance for rounding liabilities that outlive all signalers.

### `fundRewardLiability(address)`

```solidity
function fundRewardLiability(address token) external view returns (uint256 amount);
```

Whole-token reward liability irrevocably owed to the immutable Fund.

### `fundRewardRemainder(address)`

```solidity
function fundRewardRemainder(address token) external view returns (uint256 scaledRemainder);
```

Sub-token Fund precision carried until it combines into another payable whole unit.

### `indexedRewardScaled(address)`

```solidity
function indexedRewardScaled(address token) external view returns (uint256 scaledAmount);
```

Reward precision allocated globally but not yet checkpointed into individual account state.

### `isRewardToken(address)`

```solidity
function isRewardToken(address token) external view returns (bool isReward);
```

Append-only membership flag for tokens governance registered through Resonance.

### `lastTimeRewardApplicable(address)`

```solidity
function lastTimeRewardApplicable(address rewardToken) external view returns (uint256 timestamp);
```

Returns the last timestamp currently eligible to advance the active stream.

**Parameters**

- `rewardToken`: Token whose stream is queried.

**Returns**

- `timestamp`: Active time capped at finish, or the pause timestamp while supply is zero.

### `left(address)`

```solidity
function left(address rewardToken) external view returns (uint256 amount);
```

Returns exact whole tokens remaining in the active stream, excluding its independent queue.

**Parameters**

- `rewardToken`: Token whose active schedule is queried.

**Returns**

- `amount`: Remaining active-stream amount.

### `notifyRewardAmount(address,uint256)`

```solidity
function notifyRewardAmount(address rewardToken, uint256 amount) external;
```

Funds an exact seven-day stream or queues behind the currently active stream.
Live-stream notifications never restart or extend existing rewards, preventing repeated tiny top-up griefing.

**Parameters**

- `amount`: Exact amount pulled from the caller.
- `rewardToken`: Registered token to fund.

### `payFundReward(address)`

```solidity
function payFundReward(address rewardToken) external returns (uint256 amount);
```

Pays one token's whole Fund-bound liability to the immutable Fund.
State clears before interaction; a failed token transfer atomically restores the complete liability.

**Parameters**

- `rewardToken`: Registered reward token to pay.

**Returns**

- `amount`: Exact amount paid.

### `pendingRewardScaled(address)`

```solidity
function pendingRewardScaled(address token) external view returns (uint256 scaledAmount);
```

Emitted reward precision not yet large enough for another reward-per-token increment.

### `queuedRewards(address)`

```solidity
function queuedRewards(address token) external view returns (uint256 amount);
```

Whole-token notifications waiting for the current stream to finish or for signal supply to become nonzero.

### `resonance()`

```solidity
function resonance() external view returns (address arg0);
```

Resonance exclusively authorized to maintain virtual balances and register reward assets.

### `rewardData(address)`

```solidity
function rewardData(address token) external view returns (uint256 periodFinish, uint256 remainderFinish, uint256 rewardRate, uint256 lastUpdateTime, uint256 rewardPerTokenStored, uint256 pauseStarted);
```

Independent exact stream state for every registered reward token.

### `rewardPerToken(address)`

```solidity
function rewardPerToken(address rewardToken) external view returns (uint256 accumulatedReward);
```

Returns the exact previewed cumulative reward per virtual signal unit.

**Parameters**

- `rewardToken`: Token whose cumulative index is queried.

**Returns**

- `accumulatedReward`: Cumulative reward per weight scaled by `REWARD_PRECISION`.

### `rewardSurplus(address)`

```solidity
function rewardSurplus(address rewardToken) external view returns (uint256 amount);
```

Returns direct token balance not introduced through the notification accounting path.
Direct donation surplus is classified but intentionally unscheduled and has no privileged recovery path.

**Parameters**

- `rewardToken`: Token whose surplus is queried.

**Returns**

- `amount`: Direct-donation surplus.

### `rewardTokens()`

```solidity
function rewardTokens() external view returns (address[] tokens);
```

Returns all registered reward tokens in immutable insertion order.

**Returns**

- `tokens`: Registered reward tokens.

### `rewards(address,address)`

```solidity
function rewards(address account, address token) external view returns (uint256 amount);
```

Whole-token accrued user liability, payable only to the entitled account.

### `scheduledRewards(address)`

```solidity
function scheduledRewards(address token) external view returns (uint256 amount);
```

Active-stream whole-token amount not yet moved into scaled reward allocation.

### `totalSupply()`

```solidity
function totalSupply() external view returns (uint256 arg0);
```

Total virtual signal weight assigned to this Bribe.

### `userRewardPerTokenPaid(address,address)`

```solidity
function userRewardPerTokenPaid(address account, address token) external view returns (uint256 paid);
```

Cumulative reward index already incorporated for one account and token.

### `userRewardRemainder(address,address)`

```solidity
function userRewardRemainder(address account, address token) external view returns (uint256 scaledRemainder);
```

Sub-token scaled user accrual retained across checkpoints instead of rounded away.

### `withdraw(uint256,address)`

```solidity
function withdraw(uint256 amount, address account) external;
```

Removes virtual signal weight after accounting only; no reward token is called or transferred.

**Parameters**

- `account`: Account whose virtual balance decreases.
- `amount`: Weight to remove.

### Events

#### `FundRewardAccrued(address,uint256,uint256)`

```solidity
event FundRewardAccrued(address indexed rewardToken, uint256 amount, uint256 totalLiability);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `FundRewardPaid(address,address,address,uint256)`

```solidity
event FundRewardPaid(address indexed caller, address indexed fund, address indexed rewardToken, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RewardAdded(address)`

```solidity
event RewardAdded(address indexed rewardToken);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RewardCarryFunded(address,uint256,uint256)`

```solidity
event RewardCarryFunded(address indexed rewardToken, uint256 amountScaled, uint256 remainderScaled);
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

#### `RewardQueued(address,uint256,uint256)`

```solidity
event RewardQueued(address indexed rewardToken, uint256 amount, uint256 totalQueued);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RewardStreamPaused(address,uint256)`

```solidity
event RewardStreamPaused(address indexed rewardToken, uint256 pausedAt);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RewardStreamResumed(address,uint256,uint256)`

```solidity
event RewardStreamResumed(address indexed rewardToken, uint256 resumedAt, uint256 pausedDuration);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RewardStreamStarted(address,uint256,uint256,uint256,uint256,uint256)`

```solidity
event RewardStreamStarted(address indexed rewardToken, uint256 amount, uint256 startedAt, uint256 periodFinish, uint256 rewardRate, uint256 rateRemainder);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SignalWeightDeposited(address,uint256)`

```solidity
event SignalWeightDeposited(address indexed account, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SignalWeightWithdrawn(address,uint256)`

```solidity
event SignalWeightWithdrawn(address indexed account, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `DuplicateRewardToken(address)`

```solidity
error DuplicateRewardToken(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InexactRewardPayout(address,uint256,uint256,uint256)`

```solidity
error InexactRewardPayout(address receiver, uint256 expected, uint256 senderDebit, uint256 receiverCredit);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InexactRewardTransfer(uint256,uint256,uint256)`

```solidity
error InexactRewardTransfer(uint256 expected, uint256 senderDebit, uint256 receiverCredit);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `NotResonance(address)`

```solidity
error NotResonance(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `NotRewardToken(address)`

```solidity
error NotRewardToken(address token);
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

#### `RewardBalanceDeficit(address,uint256,uint256)`

```solidity
error RewardBalanceDeficit(address token, uint256 accounted, uint256 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RewardScaleOverflow(address,uint256)`

```solidity
error RewardScaleOverflow(address token, uint256 balance);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RewardTokenLimitReached(uint256)`

```solidity
error RewardTokenLimitReached(uint256 maximum);
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

Public ABI: 6 functions, 3 events, 6 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address)`

```solidity
constructor(address initialOwner);
```

Creates an unbound factory whose owner may set Resonance exactly once.

**Parameters**

- `initialOwner`: Deployment-time owner responsible for binding Resonance.

### `createBribe()`

```solidity
function createBribe() external returns (contract Bribe bribe);
```

Deploys a Bribe controlled by the bound Resonance.

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

### `resonance()`

```solidity
function resonance() external view returns (address arg0);
```

Resonance exclusively authorized to create Bribes.

### `setResonance(address)`

```solidity
function setResonance(address resonance_) external;
```

Binds the only Resonance allowed to deploy Bribes after reciprocal factory validation.

**Parameters**

- `resonance_`: Resonance address to bind permanently.

### `transferOwnership(address)`

```solidity
function transferOwnership(address newOwner) external;
```

Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.

### Events

#### `BribeCreated(address,address)`

```solidity
event BribeCreated(address indexed bribe, address indexed resonance);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnershipTransferred(address,address)`

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ResonanceSet(address)`

```solidity
event ResonanceSet(address indexed resonance);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `InvalidResonance(address)`

```solidity
error InvalidResonance(address resonance);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `NotResonance(address)`

```solidity
error NotResonance(address caller);
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

#### `ResonanceAlreadySet(address)`

```solidity
error ResonanceAlreadySet(address resonance);
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

Public ABI: 15 functions, 5 events, 7 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address)`

```solidity
constructor(address strategy_, contract Bribe bribe_, contract IERC20 paymentToken_, address fund_);
```

Creates the fixed route between one Strategy, payment token, Bribe, and Fund.

**Parameters**

- `bribe_`: Independently fundable Bribe paired with the Strategy.
- `fund_`: Treasury receiving the fixed 90% share of cumulative completed payments.
- `paymentToken_`: Strategy payment token.
- `strategy_`: Strategy exclusively allowed to route payments.

### `BPS()`

```solidity
function BPS() external view returns (uint256 arg0);
```

Denominator for the immutable payment split.

### `BRIBE_BPS()`

```solidity
function BRIBE_BPS() external view returns (uint256 arg0);
```

Basis points of cumulative Strategy payments classified to the paired Bribe.

### `FUND_BPS()`

```solidity
function FUND_BPS() external view returns (uint256 arg0);
```

Basis points of cumulative Strategy payments classified to Fund.

### `accountedPaymentBalance()`

```solidity
function accountedPaymentBalance() external view returns (uint256 arg0);
```

Exact payment-token balance pulled from Strategy minus completed Fund and Bribe settlements.

### `bribe()`

```solidity
function bribe() external view returns (contract Bribe arg0);
```

Bribe paired with the Strategy and fixed as the automatic 10% reward destination.

### `bribePaymentLiability()`

```solidity
function bribePaymentLiability() external view returns (uint256 arg0);
```

Payment-token amount irrevocably owed to the paired Bribe and not yet notified.

### `fund()`

```solidity
function fund() external view returns (address arg0);
```

Immutable treasury destination for the 90% Fund-classified share.

### `fundPaymentLiability()`

```solidity
function fundPaymentLiability() external view returns (uint256 arg0);
```

Payment-token amount irrevocably owed to Fund and payable by any caller.

### `notifyBribeReward()`

```solidity
function notifyBribeReward() external returns (uint256 amount);
```

Notifies the complete paired-Bribe liability as an acquired-asset reward.
State clears before interaction; any failure atomically restores this leg without altering Fund liability.

**Returns**

- `amount`: Exact reward amount notified.

### `payFundPayment()`

```solidity
function payFundPayment() external returns (uint256 amount);
```

Pays the complete fixed payment liability to the immutable Fund.
State clears before interaction; a failed transfer atomically restores the liability.

**Returns**

- `amount`: Exact amount paid.

### `paymentSurplus()`

```solidity
function paymentSurplus() external view returns (uint256 amount);
```

Returns direct payment-token donations outside Strategy-supplied accounting.

**Returns**

- `amount`: Unaccounted direct-donation surplus.

### `paymentToken()`

```solidity
function paymentToken() external view returns (contract IERC20 arg0);
```

Strategy payment token routed by this contract.

### `routePayment(uint256)`

```solidity
function routePayment(uint256 amount) external;
```

Pulls one complete auction payment and cumulatively classifies its fixed 90/10 liabilities.

**Parameters**

- `amount`: Exact payment-token amount to pull.

### `splitRemainder()`

```solidity
function splitRemainder() external view returns (uint256 arg0);
```

Sub-token Bribe entitlement in basis-point numerator units, always smaller than `BPS`.

### `strategy()`

```solidity
function strategy() external view returns (address arg0);
```

Strategy exclusively authorized to supply completed auction payments.

### Events

#### `BribePaymentAccrued(address,address,uint256,uint256,uint256)`

```solidity
event BribePaymentAccrued(address indexed bribe, address indexed paymentToken, uint256 amount, uint256 totalLiability, uint256 remainder);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BribeRewardNotified(address,address,address,uint256)`

```solidity
event BribeRewardNotified(address indexed caller, address indexed bribe, address indexed paymentToken, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `FundPaymentAccrued(address,address,uint256,uint256)`

```solidity
event FundPaymentAccrued(address indexed fund, address indexed paymentToken, uint256 amount, uint256 totalLiability);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `FundPaymentPaid(address,address,address,uint256)`

```solidity
event FundPaymentPaid(address indexed caller, address indexed fund, address indexed paymentToken, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PaymentRouted(address,uint256)`

```solidity
event PaymentRouted(address indexed strategy, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `InexactTransfer(uint256,uint256,uint256)`

```solidity
error InexactTransfer(uint256 expected, uint256 senderDebit, uint256 receiverCredit);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `NotStrategy(address)`

```solidity
error NotStrategy(address caller);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PaymentBalanceDeficit(uint256,uint256)`

```solidity
error PaymentBalanceDeficit(uint256 accounted, uint256 actual);
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

Public ABI: 4 functions, 2 events, 10 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address)`

```solidity
constructor(contract GBX gbx_);
```

Creates the ownerless, registry-free treasury backing `gbx_`.

**Parameters**

- `gbx_`: GBX token backed by this Fund.

### `burnGBX(uint256)`

```solidity
function burnGBX(uint256 amount) external;
```

Burns GBX already held by Fund, including GBX received from a Strategy payment.

**Parameters**

- `amount`: Amount of GBX to burn.

### `gbx()`

```solidity
function gbx() external view returns (contract GBX arg0);
```

GBX token burned by redemptions and permissionless maintenance.

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

### Events

#### `GBXBurned(address,uint256)`

```solidity
event GBXBurned(address indexed caller, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Redeemed(address,address,uint256,uint256)`

```solidity
event Redeemed(address indexed account, address indexed receiver, uint256 gbxAmount, uint256 tokenCount);
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

#### `InexactTransfer(address,uint256,uint256,uint256)`

```solidity
error InexactTransfer(address token, uint256 expected, uint256 fundDebit, uint256 receiverCredit);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidMine(address)`

```solidity
error InvalidMine(address mine);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidReceiver(address)`

```solidity
error InvalidReceiver(address receiver);
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

#### `SelectedBalanceDecreased(address,uint256,uint256)`

```solidity
error SelectedBalanceDecreased(address token, uint256 expectedMinimum, uint256 currentBalance);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroAmount()`

```solidity
error ZeroAmount();
```

_No additional NatSpec notice is present in the compiled artifact._

## GBX

Source: [`src/core/GBX.sol`](../../packages/contracts/src/core/GBX.sol)

Artifact: `out/GBX.sol/GBX.json`

Public ABI: 21 functions, 6 events, 22 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(address genesisLiquidityRecipient, address initialMinter);
```

Creates the genesis-liquidity allocation and temporary deployment-time mint authority.

### `DOMAIN_SEPARATOR()`

```solidity
function DOMAIN_SEPARATOR() external view returns (bytes32 arg0);
```

Returns the domain separator used in the encoding of the signature for {permit}, as defined by {EIP712}.

### `GENESIS_LIQUIDITY_ALLOCATION()`

```solidity
function GENESIS_LIQUIDITY_ALLOCATION() external view returns (uint256 arg0);
```

GBX created once for the canonical genesis-liquidity position.

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

### `lifetimeBurned()`

```solidity
function lifetimeBurned() external view returns (uint256 arg0);
```

Cumulative GBX permanently destroyed.

### `lifetimeMinted()`

```solidity
function lifetimeMinted() external view returns (uint256 arg0);
```

Cumulative GBX created, including the genesis allocation.

### `mint(address,uint256)`

```solidity
function mint(address account, uint256 amount) external;
```

Mints GBX through the permanently selected Mine.

### `minter()`

```solidity
function minter() external view returns (address arg0);
```

Current mint authority; permanently becomes the canonical Mine after setup.

### `minterLocked()`

```solidity
function minterLocked() external view returns (bool arg0);
```

Whether the one-time Mine handoff has permanently completed.

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

### `setMinter(address)`

```solidity
function setMinter(address newMinter) external;
```

Permanently hands mint authority to the canonical Mine after reciprocal GBX identity validation.

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

#### `AddressHasNoCode(address)`

```solidity
error AddressHasNoCode(address account);
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

#### `InvalidAccountNonce(address,uint256)`

```solidity
error InvalidAccountNonce(address account, uint256 currentNonce);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidMine(address)`

```solidity
error InvalidMine(address mine);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidShortString()`

```solidity
error InvalidShortString();
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

## ILiquidityRevenueRouter

Source: [`src/core/LiquidityPosition.sol`](../../packages/contracts/src/core/LiquidityPosition.sol)

Artifact: `out/LiquidityPosition.sol/ILiquidityRevenueRouter.json`

Public ABI: 2 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `route()`

```solidity
function route() external returns (uint256 amount);
```

Routes the complete nonzero pending USDG balance into Resonance.

**Returns**

- `amount`: Amount delivered to Resonance.

### `usdg()`

```solidity
function usdg() external view returns (contract IERC20 token);
```

Canonical USDG token accepted by the router.

**Returns**

- `token`: Canonical USDG token.

## LiquidityPosition

Source: [`src/core/LiquidityPosition.sol`](../../packages/contracts/src/core/LiquidityPosition.sol)

Artifact: `out/LiquidityPosition.sol/LiquidityPosition.json`

Public ABI: 20 functions, 2 events, 20 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor((address,address,uint256,address,address,address,address),(address,address,uint24,int24,address),int24,int24)`

```solidity
constructor(struct LiquidityPosition.Dependencies dependencies, struct PoolKey canonicalPoolKey, int24 tickLower, int24 tickUpper);
```

Fixes the exact v4 pool, range, and NFT permanently.

**Parameters**

- `canonicalPoolKey`: Exact hookless GBX/USDG pool identity.
- `dependencies`: Immutable protocol and PositionManager dependencies.
- `tickLower`: Expected lower tick of the precommitted single-sided position.
- `tickUpper`: Expected upper tick of the precommitted single-sided position.

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

### `fund()`

```solidity
function fund() external view returns (contract IFund arg0);
```

Ownerless Fund that receives and burns harvested GBX.

### `gbx()`

```solidity
function gbx() external view returns (contract GBX arg0);
```

GBX side of the canonical pool.

### `harvestFees()`

```solidity
function harvestFees() external returns (uint256 usdgRouted, uint256 gbxBurned);
```

Collects every accrued LP fee while preserving principal, routes USDG, and burns GBX.
`DECREASE_LIQUIDITY` with zero liquidity is Uniswap v4 PositionManager's fee-collection path. The two `CLOSE_CURRENCY` actions take the complete fee credits into this contract without removing principal. Any direct canonical-token donation is intentionally processed with the same destination on the next harvest. Routing and burn are atomic with collection: any failure restores the position's fee accounting.

**Returns**

- `gbxBurned`: Complete GBX balance sent to Fund and burned.
- `usdgRouted`: Complete USDG balance routed through ResonanceRouter.

### `onERC721Received(address,address,uint256,bytes)`

```solidity
function onERC721Received(address operator, address from, uint256 tokenId, bytes data) external returns (bytes4 selector);
```

Records and validates the first and only accepted PositionManager NFT.
The ERC-721 operator and data parameters are intentionally ignored; only the fixed manager, depositor, token ID, pool key, hookless configuration, ticks, fee, and custody state authorize acceptance.

**Parameters**

- `data`: Optional transfer data; ignored.
- `from`: Previous position owner.
- `operator`: Account that initiated the safe transfer; not used for authorization.
- `tokenId`: PositionManager token ID.

**Returns**

- `selector`: ERC-721 receiver acceptance selector.

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

### `resonanceRouter()`

```solidity
function resonanceRouter() external view returns (contract ILiquidityRevenueRouter arg0);
```

Immutable permissionless USDG route into Resonance.

### `tickSpacing()`

```solidity
function tickSpacing() external view returns (int24 arg0);
```

Tick spacing of the canonical pool.

### `usdg()`

```solidity
function usdg() external view returns (contract IERC20 arg0);
```

USDG side of the canonical pool.

### Events

#### `FeesHarvested(uint256,address,uint128,uint256,uint256)`

```solidity
event FeesHarvested(uint256 indexed positionTokenId, address indexed caller, uint128 principalLiquidity, uint256 usdgRouted, uint256 gbxBurned);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `PositionRecorded(uint256,address,bytes32)`

```solidity
event PositionRecorded(uint256 indexed positionTokenId, address indexed previousOwner, bytes32 indexed poolKeyHash);
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

#### `InexactTransfer(address,address,uint256,uint256,uint256)`

```solidity
error InexactTransfer(address token, address destination, uint256 expected, uint256 debit, uint256 credit);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidDestinationToken(address,address,address)`

```solidity
error InvalidDestinationToken(address destination, address expected, address actual);
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

#### `PrincipalLiquidityChanged(uint128,uint128)`

```solidity
error PrincipalLiquidityChanged(uint128 expected, uint128 actual);
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

## IRevenueRouterIdentity

Source: [`src/core/Mine.sol`](../../packages/contracts/src/core/Mine.sol)

Artifact: `out/Mine.sol/IRevenueRouterIdentity.json`

Public ABI: 2 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `route()`

```solidity
function route() external returns (uint256 amount);
```

Routes the complete nonzero pending USDG balance into Resonance.

**Returns**

- `amount`: Amount delivered to Resonance.

### `usdg()`

```solidity
function usdg() external view returns (contract IERC20 token);
```

Returns the exact USDG token forwarded by the router.

## Mine

Source: [`src/core/Mine.sol`](../../packages/contracts/src/core/Mine.sol)

Artifact: `out/Mine.sol/Mine.json`

Public ABI: 39 functions, 7 events, 20 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,(uint256,uint256,uint256,uint256,uint256))`

```solidity
constructor(contract GBX gbx_, contract IERC20 usdg_, address resonanceRouter_, address initialOwner, struct Mine.Config config);
```

Creates the immutable mining market with one empty slot.

**Parameters**

- `config`: Immutable price and future-handoff emission configuration.
- `gbx_`: GBX token that will permanently bind this contract as minter.
- `initialOwner`: Timelock or setup owner allowed only to increase capacity.
- `resonanceRouter_`: Router receiving the protocol share of replacement payments.
- `usdg_`: Exact-transfer token paid by incoming miners.

### `BPS()`

```solidity
function BPS() external view returns (uint256 arg0);
```

Basis-point denominator used by the replacement payment split.

### `MAX_CAPACITY()`

```solidity
function MAX_CAPACITY() external view returns (uint256 arg0);
```

Immutable upper bound on concurrently open mining slots.

### `MAX_HALVING_AMOUNT()`

```solidity
function MAX_HALVING_AMOUNT() external view returns (uint256 arg0);
```

Largest supported cumulative mining amount for the first halving.

### `MAX_INITIAL_PRICE()`

```solidity
function MAX_INITIAL_PRICE() external view returns (uint256 arg0);
```

Largest supported initial USDG price.

### `MAX_INITIAL_UPS()`

```solidity
function MAX_INITIAL_UPS() external view returns (uint256 arg0);
```

Largest constructor-supported initial global GBX-per-second rate.

### `MAX_PRICE_MULTIPLIER()`

```solidity
function MAX_PRICE_MULTIPLIER() external view returns (uint256 arg0);
```

Largest constructor-supported next-price multiplier.

### `MIN_HALVING_AMOUNT()`

```solidity
function MIN_HALVING_AMOUNT() external view returns (uint256 arg0);
```

Smallest supported cumulative mining amount for the first halving.

### `MIN_INITIAL_PRICE()`

```solidity
function MIN_INITIAL_PRICE() external view returns (uint256 arg0);
```

Smallest constructor-supported initial USDG price.

### `MIN_PRICE_MULTIPLIER()`

```solidity
function MIN_PRICE_MULTIPLIER() external view returns (uint256 arg0);
```

Smallest constructor-supported next-price multiplier.

### `MIN_TAIL_UPS()`

```solidity
function MIN_TAIL_UPS() external view returns (uint256 arg0);
```

Smallest tail rate that keeps a new slot positive at maximum capacity.

### `PREVIOUS_MINER_BPS()`

```solidity
function PREVIOUS_MINER_BPS() external view returns (uint256 arg0);
```

Share of a nonempty-slot payment owed to the displaced miner.

### `PRICE_DECAY_PERIOD()`

```solidity
function PRICE_DECAY_PERIOD() external view returns (uint256 arg0);
```

Time over which a slot replacement price decays linearly to zero.

### `PRICE_PRECISION()`

```solidity
function PRICE_PRECISION() external view returns (uint256 arg0);
```

Fixed-point precision used by the next-price multiplier.

### `capacity()`

```solidity
function capacity() external view returns (uint256 arg0);
```

Number of open slot indices; begins at one and only increases.

### `checkpointAll()`

```solidity
function checkpointAll() external returns (uint256 amount);
```

Mints every live slot's accrued GBX without changing any occupied slot's assigned rate.
Anyone may checkpoint. Fund calls this atomically before every redemption supply snapshot.

### `claim(address)`

```solidity
function claim(address account) external;
```

Claims accumulated USDG replacement payments for an account.
Anyone may trigger a claim, but payment always goes to `account`.

### `claimable(address)`

```solidity
function claimable(address account) external view returns (uint256 amount);
```

USDG pull claim owed to each displaced miner.

### `effectiveTotalSupply()`

```solidity
function effectiveTotalSupply() external view returns (uint256 amount);
```

Returns minted GBX supply plus all live slots' accrued unminted rewards.

### `gbx()`

```solidity
function gbx() external view returns (contract GBX arg0);
```

GBX token issued by this Mine after the permanent handoff.

### `getSlot(uint256)`

```solidity
function getSlot(uint256 index) external view returns (struct Mine.Slot slot);
```

Returns the complete state of one current slot.

### `halvingAmount()`

```solidity
function halvingAmount() external view returns (uint256 arg0);
```

Cumulative mining amount at the first future-handoff rate halving.

### `increaseCapacity(uint256)`

```solidity
function increaseCapacity(uint256 newCapacity) external;
```

Permanently opens more concurrent slots without repricing any occupied slot.

### `initialUps()`

```solidity
function initialUps() external view returns (uint256 arg0);
```

Initial global GBX-per-second rate offered to future handoffs.

### `mine(address,uint256,uint256,uint256,uint256)`

```solidity
function mine(address miner, uint256 index, uint256 epochId, uint256 deadline, uint256 maximumPrice) external returns (uint256 paid);
```

Replaces one slot's miner at its current linearly decaying USDG price.

**Parameters**

- `deadline`: Latest timestamp at which this transaction may execute.
- `epochId`: Expected slot epoch used for frontrun protection.
- `index`: Slot index below current capacity.
- `maximumPrice`: Maximum USDG price accepted by the payer.
- `miner`: Account that receives subsequent GBX emissions for the slot.

**Returns**

- `paid`: Actual USDG price paid.

### `minimumInitialPrice()`

```solidity
function minimumInitialPrice() external view returns (uint256 arg0);
```

Immutable lower bound for every next slot opening price.

### `nextGlobalUps()`

```solidity
function nextGlobalUps() external view returns (uint256 ups);
```

Returns the global rate that would apply immediately after a checkpoint.

### `owner()`

```solidity
function owner() external view returns (address arg0);
```

Returns the address of the current owner.

### `pendingEmission()`

```solidity
function pendingEmission() external view returns (uint256 amount);
```

Returns accrued unminted GBX across every live slot.

### `pendingEmission(uint256)`

```solidity
function pendingEmission(uint256 index) external view returns (uint256 amount);
```

Returns accrued unminted GBX for one live slot.

### `price(uint256)`

```solidity
function price(uint256 index) external view returns (uint256 amount);
```

Returns the current USDG replacement price for one slot.

### `priceMultiplier()`

```solidity
function priceMultiplier() external view returns (uint256 arg0);
```

Immutable multiplier used to derive a slot's next opening price.

### `renounceOwnership()`

```solidity
function renounceOwnership() external;
```

Leaves the contract without owner. It will not be possible to call `onlyOwner` functions. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby disabling any functionality that is only available to the owner.

### `resonanceRouter()`

```solidity
function resonanceRouter() external view returns (address arg0);
```

Permissionless router that receives mining revenue.

### `slots(uint256)`

```solidity
function slots(uint256 index) external view returns (uint256 epochId, uint256 initialPrice, uint256 auctionStartedAt, uint256 lastAccruedAt, uint256 ups, address miner);
```

Current state of each mining slot index.

### `tailUps()`

```solidity
function tailUps() external view returns (uint256 arg0);
```

Strictly positive global GBX-per-second rate floor.

### `totalClaimable()`

```solidity
function totalClaimable() external view returns (uint256 arg0);
```

Total USDG currently owed to displaced miners.

### `totalMined()`

```solidity
function totalMined() external view returns (uint256 arg0);
```

Cumulative GBX minted through slot checkpoints.

### `transferOwnership(address)`

```solidity
function transferOwnership(address newOwner) external;
```

Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.

### `usdg()`

```solidity
function usdg() external view returns (contract IERC20 arg0);
```

Exact-transfer USDG token used for replacement payments.

### Events

#### `CapacityIncreased(uint256,uint256)`

```solidity
event CapacityIncreased(uint256 previousCapacity, uint256 newCapacity);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Claimed(address,uint256)`

```solidity
event Claimed(address indexed account, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EmissionCheckpointed(address,uint256,uint256,uint256)`

```solidity
event EmissionCheckpointed(address indexed miner, uint256 indexed index, uint256 indexed epochId, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Mined(address,address,uint256,uint256,address,uint256,uint256,uint256)`

```solidity
event Mined(address indexed payer, address indexed miner, uint256 indexed index, uint256 epochId, address previousMiner, uint256 price, uint256 initialPrice, uint256 ups);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MinerPaymentAccrued(address,uint256,uint256,uint256)`

```solidity
event MinerPaymentAccrued(address indexed miner, uint256 indexed index, uint256 indexed epochId, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `OwnershipTransferred(address,address)`

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RevenueRouted(uint256,uint256,uint256)`

```solidity
event RevenueRouted(uint256 indexed index, uint256 indexed epochId, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `CapacityNotIncreased(uint256,uint256)`

```solidity
error CapacityNotIncreased(uint256 currentCapacity, uint256 requestedCapacity);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `CapacityTooHigh(uint256)`

```solidity
error CapacityTooHigh(uint256 requestedCapacity);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `DeadlinePassed(uint256)`

```solidity
error DeadlinePassed(uint256 deadline);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `EpochIdMismatch(uint256,uint256)`

```solidity
error EpochIdMismatch(uint256 expected, uint256 actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `HalvingAmountOutOfRange(uint256)`

```solidity
error HalvingAmountOutOfRange(uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `IndexOutOfBounds(uint256)`

```solidity
error IndexOutOfBounds(uint256 index);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InexactTransfer(uint256,uint256,uint256)`

```solidity
error InexactTransfer(uint256 expected, uint256 senderDebit, uint256 receiverCredit);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InitialPriceOutOfRange(uint256)`

```solidity
error InitialPriceOutOfRange(uint256 price);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InitialUpsOutOfRange(uint256)`

```solidity
error InitialUpsOutOfRange(uint256 ups);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MaxPriceExceeded(uint256,uint256)`

```solidity
error MaxPriceExceeded(uint256 price, uint256 maximumPrice);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MiningAuthorityNotFinalized(address,bool)`

```solidity
error MiningAuthorityNotFinalized(address minter, bool locked);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `NothingToClaim(address)`

```solidity
error NothingToClaim(address account);
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

#### `TailUpsOutOfRange(uint256)`

```solidity
error TailUpsOutOfRange(uint256 ups);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `UnexpectedRevenueToken(address,address)`

```solidity
error UnexpectedRevenueToken(address expected, address actual);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ZeroAddress()`

```solidity
error ZeroAddress();
```

_No additional NatSpec notice is present in the compiled artifact._

## Resonance

Source: [`src/core/Resonance.sol`](../../packages/contracts/src/core/Resonance.sol)

Artifact: `out/Resonance.sol/Resonance.json`

Public ABI: 41 functions, 9 events, 21 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,address,address)`

```solidity
constructor(contract IERC20 signalGBX_, contract IERC20 usdg_, address fund_, contract BribeFactory bribeFactory_, contract StrategyFactory strategyFactory_, address initialOwner);
```

Creates the rewarder with immutable token, Fund, and factory dependencies.

### `DURATION()`

```solidity
function DURATION() external view returns (uint256 arg0);
```

Fixed duration of every USDG reward period.

### `REWARD_PRECISION()`

```solidity
function REWARD_PRECISION() external view returns (uint256 arg0);
```

Fixed-point precision for allocating six-decimal USDG across eighteen-decimal SignalGBX.

### `accountSignalWeight(address)`

```solidity
function accountSignalWeight(address account) external view returns (uint256 amount);
```

Returns an account's complete signal across live and killed Strategies.
SignalGBX balance is the canonical account aggregate because idle sGBX is unreachable.

### `accountSignals(address,address)`

```solidity
function accountSignals(address account, address strategy) external view returns (uint256 amount);
```

Returns the SignalGBX one account has assigned to one Strategy.
The paired Bribe is the canonical account-by-Strategy signal ledger.

### `account_Token_RewardPerTokenPaid(address,address)`

```solidity
function account_Token_RewardPerTokenPaid(address strategy, address token) external view returns (uint256 paid);
```

Strategy => token => cumulative reward-per-signal already incorporated.

### `account_Token_Rewards(address,address)`

```solidity
function account_Token_Rewards(address strategy, address token) external view returns (uint256 reward);
```

Strategy => token => accrued whole raw reward units.

### `addBribeReward(address,address)`

```solidity
function addBribeReward(address strategy, address rewardToken) external;
```

Registers an additional independently funded reward token on one Strategy's Bribe.

### `addSignalFor(address,address,uint256)`

```solidity
function addSignalFor(address account, address strategy, uint256 amount) external;
```

Adds an absolute SignalGBX delta for an account through the bound SignalGBX coordinator.

### `addStrategy(address,(uint256,uint256,uint256,uint256))`

```solidity
function addStrategy(contract IERC20 paymentToken, struct Strategy.Config config) external returns (address strategyAddress, address bribeAddress, address bribeRouterAddress);
```

Creates a Strategy, its Bribe, and its BribeRouter as one Resonance-controlled graph.

### `bribeFactory()`

```solidity
function bribeFactory() external view returns (contract BribeFactory arg0);
```

Resonance-bound factory used to create one Bribe per Strategy.

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

### `distribute(address)`

```solidity
function distribute(address strategy) external returns (uint256 amount);
```

Pays one Strategy's accrued USDG. Anyone may trigger payment to the fixed entitled Strategy.

### `earned(address,address)`

```solidity
function earned(address strategy, address rewardToken) external view returns (uint256 reward);
```

Returns one Strategy's stored plus elapsed USDG reward.

### `fund()`

```solidity
function fund() external view returns (address arg0);
```

Treasury exposed to the paired Bribe graph and Strategy settlement.

### `getRewardForDuration(address)`

```solidity
function getRewardForDuration(address rewardToken) external view returns (uint256 reward);
```

Returns the complete amount represented by the current seven-day schedule.

### `getRewardTokens()`

```solidity
function getRewardTokens() external view returns (address[] tokens);
```

Returns the permanently single-element reward-token registry.

### `isStrategy(address)`

```solidity
function isStrategy(address strategy) external view returns (bool valid);
```

Whether an address is a Resonance-created Strategy.

### `isStrategyAlive(address)`

```solidity
function isStrategyAlive(address strategy) external view returns (bool alive);
```

Whether a Strategy can receive new signal and future Resonance rewards.

### `killStrategy(address)`

```solidity
function killStrategy(address strategy) external;
```

Permanently stops a Strategy from receiving new signal or future Resonance rewards.
Rewards accrued through this checkpoint remain claimable. Existing signal remains recorded and removable.

### `lastTimeRewardApplicable(address)`

```solidity
function lastTimeRewardApplicable(address rewardToken) external view returns (uint256 timestamp);
```

Returns the final timestamp applicable to the active reward period.

### `left(address)`

```solidity
function left(address rewardToken) external view returns (uint256 reward);
```

Returns exact raw reward units left in the active period.

### `liveStrategyCount()`

```solidity
function liveStrategyCount() external view returns (uint256 arg0);
```

Number of registered Strategies eligible for new signal and future Resonance rewards.

### `moveSignalFor(address,address,address,uint256)`

```solidity
function moveSignalFor(address account, address fromStrategy, address toStrategy, uint256 amount) external;
```

Atomically moves signal for an account from one Strategy to another through SignalGBX.
A killed Strategy may be the source, but only a live Strategy may receive the moved signal.

### `notifyRevenue(uint256)`

```solidity
function notifyRevenue(uint256 reward) external;
```

Pulls qualifying USDG from ResonanceRouter and restarts the seven-day reward period.
During an active period, the new reward must be at least the exact reward left in that period. The restarted schedule contains the new reward plus that remainder. Raw-unit division remainder is emitted during the first seconds of the new period, so every scheduled USDG unit is represented.

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

### `removeSignalFor(address,address,uint256)`

```solidity
function removeSignalFor(address account, address strategy, uint256 amount) external;
```

Removes an absolute SignalGBX delta for an account through the bound SignalGBX coordinator.
Exits remain available after a Strategy is killed and do not decrement active weight a second time.

### `renounceOwnership()`

```solidity
function renounceOwnership() external;
```

Leaves the contract without owner. It will not be possible to call `onlyOwner` functions. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby disabling any functionality that is only available to the owner.

### `resonanceRouter()`

```solidity
function resonanceRouter() external view returns (address arg0);
```

Sole validated Router authorized to pull USDG into Resonance and notify rewards.

### `rewardPerToken(address)`

```solidity
function rewardPerToken(address rewardToken) external view returns (uint256 accumulatedReward);
```

Returns cumulative scaled USDG allocated per unit of active SignalGBX.

### `rewardTokens(uint256)`

```solidity
function rewardTokens(uint256 arg0) external view returns (address arg0);
```

Registered Resonance reward tokens; permanently contains only USDG.

### `setResonanceRouter(address)`

```solidity
function setResonanceRouter(address resonanceRouter_) external;
```

Binds the sole ResonanceRouter after reciprocal Resonance and USDG identity validation.

### `signalGBX()`

```solidity
function signalGBX() external view returns (contract IERC20 arg0);
```

Non-transferable signal receipt used as allocation and governance power.

### `strategyFactory()`

```solidity
function strategyFactory() external view returns (contract StrategyFactory arg0);
```

Resonance-bound factory used to create Strategies and their BribeRouters.

### `strategySignalWeight(address)`

```solidity
function strategySignalWeight(address strategy) external view returns (uint256 amount);
```

Returns the complete SignalGBX weight recorded for one Strategy.
The paired Bribe is the canonical per-Strategy signal-supply ledger.

### `token_IsReward(address)`

```solidity
function token_IsReward(address token) external view returns (bool isReward);
```

Whether a token is registered for Resonance rewards; permanently true only for USDG.

### `token_RewardData(address)`

```solidity
function token_RewardData(address token) external view returns (uint256 periodFinish, uint256 remainderFinish, uint256 rewardRate, uint256 lastUpdateTime, uint256 rewardPerTokenStored);
```

Reward schedule and cumulative-index state for a registered token.

### `totalSignalWeight()`

```solidity
function totalSignalWeight() external view returns (uint256 arg0);
```

Total active SignalGBX weight eligible for Resonance rewards.

### `transferOwnership(address)`

```solidity
function transferOwnership(address newOwner) external;
```

Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.

### `usdg()`

```solidity
function usdg() external view returns (contract IERC20 arg0);
```

Six-decimal reward token streamed to Strategies.

### Events

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

#### `ResonanceRouterSet(address)`

```solidity
event ResonanceRouterSet(address indexed resonanceRouter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RevenueDistributed(address,address,uint256)`

```solidity
event RevenueDistributed(address indexed caller, address indexed strategy, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RevenueNotified(address,uint256)`

```solidity
event RevenueNotified(address indexed resonanceRouter, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SignalAdded(address,address,uint256)`

```solidity
event SignalAdded(address indexed account, address indexed strategy, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SignalRemoved(address,address,uint256)`

```solidity
event SignalRemoved(address indexed account, address indexed strategy, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyAdded(address,address,address,address)`

```solidity
event StrategyAdded(address indexed strategy, address indexed bribe, address indexed bribeRouter, address paymentToken);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyKilled(address)`

```solidity
event StrategyKilled(address indexed strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `DuplicateStrategy(address)`

```solidity
error DuplicateStrategy(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `FinalLiveStrategy(address)`

```solidity
error FinalLiveStrategy(address strategy);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ForbiddenPaymentToken(address)`

```solidity
error ForbiddenPaymentToken(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ForbiddenRewardToken(address)`

```solidity
error ForbiddenRewardToken(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InexactRevenuePayout(address,uint256,uint256,uint256)`

```solidity
error InexactRevenuePayout(address receiver, uint256 expected, uint256 senderDebit, uint256 receiverCredit);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InexactRevenueTransfer(uint256,uint256,uint256)`

```solidity
error InexactRevenueTransfer(uint256 expected, uint256 senderDebit, uint256 receiverCredit);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InsufficientSignal(address,uint256,uint256)`

```solidity
error InsufficientSignal(address strategy, uint256 available, uint256 requested);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidResonanceRouter(address)`

```solidity
error InvalidResonanceRouter(address resonanceRouter);
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

#### `ResonanceRouterAlreadySet(address)`

```solidity
error ResonanceRouterAlreadySet(address resonanceRouter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RewardSmallerThanLeft(uint256,uint256)`

```solidity
error RewardSmallerThanLeft(uint256 reward, uint256 left);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeERC20FailedOperation(address)`

```solidity
error SafeERC20FailedOperation(address token);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SameStrategy(address)`

```solidity
error SameStrategy(address strategy);
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

#### `UnauthorizedSignalSource(address)`

```solidity
error UnauthorizedSignalSource(address caller);
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

## ResonanceRouter

Source: [`src/core/ResonanceRouter.sol`](../../packages/contracts/src/core/ResonanceRouter.sol)

Artifact: `out/ResonanceRouter.sol/ResonanceRouter.json`

Public ABI: 4 functions, 2 events, 5 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(contract IERC20 usdg_, address resonance_);
```

Creates a fixed USDG route into `resonance_`.

**Parameters**

- `resonance_`: Resonance that receives and indexes routed USDG.
- `usdg_`: USDG token forwarded by the router.

### `pendingRevenue()`

```solidity
function pendingRevenue() external view returns (uint256 amount);
```

Returns USDG waiting to be routed.

**Returns**

- `amount`: Current USDG balance of the router.

### `resonance()`

```solidity
function resonance() external view returns (address arg0);
```

Resonance that receives and indexes routed USDG.

### `route()`

```solidity
function route() external returns (uint256 amount);
```

Routes the complete nonzero USDG balance once it qualifies for a new reward period.

**Returns**

- `amount`: Amount delivered, or zero when the nonzero balance remains below the live-period threshold.

### `usdg()`

```solidity
function usdg() external view returns (contract IERC20 arg0);
```

USDG revenue token forwarded by this router.

### Events

#### `RevenueHeld(address,uint256,uint256)`

```solidity
event RevenueHeld(address indexed caller, uint256 pending, uint256 minimum);
```

_No additional NatSpec notice is present in the compiled artifact._

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

## SignalGBX

Source: [`src/core/SignalGBX.sol`](../../packages/contracts/src/core/SignalGBX.sol)

Artifact: `out/SignalGBX.sol/SignalGBX.json`

Public ABI: 31 functions, 9 events, 29 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(contract IERC20 gbx_, address initialOwner);
```

Creates the non-transferable signal token and assigns deployment-time ownership.

**Parameters**

- `gbx_`: GBX token deposited by signalers.
- `initialOwner`: Deployment-time owner responsible for binding Resonance.

### `CLOCK_MODE()`

```solidity
function CLOCK_MODE() external view returns (string arg0);
```

Machine-readable description of the clock as specified in ERC-6372.

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

Underlying GBX that backs the SignalGBX supply at least one-for-one.

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

### `moveSignal(address,address,uint256)`

```solidity
function moveSignal(address fromStrategy, address toStrategy, uint256 amount) external;
```

Atomically moves signal from one Strategy to another without moving GBX or minting SignalGBX.

**Parameters**

- `amount`: Absolute SignalGBX delta moved.
- `fromStrategy`: Strategy losing signal; may be killed.
- `toStrategy`: Live Strategy receiving signal.

### `name()`

```solidity
function name() external view returns (string arg0);
```

Returns the name of the token.

### `nonces(address)`

```solidity
function nonces(address owner) external view returns (uint256 arg0);
```

Returns the next unused nonce for an address.

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

### `renounceOwnership()`

```solidity
function renounceOwnership() external;
```

Leaves the contract without owner. It will not be possible to call `onlyOwner` functions. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby disabling any functionality that is only available to the owner.

### `resonance()`

```solidity
function resonance() external view returns (address arg0);
```

Resonance that applies this coordinator's per-Strategy signal changes.

### `setResonance(address)`

```solidity
function setResonance(address resonance_) external;
```

Binds the Resonance dependency once after reciprocal SignalGBX identity validation.

**Parameters**

- `resonance_`: Resonance address to bind permanently.

### `signal(address,uint256)`

```solidity
function signal(address strategy, uint256 amount) external;
```

Atomically deposits GBX, mints the same sGBX amount, and assigns it to one live Strategy.

**Parameters**

- `amount`: Exact GBX deposited, sGBX minted, and signal assigned.
- `strategy`: Live Strategy receiving the complete new signal.

### `signalWithPermit(address,uint256,uint256,uint8,bytes32,bytes32)`

```solidity
function signalWithPermit(address strategy, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
```

Attempts an underlying GBX permit, then performs the same atomic transition as `signal`.
A pre-consumed permit may fail harmlessly because the exact underlying transfer remains authoritative.

**Parameters**

- `amount`: Amount of GBX deposited, SignalGBX minted, and signal assigned.
- `deadline`: Permit expiry timestamp.
- `r`: Permit signature `r` component.
- `s`: Permit signature `s` component.
- `strategy`: Live Strategy receiving signal.
- `v`: Permit recovery identifier.

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

### `withdrawSignal(address,uint256)`

```solidity
function withdrawSignal(address strategy, uint256 amount) external;
```

Atomically removes signal, burns the same sGBX amount, and returns the same amount of GBX.

**Parameters**

- `amount`: Amount of signal removed, SignalGBX burned, and GBX returned.
- `strategy`: Strategy losing signal; exits remain available after kill.

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

#### `ResonanceSet(address)`

```solidity
event ResonanceSet(address indexed resonance);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SignalWithdrawn(address,address,uint256)`

```solidity
event SignalWithdrawn(address indexed account, address indexed strategy, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Signaled(address,address,uint256)`

```solidity
event Signaled(address indexed account, address indexed strategy, uint256 amount);
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

#### `InexactUnderlyingTransfer(uint256,uint256,uint256)`

```solidity
error InexactUnderlyingTransfer(uint256 expected, uint256 senderDebit, uint256 receiverCredit);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidAccountNonce(address,uint256)`

```solidity
error InvalidAccountNonce(address account, uint256 currentNonce);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidResonance(address)`

```solidity
error InvalidResonance(address resonance);
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

#### `ResonanceAlreadySet(address)`

```solidity
error ResonanceAlreadySet(address resonance);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ResonanceNotSet()`

```solidity
error ResonanceNotSet();
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

Public ABI: 20 functions, 1 event, 13 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,(uint256,uint256,uint256,uint256))`

```solidity
constructor(address resonance_, contract IERC20 revenueToken_, contract IERC20 paymentToken_, address fund_, struct Strategy.Config config);
```

Creates one immutable Strategy.

**Parameters**

- `config`: Immutable auction configuration.
- `fund_`: Treasury that ultimately receives every auction payment.
- `paymentToken_`: Asset buyers pay to fill this Strategy.
- `resonance_`: Resonance that provides the paired BribeRouter.
- `revenueToken_`: USDG token sold by this Strategy.

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

Treasury that ultimately receives every auction payment.

### `initialPrice()`

```solidity
function initialPrice() external view returns (uint256 arg0);
```

Price at the beginning of the active epoch.

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

### `resonance()`

```solidity
function resonance() external view returns (address arg0);
```

Resonance that supplies the paired BribeRouter.

### `revenueToken()`

```solidity
function revenueToken() external view returns (contract IERC20 arg0);
```

USDG sold by this Strategy.

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

#### `InexactPayment(uint256,uint256,uint256)`

```solidity
error InexactPayment(uint256 expected, uint256 payerDebit, uint256 strategyCredit);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InexactPayout(address,uint256,uint256,uint256)`

```solidity
error InexactPayout(address receiver, uint256 expected, uint256 strategyDebit, uint256 receiverCredit);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InitialPriceOutOfRange(uint256)`

```solidity
error InitialPriceOutOfRange(uint256 price);
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

Public ABI: 6 functions, 3 events, 6 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address)`

```solidity
constructor(address initialOwner);
```

Creates an unbound factory whose owner may set Resonance exactly once.

**Parameters**

- `initialOwner`: Deployment-time owner responsible for binding Resonance.

### `createStrategy(address,address,address,address,(uint256,uint256,uint256,uint256))`

```solidity
function createStrategy(contract IERC20 revenueToken, contract IERC20 paymentToken, address fund, contract Bribe bribe, struct Strategy.Config config) external returns (contract Strategy strategy, contract BribeRouter bribeRouter);
```

Deploys a Strategy and the BribeRouter paired with it.

**Parameters**

- `bribe`: Independently fundable Bribe paired with the Strategy.
- `config`: Immutable auction configuration.
- `fund`: Treasury that ultimately receives the complete payment.
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

### `resonance()`

```solidity
function resonance() external view returns (address arg0);
```

Resonance exclusively authorized to create Strategy graphs.

### `setResonance(address)`

```solidity
function setResonance(address resonance_) external;
```

Binds the only Resonance allowed to create Strategies after reciprocal factory validation.

**Parameters**

- `resonance_`: Resonance address to bind permanently.

### `transferOwnership(address)`

```solidity
function transferOwnership(address newOwner) external;
```

Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.

### Events

#### `OwnershipTransferred(address,address)`

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ResonanceSet(address)`

```solidity
event ResonanceSet(address indexed resonance);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StrategyCreated(address,address,address)`

```solidity
event StrategyCreated(address indexed strategy, address indexed bribeRouter, address indexed paymentToken);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `InvalidResonance(address)`

```solidity
error InvalidResonance(address resonance);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `NotResonance(address)`

```solidity
error NotResonance(address caller);
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

#### `ResonanceAlreadySet(address)`

```solidity
error ResonanceAlreadySet(address resonance);
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

Starts a reward stream or queues funding behind the current stream without changing its finish time.

**Parameters**

- `amount`: Amount pulled from the caller and added to the stream.
- `rewardToken`: Token to stream.

### `totalSupply()`

```solidity
function totalSupply() external view returns (uint256 weight);
```

Returns total virtual signal weight.

**Returns**

- `weight`: Total weight assigned to the Bribe.

## ICoreResonance

Source: [`src/core/interfaces/ICoreResonance.sol`](../../packages/contracts/src/core/interfaces/ICoreResonance.sol)

Artifact: `out/ICoreResonance.sol/ICoreResonance.json`

Public ABI: 9 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `accountSignalWeight(address)`

```solidity
function accountSignalWeight(address account) external view returns (uint256 signalWeight);
```

Returns signal weight currently allocated by an account.

**Parameters**

- `account`: Account whose allocation is queried.

**Returns**

- `signalWeight`: Signal weight currently assigned by `account`.

### `addSignalFor(address,address,uint256)`

```solidity
function addSignalFor(address account, address strategy, uint256 amount) external;
```

Adds signal on behalf of an account through the permanently bound SignalGBX coordinator.

**Parameters**

- `account`: Account whose allocation increases.
- `amount`: Absolute SignalGBX delta added.
- `strategy`: Live Strategy receiving signal.

### `bribeRouterFor(address)`

```solidity
function bribeRouterFor(address strategy) external view returns (address router);
```

Returns the reward router paired with a Strategy.

**Parameters**

- `strategy`: Strategy whose router is queried.

**Returns**

- `router`: BribeRouter paired with `strategy`.

### `distribute(address)`

```solidity
function distribute(address strategy) external returns (uint256 amount);
```

Checkpoints and transfers one Strategy's currently released USDG.

**Parameters**

- `strategy`: Strategy whose allocation should be transferred.

**Returns**

- `amount`: Amount transferred.

### `fund()`

```solidity
function fund() external view returns (address fundAddress);
```

Returns the immutable Fund used by Resonance and its reward graph.

**Returns**

- `fundAddress`: Fixed Fund destination.

### `left(address)`

```solidity
function left(address rewardToken) external view returns (uint256 amount);
```

Returns exact raw reward units left in one active reward period.

**Parameters**

- `rewardToken`: Token whose active period is queried.

**Returns**

- `amount`: Reward units not yet emitted by the active period.

### `moveSignalFor(address,address,address,uint256)`

```solidity
function moveSignalFor(address account, address fromStrategy, address toStrategy, uint256 amount) external;
```

Atomically moves signal between Strategies through the permanently bound SignalGBX coordinator.

**Parameters**

- `account`: Account whose allocation moves.
- `amount`: Absolute SignalGBX delta moved.
- `fromStrategy`: Strategy losing signal.
- `toStrategy`: Live Strategy receiving signal.

### `notifyRevenue(uint256)`

```solidity
function notifyRevenue(uint256 amount) external;
```

Pulls and schedules newly routed USDG revenue.

**Parameters**

- `amount`: Amount of USDG to pull from the caller.

### `removeSignalFor(address,address,uint256)`

```solidity
function removeSignalFor(address account, address strategy, uint256 amount) external;
```

Removes signal on behalf of an account through the permanently bound SignalGBX coordinator.

**Parameters**

- `account`: Account whose allocation decreases.
- `amount`: Absolute SignalGBX delta removed.
- `strategy`: Strategy losing signal; exits remain available after kill.

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

## IMine

Source: [`src/core/interfaces/IMine.sol`](../../packages/contracts/src/core/interfaces/IMine.sol)

Artifact: `out/IMine.sol/IMine.json`

Public ABI: 4 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `checkpointAll()`

```solidity
function checkpointAll() external returns (uint256 amount);
```

Mints every live slot's accrued GBX through the current timestamp.

**Returns**

- `amount`: Complete GBX amount minted by this checkpoint.

### `effectiveTotalSupply()`

```solidity
function effectiveTotalSupply() external view returns (uint256 amount);
```

Returns minted GBX supply plus every live slot's accrued unminted GBX.

### `gbx()`

```solidity
function gbx() external view returns (address token);
```

Canonical GBX token minted by this contract.

### `pendingEmission()`

```solidity
function pendingEmission() external view returns (uint256 amount);
```

Returns accrued GBX that has not yet been minted across every live slot.

## IResonanceIdentity

Source: [`src/core/interfaces/IResonanceIdentity.sol`](../../packages/contracts/src/core/interfaces/IResonanceIdentity.sol)

Artifact: `out/IResonanceIdentity.sol/IResonanceIdentity.json`

Public ABI: 3 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `bribeFactory()`

```solidity
function bribeFactory() external view returns (address factory);
```

Returns the immutable BribeFactory controlled by Resonance.

### `signalGBX()`

```solidity
function signalGBX() external view returns (address token);
```

Returns the immutable SignalGBX receipt used by Resonance.

### `strategyFactory()`

```solidity
function strategyFactory() external view returns (address factory);
```

Returns the immutable StrategyFactory controlled by Resonance.

## IResonanceRouterIdentity

Source: [`src/core/interfaces/IResonanceIdentity.sol`](../../packages/contracts/src/core/interfaces/IResonanceIdentity.sol)

Artifact: `out/IResonanceIdentity.sol/IResonanceRouterIdentity.json`

Public ABI: 2 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `resonance()`

```solidity
function resonance() external view returns (address receiver);
```

Returns the immutable Resonance receiver used by the router.

### `usdg()`

```solidity
function usdg() external view returns (address token);
```

Returns the immutable USDG token forwarded by the router.

## IResonanceRouter

Source: [`src/core/interfaces/IResonanceRouter.sol`](../../packages/contracts/src/core/interfaces/IResonanceRouter.sol)

Artifact: `out/IResonanceRouter.sol/IResonanceRouter.json`

Public ABI: 1 function, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `route()`

```solidity
function route() external returns (uint256 amount);
```

Routes the complete nonzero pending USDG balance into Resonance.

**Returns**

- `amount`: Amount delivered to Resonance.

## ProtocolGovernor

Source: [`src/governance/ProtocolGovernor.sol`](../../packages/contracts/src/governance/ProtocolGovernor.sol)

Artifact: `out/ProtocolGovernor.sol/ProtocolGovernor.json`

Public ABI: 46 functions, 8 events, 24 custom errors, 1 constructor, 1 receive entry, 0 fallback entries.

### `constructor(address,address,address,address,uint48,uint32,uint256,uint256)`

```solidity
constructor(contract IVotes votingToken, contract TimelockController timelockController, contract Resonance resonance_, contract Mine mine_, uint48 votingDelayBlocks, uint32 votingPeriodBlocks, uint256 proposalThresholdVotes, uint256 quorumNumerator_);
```

Creates a selector-bounded Governor using deployed SignalGBX vote checkpoints.

**Parameters**

- `mine_`: Immutable Mine maintenance target.
- `proposalThresholdVotes`: Historical SignalGBX votes required to submit a proposal.
- `quorumNumerator_`: Required participation percentage, from one through one hundred.
- `resonance_`: Immutable Resonance maintenance target.
- `timelockController`: Timelock that will own Resonance and Mine.
- `votingDelayBlocks`: Delay from proposal creation to snapshot in SignalGBX clock blocks.
- `votingPeriodBlocks`: Voting duration in SignalGBX clock blocks.
- `votingToken`: SignalGBX contract used as the immutable IVotes source.

### `receive()`

```solidity
receive() external payable;
```

Rejects direct ETH because every permitted protocol maintenance call has zero native value.

### `BALLOT_TYPEHASH()`

```solidity
function BALLOT_TYPEHASH() external view returns (bytes32 arg0);
```

_Inherited callable; the compiled artifact contains no additional NatSpec for this ABI entry._

### `CLOCK_MODE()`

```solidity
function CLOCK_MODE() external view returns (string arg0);
```

Machine-readable description of the clock as specified in ERC-6372.

### `COUNTING_MODE()`

```solidity
function COUNTING_MODE() external pure returns (string arg0);
```

module:voting
A description of the possible `support` values for {castVote} and the way these votes are counted, meant to be consumed by UIs to show correct vote options and interpret the results. The string is a URL-encoded sequence of key-value pairs that each describe one aspect, for example `support=bravo&quorum=for,abstain`. There are 2 standard keys: `support` and `quorum`. - `support=bravo` refers to the vote options 0 = Against, 1 = For, 2 = Abstain, as in `GovernorBravo`. - `quorum=bravo` means that only For votes are counted towards quorum. - `quorum=for,abstain` means that both For and Abstain votes are counted towards quorum. If a counting module makes use of encoded `params`, it should include this under a `params` key with a unique name that describes the behavior. For example: - `params=fractional` might refer to a scheme where votes are divided fractionally between for/against/abstain. - `params=erc721` might refer to a scheme where specific NFTs are delegated to vote. NOTE: The string can be decoded by the standard https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams[`URLSearchParams`] JavaScript class.

### `EXTENDED_BALLOT_TYPEHASH()`

```solidity
function EXTENDED_BALLOT_TYPEHASH() external view returns (bytes32 arg0);
```

_Inherited callable; the compiled artifact contains no additional NatSpec for this ABI entry._

### `cancel(address[],uint256[],bytes[],bytes32)`

```solidity
function cancel(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) external returns (uint256 arg0);
```

Cancel a proposal. A proposal is cancellable by the proposer, but only while it is Pending state, i.e. before the vote starts. Emits a {ProposalCanceled} event.

### `castVote(uint256,uint8)`

```solidity
function castVote(uint256 proposalId, uint8 support) external returns (uint256 arg0);
```

Cast a vote Emits a {VoteCast} event.

### `castVoteBySig(uint256,uint8,address,bytes)`

```solidity
function castVoteBySig(uint256 proposalId, uint8 support, address voter, bytes signature) external returns (uint256 arg0);
```

Cast a vote using the voter's signature, including ERC-1271 signature support. Emits a {VoteCast} event.

### `castVoteWithReason(uint256,uint8,string)`

```solidity
function castVoteWithReason(uint256 proposalId, uint8 support, string reason) external returns (uint256 arg0);
```

Cast a vote with a reason Emits a {VoteCast} event.

### `castVoteWithReasonAndParams(uint256,uint8,string,bytes)`

```solidity
function castVoteWithReasonAndParams(uint256 proposalId, uint8 support, string reason, bytes params) external returns (uint256 arg0);
```

Cast a vote with a reason and additional encoded parameters Emits a {VoteCast} or {VoteCastWithParams} event depending on the length of params.

### `castVoteWithReasonAndParamsBySig(uint256,uint8,address,string,bytes,bytes)`

```solidity
function castVoteWithReasonAndParamsBySig(uint256 proposalId, uint8 support, address voter, string reason, bytes params, bytes signature) external returns (uint256 arg0);
```

Cast a vote with a reason and additional encoded parameters using the voter's signature, including ERC-1271 signature support. Emits a {VoteCast} or {VoteCastWithParams} event depending on the length of params.

### `clock()`

```solidity
function clock() external view returns (uint48 arg0);
```

Clock (as specified in ERC-6372) is set to match the token's clock. Fallback to block numbers if the token does not implement ERC-6372.

### `eip712Domain()`

```solidity
function eip712Domain() external view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions);
```

returns the fields and values that describe the domain separator used by this contract for EIP-712 signature.

### `execute(address[],uint256[],bytes[],bytes32)`

```solidity
function execute(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) external payable returns (uint256 proposalId);
```

Executes an approved zero-value proposal without accepting native currency from the executor.
GovernorTimelockControl forwards `msg.value` to its Timelock independently of proposal call values. Rejecting it here prevents accidental ETH from becoming stranded while preserving permissionless execution.

**Parameters**

- `calldatas`: Exact selector-bounded proposal payloads.
- `descriptionHash`: Hash of the proposal description used in its identifier.
- `targets`: Immutable-target proposal call destinations.
- `values`: Zero-value proposal call amounts.

**Returns**

- `proposalId`: Identifier of the executed proposal.

### `getProposalId(address[],uint256[],bytes[],bytes32)`

```solidity
function getProposalId(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) external view returns (uint256 arg0);
```

module:core
Function used to get the proposal id from the proposal details.

### `getVotes(address,uint256)`

```solidity
function getVotes(address account, uint256 timepoint) external view returns (uint256 arg0);
```

module:reputation
Voting power of an `account` at a specific `timepoint`. Note: this can be implemented in a number of ways, for example by reading the delegated balance from one (or multiple), {ERC20Votes} tokens.

### `getVotesWithParams(address,uint256,bytes)`

```solidity
function getVotesWithParams(address account, uint256 timepoint, bytes params) external view returns (uint256 arg0);
```

module:reputation
Voting power of an `account` at a specific `timepoint` given additional encoded parameters.

### `hasVoted(uint256,address)`

```solidity
function hasVoted(uint256 proposalId, address account) external view returns (bool arg0);
```

module:voting
Returns whether `account` has cast a vote on `proposalId`.

### `hashProposal(address[],uint256[],bytes[],bytes32)`

```solidity
function hashProposal(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) external pure returns (uint256 arg0);
```

See {IGovernor-hashProposal}. The proposal id is produced by hashing the ABI encoded `targets` array, the `values` array, the `calldatas` array and the descriptionHash (bytes32 which itself is the keccak256 hash of the description string). This proposal id can be produced from the proposal data which is part of the {ProposalCreated} event. It can even be computed in advance, before the proposal is submitted. Note that the chainId and the governor address are not part of the proposal id computation. Consequently, the same proposal (with same operation and same description) will have the same id if submitted on multiple governors across multiple networks. This also means that in order to execute the same operation twice (on the same governor) the proposer will have to change the description in order to avoid proposal id conflicts.

### `mine()`

```solidity
function mine() external view returns (contract Mine arg0);
```

The sole Mine whose bounded capacity increase may be proposed.

### `name()`

```solidity
function name() external view returns (string arg0);
```

module:core
Name of the governor instance (used in building the EIP-712 domain separator).

### `nonces(address)`

```solidity
function nonces(address owner) external view returns (uint256 arg0);
```

Returns the next unused nonce for an address.

### `onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)`

```solidity
function onERC1155BatchReceived(address arg0, address arg1, uint256[] arg2, uint256[] arg3, bytes arg4) external returns (bytes4 arg0);
```

See {IERC1155Receiver-onERC1155BatchReceived}. Receiving tokens is disabled if the governance executor is other than the governor itself (eg. when using with a timelock).

### `onERC1155Received(address,address,uint256,uint256,bytes)`

```solidity
function onERC1155Received(address arg0, address arg1, uint256 arg2, uint256 arg3, bytes arg4) external returns (bytes4 arg0);
```

See {IERC1155Receiver-onERC1155Received}. Receiving tokens is disabled if the governance executor is other than the governor itself (eg. when using with a timelock).

### `onERC721Received(address,address,uint256,bytes)`

```solidity
function onERC721Received(address arg0, address arg1, uint256 arg2, bytes arg3) external returns (bytes4 arg0);
```

See {IERC721Receiver-onERC721Received}. Receiving tokens is disabled if the governance executor is other than the governor itself (eg. when using with a timelock).

### `proposalDeadline(uint256)`

```solidity
function proposalDeadline(uint256 proposalId) external view returns (uint256 arg0);
```

module:core
Timepoint at which votes close. If using block number, votes close at the end of this block, so it is possible to cast a vote during this block.

### `proposalEta(uint256)`

```solidity
function proposalEta(uint256 proposalId) external view returns (uint256 arg0);
```

module:core
The time when a queued proposal becomes executable ("ETA"). Unlike {proposalSnapshot} and {proposalDeadline}, this doesn't use the governor clock, and instead relies on the executor's clock which may be different. In most cases this will be a timestamp.

### `proposalNeedsQueuing(uint256)`

```solidity
function proposalNeedsQueuing(uint256 proposalId) external view returns (bool needsQueuing);
```

Returns whether a successful proposal must be queued in the immutable Timelock.

**Parameters**

- `proposalId`: Proposal identifier returned by propose.

**Returns**

- `needsQueuing`: True when the proposal must pass through the Timelock queue before execution.

### `proposalProposer(uint256)`

```solidity
function proposalProposer(uint256 proposalId) external view returns (address arg0);
```

module:core
The account that created a proposal.

### `proposalSnapshot(uint256)`

```solidity
function proposalSnapshot(uint256 proposalId) external view returns (uint256 arg0);
```

module:core
Timepoint used to retrieve user's votes and quorum. If using block number (as per Compound's Comp), the snapshot is performed at the end of this block. Hence, voting for this proposal starts at the beginning of the following block.

### `proposalThreshold()`

```solidity
function proposalThreshold() external view returns (uint256 arg0);
```

module:core
The number of votes required in order for a voter to become a proposer.

### `proposalVotes(uint256)`

```solidity
function proposalVotes(uint256 proposalId) external view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes);
```

Accessor to the internal vote counts.

### `propose(address[],uint256[],bytes[],string)`

```solidity
function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) external returns (uint256 arg0);
```

See {IGovernor-propose}. This function has opt-in frontrunning protection, described in {\_isValidDescriptionForProposer}.

### `queue(address[],uint256[],bytes[],bytes32)`

```solidity
function queue(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) external returns (uint256 arg0);
```

Queue a proposal. Some governors require this step to be performed before execution can happen. If queuing is not necessary, this function may revert. Queuing a proposal requires the quorum to be reached, the vote to be successful, and the deadline to be reached. Emits a {ProposalQueued} event.

### `quorum(uint256)`

```solidity
function quorum(uint256 timepoint) external view returns (uint256 arg0);
```

module:user-config
Minimum number of cast voted required for a proposal to be successful. NOTE: The `timepoint` parameter corresponds to the snapshot used for counting vote. This allows to scale the quorum depending on values such as the totalSupply of a token at this timepoint (see {ERC20Votes}).

### `quorumDenominator()`

```solidity
function quorumDenominator() external pure returns (uint256 arg0);
```

Returns the fixed quorum percentage denominator.

### `quorumNumerator()`

```solidity
function quorumNumerator() external view returns (uint256 arg0);
```

Returns the immutable quorum percentage numerator.

### `relay(address,uint256,bytes)`

```solidity
function relay(address arg0, uint256 arg1, bytes arg2) external payable;
```

Generic Governor relay is incompatible with the immutable four-selector surface.

### `resonance()`

```solidity
function resonance() external view returns (contract Resonance arg0);
```

The sole Resonance whose bounded maintenance calls may be proposed.

### `state(uint256)`

```solidity
function state(uint256 proposalId) external view returns (enum IGovernor.ProposalState proposalState);
```

Returns the current OpenZeppelin lifecycle state for a proposal.

**Parameters**

- `proposalId`: Proposal identifier returned by propose.

**Returns**

- `proposalState`: Current proposal lifecycle state.

### `supportsInterface(bytes4)`

```solidity
function supportsInterface(bytes4 interfaceId) external view returns (bool arg0);
```

Returns true if this contract implements the interface defined by `interfaceId`. See the corresponding https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[ERC section] to learn more about how these ids are created. This function call must use less than 30 000 gas.

### `timelock()`

```solidity
function timelock() external view returns (address arg0);
```

Public accessor to check the address of the timelock

### `token()`

```solidity
function token() external view returns (contract IERC5805 arg0);
```

The token that voting power is sourced from.

### `updateTimelock(address)`

```solidity
function updateTimelock(contract TimelockController arg0) external pure;
```

The Timelock cannot be replaced after deployment.

### `version()`

```solidity
function version() external view returns (string arg0);
```

module:core
Version of the governor instance (used in building the EIP-712 domain separator). Default: "1"

### `votingDelay()`

```solidity
function votingDelay() external view returns (uint256 arg0);
```

module:user-config
Delay, between the proposal is created and the vote starts. The unit this duration is expressed in depends on the clock (see ERC-6372) this contract uses. This can be increased to leave time for users to buy voting power, or delegate it, before the voting of a proposal starts. NOTE: While this interface returns a uint256, timepoints are stored as uint48 following the ERC-6372 clock type. Consequently this value must fit in a uint48 (when added to the current clock). See {IERC6372-clock}.

### `votingPeriod()`

```solidity
function votingPeriod() external view returns (uint256 arg0);
```

module:user-config
Delay between the vote start and vote end. The unit this duration is expressed in depends on the clock (see ERC-6372) this contract uses. NOTE: The {votingDelay} can delay the start of the vote. This must be considered when setting the voting duration compared to the voting delay. NOTE: This value is stored when the proposal is submitted so that possible changes to the value do not affect proposals that have already been submitted. The type used to save it is a uint32. Consequently, while this interface returns a uint256, the value it returns should fit in a uint32.

### Events

#### `EIP712DomainChanged()`

```solidity
event EIP712DomainChanged();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProposalCanceled(uint256)`

```solidity
event ProposalCanceled(uint256 proposalId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)`

```solidity
event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProposalExecuted(uint256)`

```solidity
event ProposalExecuted(uint256 proposalId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ProposalQueued(uint256,uint256)`

```solidity
event ProposalQueued(uint256 proposalId, uint256 etaSeconds);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `TimelockChange(address,address)`

```solidity
event TimelockChange(address oldTimelock, address newTimelock);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `VoteCast(address,uint256,uint8,uint256,string)`

```solidity
event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `VoteCastWithParams(address,uint256,uint8,uint256,string,bytes)`

```solidity
event VoteCastWithParams(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason, bytes params);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

#### `GovernorAlreadyCastVote(address)`

```solidity
error GovernorAlreadyCastVote(address voter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GovernorAlreadyQueuedProposal(uint256)`

```solidity
error GovernorAlreadyQueuedProposal(uint256 proposalId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GovernorDisabledDeposit()`

```solidity
error GovernorDisabledDeposit();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GovernorInsufficientProposerVotes(address,uint256,uint256)`

```solidity
error GovernorInsufficientProposerVotes(address proposer, uint256 votes, uint256 threshold);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GovernorInvalidProposalLength(uint256,uint256,uint256)`

```solidity
error GovernorInvalidProposalLength(uint256 targets, uint256 calldatas, uint256 values);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GovernorInvalidSignature(address)`

```solidity
error GovernorInvalidSignature(address voter);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GovernorInvalidVoteParams()`

```solidity
error GovernorInvalidVoteParams();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GovernorInvalidVoteType()`

```solidity
error GovernorInvalidVoteType();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GovernorInvalidVotingPeriod(uint256)`

```solidity
error GovernorInvalidVotingPeriod(uint256 votingPeriod);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GovernorNonexistentProposal(uint256)`

```solidity
error GovernorNonexistentProposal(uint256 proposalId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GovernorNotQueuedProposal(uint256)`

```solidity
error GovernorNotQueuedProposal(uint256 proposalId);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GovernorOnlyExecutor(address)`

```solidity
error GovernorOnlyExecutor(address account);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GovernorQueueNotImplemented()`

```solidity
error GovernorQueueNotImplemented();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GovernorRestrictedProposer(address)`

```solidity
error GovernorRestrictedProposer(address proposer);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GovernorUnableToCancel(uint256,address)`

```solidity
error GovernorUnableToCancel(uint256 proposalId, address account);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `GovernorUnexpectedProposalState(uint256,uint8,bytes32)`

```solidity
error GovernorUnexpectedProposalState(uint256 proposalId, enum IGovernor.ProposalState current, bytes32 expectedStates);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `ImmutableGovernanceSurface()`

```solidity
error ImmutableGovernanceSurface();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidAccountNonce(address,uint256)`

```solidity
error InvalidAccountNonce(address account, uint256 currentNonce);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidDependency(address)`

```solidity
error InvalidDependency(address dependency);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidGovernanceParameter()`

```solidity
error InvalidGovernanceParameter();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `InvalidShortString()`

```solidity
error InvalidShortString();
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SafeCastOverflowedUintDowncast(uint8,uint256)`

```solidity
error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `StringTooLong(string)`

```solidity
error StringTooLong(string str);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `UnsupportedProposalCall(address,uint256,bytes4,uint256)`

```solidity
error UnsupportedProposalCall(address target, uint256 value, bytes4 selector, uint256 calldataLength);
```

_No additional NatSpec notice is present in the compiled artifact._
