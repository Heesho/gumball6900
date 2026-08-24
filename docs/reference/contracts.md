# Contract API reference

> Generated from Foundry artifacts by `packages/contracts/scripts/generate-contract-docs.mjs`. Do not edit by
> hand. Run `pnpm docs:generate` after changing a public Solidity surface or NatSpec.

Compiler artifact versions: `0.8.26+commit.8a97fa7a`.

Documented source surfaces: 17. Documented ABI entries: 386. Documented public ABI functions: 199.

## Bribe

Source: [`src/core/Bribe.sol`](../../packages/contracts/src/core/Bribe.sol)

Artifact: `out/Bribe.sol/Bribe.json`

Public ABI: 22 functions, 5 events, 11 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address)`

```solidity
constructor(address resonance_);
```

Creates an empty, bounded reward stream controlled by one Resonance contract.
Reverts with `ZeroAddress` when `resonance_` is zero or has no deployed code.

**Parameters**

- `resonance_`: Resonance exclusively authorized to maintain signal weights and register reward tokens.

### `MAX_LIFETIME_REWARD_AMOUNT()`

```solidity
function MAX_LIFETIME_REWARD_AMOUNT() external view returns (uint256 arg0);
```

Returns the maximum cumulative raw units accepted for any one reward token over this Bribe's lifetime.

### `MAX_REWARD_TOKENS()`

```solidity
function MAX_REWARD_TOKENS() external view returns (uint256 arg0);
```

Returns the immutable upper bound on registered reward tokens and mandatory all-token loops.

### `REWARD_DURATION()`

```solidity
function REWARD_DURATION() external view returns (uint256 arg0);
```

Returns the fixed duration of every reward stream, in seconds.

### `REWARD_PRECISION()`

```solidity
function REWARD_PRECISION() external view returns (uint256 arg0);
```

Returns the fixed-point scale used by cumulative reward-per-signal accounting.

### `accountRewardPerSignalPaid(address,address)`

```solidity
function accountRewardPerSignalPaid(address account, address token) external view returns (uint256 paid);
```

Returns the scaled cumulative index already incorporated for an account and reward token.

### `addRewardToken(address)`

```solidity
function addRewardToken(address rewardToken) external;
```

Appends a reward token to this Bribe's permanent registry.
Callable only by Resonance. The token must be a unique, nonzero contract and the resulting registry length cannot exceed `MAX_REWARD_TOKENS`; registration does not fund or start a stream. Emits `RewardTokenAdded`.

**Parameters**

- `rewardToken`: ERC-20 contract address to register.

### `addSignalWeight(address,uint256)`

```solidity
function addSignalWeight(address account, uint256 amount) external;
```

Adds signal weight for `account` after checkpointing every registered reward under the prior weights.
Callable only by Resonance. The mandatory checkpoint loop is bounded by `MAX_REWARD_TOKENS`. Emits `SignalWeightAdded` after both the account and total weights increase.

**Parameters**

- `account`: Nonzero account whose paired-Strategy signal weight increases.
- `amount`: Nonzero raw signal units added to both the account weight and total weight.

### `claimReward(address,address)`

```solidity
function claimReward(address account, address rewardToken) external returns (uint256 amount);
```

Checkpoints and pays one registered reward token earned by `account` directly to that account.
Any caller may initiate the claim. Other reward streams are neither checkpointed nor transferred. A failed transfer reverts the checkpoint and entitlement reset, preserving the scalar claim. Emits `RewardPaid` only when a nonzero amount is transferred.

**Parameters**

- `account`: Account whose reward is checkpointed and paid; cannot be zero.
- `rewardToken`: Registered token to checkpoint and pay.

**Returns**

- `amount`: Raw token units transferred, or zero when the account has no whole-unit reward.

### `claimRewards(address)`

```solidity
function claimRewards(address account) external;
```

Checkpoints and pays every registered reward token earned by `account` directly to that account.
Any caller may initiate the claim. The function loops over at most `MAX_REWARD_TOKENS`. A failed token transfer reverts the complete all-token claim; `claimReward` provides per-token failure isolation. Emits `RewardPaid` once for each token with a nonzero payment.

**Parameters**

- `account`: Account whose accrued raw-token rewards are checkpointed and paid; cannot be zero.

### `earned(address,address)`

```solidity
function earned(address account, address rewardToken) external view returns (uint256 amount);
```

Returns one account's checkpointed plus pending reward for one token in whole raw units.
Pending accrual is computed from the live index and rounds down; this view does not write a checkpoint or validate that `rewardToken` is registered.

**Parameters**

- `account`: Account whose entitlement is queried.
- `rewardToken`: Reward token whose entitlement is queried.

**Returns**

- `amount`: Raw token units currently payable after checkpointing.

### `isRewardToken(address)`

```solidity
function isRewardToken(address token) external view returns (bool isReward);
```

Returns whether a token belongs to the append-only reward-token registry.

### `lifetimeRewardNotified(address)`

```solidity
function lifetimeRewardNotified(address token) external view returns (uint256 amount);
```

Returns cumulative raw units accepted through notifications for a reward token.

### `notifyReward(address,uint256)`

```solidity
function notifyReward(address rewardToken, uint256 amount) external;
```

Pulls fresh funding from the caller and restarts a registered token's seven-day reward stream.
Funding is permissionless. `amount` must be at least `REWARD_DURATION`, at least `remainingReward`, and within the token's remaining lifetime cap. During an active stream, the new per-second rate is `floor((amount + remainingReward) / REWARD_DURATION)`; otherwise it is `floor(amount / REWARD_DURATION)`. The period restarts from the current timestamp, and division remainder remains unallocated token surplus. Cap and threshold failures occur before checkpointing or token transfer. Emits `RewardNotified` after funding and schedule state are updated.

**Parameters**

- `amount`: Fresh raw token units pulled from the caller and counted toward the lifetime cap.
- `rewardToken`: Registered standard ERC-20 token to pull and stream.

### `remainingReward(address)`

```solidity
function remainingReward(address rewardToken) external view returns (uint256 amount);
```

Returns the raw token units still scheduled in a reward token's active stream.
Computes `(periodFinish - block.timestamp) * rewardRate` while active and zero afterward. The result excludes elapsed rewards, direct donations, and rate-division surplus. Unregistered tokens return zero.

**Parameters**

- `rewardToken`: Reward token whose current stream is queried.

**Returns**

- `amount`: Raw token units remaining at the stored whole-unit-per-second rate.

### `removeSignalWeight(address,uint256)`

```solidity
function removeSignalWeight(address account, uint256 amount) external;
```

Removes signal weight for `account` after checkpointing every registered reward under the prior weights.
Callable only by Resonance. Removing more than the account or total weight reverts by checked arithmetic. Emits `SignalWeightRemoved` after both weights decrease.

**Parameters**

- `account`: Nonzero account whose paired-Strategy signal weight decreases.
- `amount`: Nonzero raw signal units removed from both the account weight and total weight.

### `resonance()`

```solidity
function resonance() external view returns (address arg0);
```

Returns the immutable Resonance authorized to maintain signal weights and register reward tokens.

### `rewardData(address)`

```solidity
function rewardData(address token) external view returns (uint256 periodFinish, uint256 rewardRate, uint256 lastUpdateTime, uint256 rewardPerSignalStored);
```

Returns the current stream timestamps, raw-unit rate, and scaled index for a reward token.

### `rewardPerSignal(address)`

```solidity
function rewardPerSignal(address rewardToken) external view returns (uint256 accumulatedReward);
```

Returns the live cumulative reward allocated per raw signal unit for one reward token.
The result is scaled by `REWARD_PRECISION` and each index increment rounds down. Accrual stops at `periodFinish`. If total signal weight is zero, the index remains unchanged and elapsed rewards cannot be captured by accounts that add weight later. This view does not write a checkpoint.

**Parameters**

- `rewardToken`: Reward token whose cumulative index is queried; unregistered tokens return zero.

**Returns**

- `accumulatedReward`: Cumulative reward-per-signal index scaled by `REWARD_PRECISION`.

### `rewardTokens()`

```solidity
function rewardTokens() external view returns (address[] tokens);
```

Returns every registered reward-token address in immutable insertion order.

**Returns**

- `tokens`: Copy of the append-only registry, containing at most `MAX_REWARD_TOKENS` entries.

### `rewards(address,address)`

```solidity
function rewards(address account, address token) external view returns (uint256 amount);
```

Returns an account's checkpointed, unclaimed reward in raw token units.

### `signalWeightOf(address)`

```solidity
function signalWeightOf(address account) external view returns (uint256 weight);
```

Returns an account's raw signal weight assigned to this Bribe's paired Strategy.

### `totalSignalWeight()`

```solidity
function totalSignalWeight() external view returns (uint256 arg0);
```

Returns the total raw signal weight assigned to this Bribe's paired Strategy.

### Events

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

#### `RewardTokenAdded(address)`

```solidity
event RewardTokenAdded(address indexed rewardToken);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SignalWeightAdded(address,uint256)`

```solidity
event SignalWeightAdded(address indexed account, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `SignalWeightRemoved(address,uint256)`

```solidity
event SignalWeightRemoved(address indexed account, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

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

#### `RewardLifetimeCapExceeded(address,uint256,uint256,uint256)`

```solidity
error RewardLifetimeCapExceeded(address token, uint256 notified, uint256 requested, uint256 maximum);
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
OpenZeppelin `Ownable` rejects a zero `initialOwner`. Transferring or renouncing ownership before binding changes or can permanently remove the only authority able to complete setup.

**Parameters**

- `initialOwner`: Deployment-time owner responsible for the one-time Resonance binding.

### `createBribe()`

```solidity
function createBribe() external returns (contract Bribe bribe);
```

Deploys a new empty Bribe whose immutable authority is the bound Resonance.
Callable only by `resonance`; an unbound factory therefore rejects every possible caller. Each call deploys a distinct Bribe with an empty signal ledger and reward-token registry, then emits `BribeCreated`.

**Returns**

- `bribe`: Newly deployed Bribe controlled by the bound Resonance.

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

Returns the Resonance exclusively authorized to create Bribes, or zero before one-time binding.

### `setResonance(address)`

```solidity
function setResonance(address resonance_) external;
```

Permanently binds the only Resonance allowed to deploy Bribes.
Callable only by the current owner and only while `resonance` is zero. The candidate must be a nonzero contract whose `bribeFactory()` identity getter returns this factory; a failed call or mismatch reverts with `InvalidResonance`. Successful binding emits `ResonanceSet` and has no replacement path.

**Parameters**

- `resonance_`: Resonance contract address to validate and bind.

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

Public ABI: 3 functions, 1 event, 2 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(contract IBribe bribe_, contract IERC20 paymentToken_);
```

Creates the fixed route between one payment token and its paired Bribe.
Reverts with `ZeroAddress` unless both dependencies are nonzero contract addresses. The constructor does not validate that `paymentToken_` is already registered by `bribe_`.

**Parameters**

- `bribe_`: Bribe paired with the Strategy and authorized to pull routed tokens.
- `paymentToken_`: Strategy payment token held by this Router before distribution.

### `bribe()`

```solidity
function bribe() external view returns (contract IBribe arg0);
```

Returns the immutable Bribe that pulls and streams the buffered payment token.

### `paymentToken()`

```solidity
function paymentToken() external view returns (contract IERC20 arg0);
```

Returns the immutable Strategy payment token buffered and distributed as the automatic Bribe reward.

### `route()`

```solidity
function route() external returns (uint256 amount);
```

Routes the complete payment-token balance into the paired Bribe when all notification gates are met.
Permissionless. Returns zero without changing state when the balance is zero, below `REWARD_DURATION` raw units, or below the Bribe's currently remaining reward. Otherwise, gives the Bribe an exact temporary allowance and calls `notifyReward`, which pulls the complete balance and restarts its stream. A Bribe or token failure reverts the route, preserving the buffered balance. Most transient failures can be retried, but exhaustion of the Bribe's monotonic lifetime cap has no reset and permanently prevents later routing for that token; already completed Strategy purchases remain unaffected. Emits `RewardRouted` on success.

**Returns**

- `amount`: Raw payment-token units routed, or zero when the buffer must continue accumulating.

### Events

#### `RewardRouted(address,address,uint256)`

```solidity
event RewardRouted(address indexed bribe, address indexed rewardToken, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

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

## Fund

Source: [`src/core/Fund.sol`](../../packages/contracts/src/core/Fund.sol)

Artifact: `out/Fund.sol/Fund.json`

Public ABI: 3 functions, 2 events, 10 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address)`

```solidity
constructor(contract GBX gbx_);
```

Creates the ownerless, registry-free treasury backing `gbx_`.
Reverts unless `gbx_` is a nonzero address containing deployed code. Reciprocal Mine validation is deferred until redemption because GBX is expected to be constructed before its one-time Mine handoff.

**Parameters**

- `gbx_`: Canonical GBX token backed by this Fund.

### `burnGBX(uint256)`

```solidity
function burnGBX(uint256 amount) external;
```

Burns GBX already held by Fund, including GBX received from a Strategy payment.
Permissionless and non-reentrant. Burns from Fund's own balance, never from the caller, and reverts if Fund holds less than `amount`. No backing asset is transferred by this maintenance operation. GBX emits its burn events, followed by Fund's `GBXBurned`.

**Parameters**

- `amount`: Nonzero raw GBX amount to burn from Fund's balance.

### `gbx()`

```solidity
function gbx() external view returns (contract GBX arg0);
```

Canonical GBX token burned by redemptions and permissionless maintenance.

### `redeem(uint256,address,address[])`

```solidity
function redeem(uint256 gbxAmount, address receiver, address[] tokens) external;
```

Burns GBX and returns the caller-selected pro-rata share of Fund assets.
Non-reentrant and atomic. The caller must hold and approve `gbxAmount`. Every payout is `floor(balanceBefore * gbxAmount / effectiveSupplyBeforeBurn)` in the selected token's raw units, using one denominator that includes all accrued unminted Mine emission. Balances are snapshotted before the GBX burn. Each nonzero asset transfer must debit Fund and credit `receiver` by the exact payout, and no selected transfer may consume another selected address's backing. Tokens omitted by the caller remain in Fund and that redeemer permanently forfeits their share. The token array has no length cap beyond transaction gas. Any validation, burn, or transfer failure reverts all work. Emits `Redeemed` after every selected token has passed its final balance check.

**Parameters**

- `gbxAmount`: Nonzero raw GBX amount transferred from and burned for the caller.
- `receiver`: Nonzero, non-Fund address receiving every selected asset payout; may differ from the caller.
- `tokens`: Nonempty array of unique, nonzero, non-GBX token addresses selected by the caller.

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

Public ABI: 20 functions, 6 events, 22 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address)`

```solidity
constructor(address initialMinter);
```

Creates GBX with zero supply and a temporary deployment-time setup authority.
`initialMinter` may perform the one-time handoff but cannot mint while `minterLocked` is false.

**Parameters**

- `initialMinter`: Nonzero account authorized to bind the canonical Mine exactly once.

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

### `burn(uint256)`

```solidity
function burn(uint256 amount) external;
```

Permanently burns GBX held by the caller.
Requires the caller to hold at least `amount`; increases the monotonic lifetime-burned count and does not alter or reopen mint authority. Emits inherited `Transfer` and protocol `Burned` events.

**Parameters**

- `amount`: Nonzero raw GBX amount to burn from the caller.

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

Cumulative raw GBX units permanently destroyed by all burns.

### `lifetimeMinted()`

```solidity
function lifetimeMinted() external view returns (uint256 arg0);
```

Cumulative raw GBX units created by the permanently selected Mine.

### `mint(address,uint256)`

```solidity
function mint(address account, uint256 amount) external;
```

Mints GBX through the permanently selected Mine.
Callable only by the locked `minter`. Increases both total supply and the monotonic lifetime-minted count, then emits inherited `Transfer` and protocol `Minted` events.

**Parameters**

- `account`: Nonzero account receiving the newly issued GBX.
- `amount`: Nonzero raw GBX amount to mint.

### `minter()`

```solidity
function minter() external view returns (address arg0);
```

Current setup authority before locking and sole mint caller after the one-time Mine handoff.

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
Callable only by the current `minter` while unlocked. `newMinter` must contain deployed code and return this token from `IMine.gbx()`. Success sets `minterLocked` forever and emits `MinterSet`; burns cannot reopen the handoff.

**Parameters**

- `newMinter`: Canonical Mine contract that will become the sole lifetime mint caller.

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

## Mine

Source: [`src/core/Mine.sol`](../../packages/contracts/src/core/Mine.sol)

Artifact: `out/Mine.sol/Mine.json`

Public ABI: 29 functions, 5 events, 9 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address)`

```solidity
constructor(contract GBX gbx_, contract IERC20 usdg_, address resonanceRouter_);
```

Creates the immutable mining market with sixteen empty slots.
Requires all three dependencies to contain deployed code. Reciprocal GBX mint-authority binding and the Router's USDG identity are deployment-time checks performed outside this constructor.

**Parameters**

- `gbx_`: GBX token this Mine will mint after the one-time authority handoff.
- `resonanceRouter_`: Router that receives each nominal protocol payment share.
- `usdg_`: Standard USDG token paid by miners in raw units.

### `BPS()`

```solidity
function BPS() external view returns (uint256 arg0);
```

Basis-point denominator used for replacement-payment allocation; 10,000 represents 100%.

### `HALVING_PERIOD()`

```solidity
function HALVING_PERIOD() external view returns (uint256 arg0);
```

Provisional fixed interval in seconds between prospective global-rate halvings.

### `INITIAL_TPS()`

```solidity
function INITIAL_TPS() external view returns (uint256 arg0);
```

Provisional initial prospective global emission rate, in raw GBX units per second.

### `MAX_INITIAL_PRICE()`

```solidity
function MAX_INITIAL_PRICE() external view returns (uint256 arg0);
```

Maximum starting price for every newly opened auction, in raw USDG units.

### `MAX_MESSAGE_BYTES()`

```solidity
function MAX_MESSAGE_BYTES() external view returns (uint256 arg0);
```

Maximum raw byte length of the event-only message attached to a mining replacement.

### `MIN_INITIAL_PRICE()`

```solidity
function MIN_INITIAL_PRICE() external view returns (uint256 arg0);
```

Minimum starting price for every newly opened auction, in raw USDG units.

### `PREVIOUS_MINER_BPS()`

```solidity
function PREVIOUS_MINER_BPS() external view returns (uint256 arg0);
```

Share of a paid nonempty-slot replacement credited to the outgoing tenure miner, in basis points.

### `PRICE_DECAY_PERIOD()`

```solidity
function PRICE_DECAY_PERIOD() external view returns (uint256 arg0);
```

Duration in seconds over which each replacement price decays linearly to zero.

### `PRICE_MULTIPLIER()`

```solidity
function PRICE_MULTIPLIER() external view returns (uint256 arg0);
```

Dimensionless multiplier applied to each paid price to start the next auction.

### `SLOT_COUNT()`

```solidity
function SLOT_COUNT() external view returns (uint256 arg0);
```

Permanent number of independent mining slots.

### `TAIL_TPS()`

```solidity
function TAIL_TPS() external view returns (uint256 arg0);
```

Provisional strictly positive prospective global tail rate, in raw GBX units per second.

### `aggregateTps()`

```solidity
function aggregateTps() external view returns (uint256 arg0);
```

Sum of all occupied slots' tenure-locked rates, in raw GBX units per second.

### `claimMinerPayment(address)`

```solidity
function claimMinerPayment(address account) external;
```

Pays an account's complete accumulated outgoing-tenure USDG claim.
Permissionless and non-reentrant: the caller may trigger another account's claim, but payment always goes directly to `account`. State is cleared before the supported standard USDG transfer is requested, and `MinerPaymentClaimed` is emitted after payment.

**Parameters**

- `account`: Outgoing tenure miner receiving its complete claim in raw USDG units.

### `claimableMinerPayment(address)`

```solidity
function claimableMinerPayment(address account) external view returns (uint256 amount);
```

Pull-based raw USDG replacement proceeds owed to each outgoing tenure miner.

### `currentPrice(uint256)`

```solidity
function currentPrice(uint256 slotIndex) external view returns (uint256 paymentAmount);
```

Returns one slot's current linearly decaying USDG replacement price.
The elapsed decay component rounds down, and the returned price is zero at or after one decay period.

**Parameters**

- `slotIndex`: Zero-based slot to quote.

**Returns**

- `paymentAmount`: Current replacement payment in raw USDG units.

### `effectiveTotalSupply()`

```solidity
function effectiveTotalSupply() external view returns (uint256 amount);
```

Returns current GBX total supply plus all accrued unminted mining emission.
This constant-time view does not mint GBX, settle a slot, or change an occupied tenure's rate.

**Returns**

- `amount`: Economically effective GBX supply in raw units.

### `gbx()`

```solidity
function gbx() external view returns (contract GBX arg0);
```

Canonical GBX token this contract mints after the external one-time authority binding.

### `mine(address,uint256,uint256,uint256,uint256,string)`

```solidity
function mine(address miner, uint256 slotIndex, uint256 expectedEpochId, uint256 deadline, uint256 maximumPayment, string message) external returns (uint256 paymentAmount);
```

Starts a new tenure in one slot at its current linearly decaying USDG price.
Permissionless and non-reentrant. The caller pays for any nonzero price, while `miner` receives the tenure. The outgoing slot is settled before its rate is replaced. For a nonempty slot, 80% of the payment rounded down becomes a pull claim and the remainder goes to ResonanceRouter; an empty slot sends 100% to the Router. The optional message is emitted in `Mined` and is never stored. Every success emits `Mined`; an occupied tenure may additionally emit `EmissionSettled` and `MinerPaymentAccrued`, and any nonzero protocol share emits `RevenueDeposited`. Execution is allowed at `deadline` exactly.

**Parameters**

- `deadline`: Latest Unix timestamp at which the replacement may execute.
- `expectedEpochId`: Expected slot epoch, protecting against an earlier replacement.
- `maximumPayment`: Maximum raw USDG payment accepted by the caller.
- `message`: Optional event-only message of at most `MAX_MESSAGE_BYTES` raw bytes.
- `miner`: Account receiving the slot and its later GBX emission.
- `slotIndex`: Zero-based slot to replace.

**Returns**

- `paymentAmount`: Actual raw USDG payment required at execution time.

### `nextGlobalTps()`

```solidity
function nextGlobalTps() external view returns (uint256 tps);
```

Returns the global rate that the next replacement will divide by sixteen.
The rate halves at completed `HALVING_PERIOD` boundaries after deployment and never falls below `TAIL_TPS`. A new tenure receives this rate divided by `SLOT_COUNT`, rounded down. Existing occupied slots retain their previously assigned rates.

**Returns**

- `tps`: Prospective global emission rate in raw GBX units per second.

### `pendingEmission()`

```solidity
function pendingEmission() external view returns (uint256 amount);
```

Returns total accrued unminted GBX in constant time across all sixteen slots.
Combines the stored accumulator with elapsed whole-second emission at the current aggregate rate.

**Returns**

- `amount`: Complete accrued unminted GBX amount in raw units.

### `pendingSlotEmission(uint256)`

```solidity
function pendingSlotEmission(uint256 slotIndex) external view returns (uint256 amount);
```

Returns accrued unminted GBX for one slot without changing its state.

**Parameters**

- `slotIndex`: Zero-based slot to read.

**Returns**

- `amount`: Accrued unminted GBX for the slot, in raw units; zero while the slot is empty.

### `pendingUpdatedAt()`

```solidity
function pendingUpdatedAt() external view returns (uint256 arg0);
```

Unix timestamp through which `storedPendingEmission` incorporates `aggregateTps`.

### `resonanceRouter()`

```solidity
function resonanceRouter() external view returns (address arg0);
```

Router receiving the nominal Resonance share of replacement payments for later routing.

### `slot(uint256)`

```solidity
function slot(uint256 slotIndex) external view returns (struct Mine.Slot slotState);
```

Returns the complete state of one mining slot without accruing or settling it.

**Parameters**

- `slotIndex`: Zero-based slot to read.

**Returns**

- `slotState`: Current slot state.

### `startTime()`

```solidity
function startTime() external view returns (uint256 arg0);
```

Unix timestamp anchoring the immutable time-based halving schedule.

### `storedPendingEmission()`

```solidity
function storedPendingEmission() external view returns (uint256 arg0);
```

Total unminted slot emission accrued through `pendingUpdatedAt`, in raw GBX units.

### `totalClaimableMinerPayments()`

```solidity
function totalClaimableMinerPayments() external view returns (uint256 arg0);
```

Total raw USDG units currently owed to outgoing tenure miners.

### `totalMined()`

```solidity
function totalMined() external view returns (uint256 arg0);
```

Cumulative raw GBX units actually minted when individual slots were replaced.

### `usdg()`

```solidity
function usdg() external view returns (contract IERC20 arg0);
```

Standard, non-rebasing USDG token paid in raw units to replace mining slots.

### Events

#### `EmissionSettled(address,uint256,uint256,uint256)`

```solidity
event EmissionSettled(address indexed miner, uint256 indexed slotIndex, uint256 indexed epochId, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `Mined(address,address,uint256,uint256,address,uint256,uint256,uint256,string)`

```solidity
event Mined(address indexed payer, address indexed miner, uint256 indexed slotIndex, uint256 epochId, address previousMiner, uint256 paymentAmount, uint256 nextInitialPrice, uint256 tps, string message);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MinerPaymentAccrued(address,uint256,uint256,uint256)`

```solidity
event MinerPaymentAccrued(address indexed miner, uint256 indexed slotIndex, uint256 indexed epochId, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MinerPaymentClaimed(address,uint256)`

```solidity
event MinerPaymentClaimed(address indexed account, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `RevenueDeposited(uint256,uint256,uint256)`

```solidity
event RevenueDeposited(uint256 indexed slotIndex, uint256 indexed epochId, uint256 amount);
```

_No additional NatSpec notice is present in the compiled artifact._

### Custom errors

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

#### `IndexOutOfBounds(uint256)`

```solidity
error IndexOutOfBounds(uint256 slotIndex);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MaximumPaymentExceeded(uint256,uint256)`

```solidity
error MaximumPaymentExceeded(uint256 paymentAmount, uint256 maximumPayment);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `MessageTooLong(uint256)`

```solidity
error MessageTooLong(uint256 length);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `NothingToClaim(address)`

```solidity
error NothingToClaim(address account);
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

## Resonance

Source: [`src/core/Resonance.sol`](../../packages/contracts/src/core/Resonance.sol)

Artifact: `out/Resonance.sol/Resonance.json`

Public ABI: 36 functions, 10 events, 19 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,address,address)`

```solidity
constructor(contract IERC20 signalGBX_, contract IERC20 usdg_, address fund_, contract BribeFactory bribeFactory_, contract StrategyFactory strategyFactory_, address initialOwner);
```

Creates the allocator with immutable token, Fund, factory, and initial governance dependencies.
Every protocol dependency except `initialOwner` must be nonzero and have deployed code. OpenZeppelin `Ownable` rejects a zero `initialOwner`. Factories and ResonanceRouter are reciprocally bound separately.

**Parameters**

- `bribeFactory_`: Factory that deploys each Strategy's Bribe.
- `fund_`: Treasury receiving the non-Bribe share of Strategy payments.
- `initialOwner`: Deployment-time governance address for the bounded administration surface.
- `signalGBX_`: Non-transferable signal receipt and sole signal coordinator.
- `strategyFactory_`: Factory that deploys each Strategy and BribeRouter pair.
- `usdg_`: ERC-20 revenue token; canonical deployments use USDG with six decimals, which is not enforced.

### `BPS()`

```solidity
function BPS() external view returns (uint256 arg0);
```

Basis-point denominator used to split each Strategy payment between Fund and its paired BribeRouter.

### `DEFAULT_BRIBE_BPS()`

```solidity
function DEFAULT_BRIBE_BPS() external view returns (uint256 arg0);
```

Initial prospective Strategy-payment share assigned to the paired BribeRouter, in basis points.

### `MAX_BRIBE_BPS()`

```solidity
function MAX_BRIBE_BPS() external view returns (uint256 arg0);
```

Maximum prospective Strategy-payment share assignable to a paired BribeRouter, in basis points.

### `REWARD_DURATION()`

```solidity
function REWARD_DURATION() external view returns (uint256 arg0);
```

Fixed duration of every USDG revenue stream, in seconds.

### `REWARD_PRECISION()`

```solidity
function REWARD_PRECISION() external view returns (uint256 arg0);
```

Fixed-point precision used to allocate raw USDG units across raw SignalGBX units.

### `addBribeRewardToken(address,address)`

```solidity
function addBribeRewardToken(address strategy, address rewardToken) external;
```

Registers an additional independently funded reward token on a registered Strategy's Bribe.
Callable only by the current owner. The Strategy may be live or killed. The reward token must be a deployed contract and cannot be SignalGBX. The paired Bribe enforces its append-only sixteen-token registry, duplicate-token rejection, and all later notification rules. The Bribe's `RewardTokenAdded` event precedes `BribeRewardTokenAdded`.

**Parameters**

- `rewardToken`: ERC-20 token to add to the paired Bribe's reward registry.
- `strategy`: Registered Strategy whose paired Bribe receives the token.

### `addSignalFor(address,address,uint256)`

```solidity
function addSignalFor(address account, address strategy, uint256 amount) external;
```

Adds signal weight for an account to a live Strategy.
Callable only by the immutable SignalGBX coordinator. Elapsed revenue is checkpointed for the Strategy at its prior weight before `totalSignalWeight` and the paired Bribe's canonical virtual balances increase. Reverts for a zero account, zero amount, unregistered Strategy, or killed Strategy. Emits `SignalAdded` after the paired Bribe emits `SignalWeightAdded`.

**Parameters**

- `account`: SignalGBX holder whose paired-Bribe weight increases.
- `amount`: Raw SignalGBX units to add.
- `strategy`: Live registered Strategy receiving the weight.

### `addStrategy(address,(uint256,uint256,uint256,uint256))`

```solidity
function addStrategy(contract IERC20 paymentToken, struct Strategy.Config config) external returns (address strategyAddress, address bribeAddress, address bribeRouterAddress);
```

Creates and registers a Strategy, its canonical Bribe, and its BribeRouter as one atomic graph.
Callable only by the current owner. `paymentToken` must be a deployed ERC-20-like contract and cannot be SignalGBX. The payment token is registered as the paired Bribe's first reward token. The new Strategy's revenue checkpoint starts at the stored global index; its zero initial signal weight prevents it from claiming historical revenue. Factory or constructor validation failures revert the complete graph creation. Factory and paired-Bribe creation events precede the final `StrategyAdded` event.

**Parameters**

- `config`: Immutable reverse-Dutch-auction configuration for the new Strategy.
- `paymentToken`: ERC-20 asset buyers must pay to fill the new Strategy and its automatic Bribe reward token.

**Returns**

- `bribeAddress`: Newly deployed Bribe and canonical signal-weight ledger for the Strategy.
- `bribeRouterAddress`: Newly deployed buffer for the Strategy's automatic Bribe share.
- `strategyAddress`: Newly deployed and registered Strategy.

### `bribeBps()`

```solidity
function bribeBps() external view returns (uint256 arg0);
```

Current prospective share of each Strategy payment sent to its BribeRouter, in basis points.

### `bribeFactory()`

```solidity
function bribeFactory() external view returns (contract BribeFactory arg0);
```

Immutable Resonance-bound factory used to deploy one canonical Bribe per Strategy.

### `bribeFor(address)`

```solidity
function bribeFor(address strategy) external view returns (address bribe);
```

Canonical Bribe virtual-weight and reward contract paired with each registered Strategy.

### `bribeRouterFor(address)`

```solidity
function bribeRouterFor(address strategy) external view returns (address router);
```

Bribe-only payment-token buffer paired with each registered Strategy.

### `distributeRevenue(address)`

```solidity
function distributeRevenue(address strategy) external returns (uint256 amount);
```

Checkpoints and transfers one registered Strategy's accrued USDG to that Strategy.
Permissionless, including for killed Strategies with preserved accrual. Returns zero and emits no event when nothing is owed. The Strategy-level index conversion rounds down to whole raw USDG units. A failed USDG transfer reverts the checkpoint and claim reset atomically. A successful nonzero transfer emits `RevenueDistributed`.

**Parameters**

- `strategy`: Registered Strategy whose fixed address receives the transfer.

**Returns**

- `amount`: Whole raw USDG units transferred, or zero when no revenue is accrued.

### `earnedRevenue(address)`

```solidity
function earnedRevenue(address strategy) external view returns (uint256 revenue);
```

Returns one Strategy's stored plus currently elapsed USDG entitlement.
Does not mutate checkpoints. Only a live Strategy's canonical paired-Bribe weight participates in elapsed allocation; a killed Strategy returns only the revenue preserved when it was checkpointed. Conversion from the scaled index rounds down to whole raw USDG units.

**Parameters**

- `strategy`: Strategy whose entitlement is queried.

**Returns**

- `revenue`: Whole raw USDG units currently transferable to the Strategy.

### `fund()`

```solidity
function fund() external view returns (address arg0);
```

Immutable treasury that receives the non-Bribe share of every Strategy payment.

### `isStrategyLive(address)`

```solidity
function isStrategyLive(address strategy) external view returns (bool live);
```

Whether a registered Strategy can receive new signal and accrue future Resonance revenue.

### `isStrategyRegistered(address)`

```solidity
function isStrategyRegistered(address strategy) external view returns (bool registered);
```

Whether an address was created and permanently registered as a Strategy by this Resonance.

### `killStrategy(address)`

```solidity
function killStrategy(address strategy) external;
```

Permanently stops a registered Strategy from receiving new signal or future Resonance revenue.
Callable only by the current owner. Checkpoints the Strategy under its full prior weight, preserves that accrued USDG for later permissionless distribution, marks the Strategy dead, and removes its complete paired-Bribe weight from the active total. Existing signal and Bribe rewards remain recorded and removable. After the first Strategy is registered, the final live Strategy cannot be killed. Emits `StrategyKilled`.

**Parameters**

- `strategy`: Live registered Strategy to kill irreversibly.

### `liveStrategyCount()`

```solidity
function liveStrategyCount() external view returns (uint256 arg0);
```

Number of registered Strategies that remain eligible for new signal and future Resonance revenue.

### `notifyRevenue(uint256)`

```solidity
function notifyRevenue(uint256 amount) external;
```

Pulls newly routed USDG and restarts the global seven-day revenue stream.
Callable only by the permanently bound ResonanceRouter. First checkpoints global accrual through the prior period's applicable timestamp. During an active period, `amount` must be at least `remainingRevenue()`; the new schedule contains both the transferred amount and that previously scheduled remainder. Division by `REWARD_DURATION` rounds the new per-second rate down, leaving any unscheduled raw-unit remainder as contract surplus. The standard Router additionally requires at least `REWARD_DURATION` raw units so this rate is nonzero. USDG balance deltas are not measured; the schedule uses the nominal `amount` under the standard-token assumption. Reverts for zero, insufficient active-period revenue, or a failed USDG transfer. Emits `RevenueNotified` after the new schedule is stored.

**Parameters**

- `amount`: Newly supplied raw USDG units to pull from ResonanceRouter, excluding the prior remainder.

### `owner()`

```solidity
function owner() external view returns (address arg0);
```

Returns the address of the current owner.

### `remainingRevenue()`

```solidity
function remainingRevenue() external view returns (uint256 amount);
```

Returns the USDG still scheduled at the active stream's stored whole-unit rate.
Returns zero at or after `periodFinish`. This excludes already elapsed Strategy entitlements, notification remainders lost to rate flooring, zero-weight emissions, and direct token donations.

**Returns**

- `amount`: Whole raw USDG units scheduled between the current timestamp and `periodFinish`.

### `removeSignalFor(address,address,uint256)`

```solidity
function removeSignalFor(address account, address strategy, uint256 amount) external;
```

Removes signal weight for an account from a registered Strategy.
Callable only by the immutable SignalGBX coordinator. Elapsed revenue is checkpointed at the Strategy's prior weight before the paired Bribe's canonical virtual balances decrease. Exits remain available after a Strategy is killed; killed weight was removed from `totalSignalWeight` at kill time and is not subtracted a second time. Reverts for a zero account or amount, an unregistered Strategy, or an amount exceeding the account's weight in the paired Bribe. Emits `SignalRemoved` after the paired Bribe emits `SignalWeightRemoved`.

**Parameters**

- `account`: SignalGBX holder whose paired-Bribe weight decreases.
- `amount`: Raw SignalGBX units to remove.
- `strategy`: Registered live or killed Strategy losing the weight.

### `renounceOwnership()`

```solidity
function renounceOwnership() external;
```

Leaves the contract without owner. It will not be possible to call `onlyOwner` functions. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby disabling any functionality that is only available to the owner.

### `resonanceRouter()`

```solidity
function resonanceRouter() external view returns (address arg0);
```

Sole validated ResonanceRouter authorized to supply USDG and notify Resonance revenue; zero pre-bind.

### `revenueData()`

```solidity
function revenueData() external view returns (uint256 periodFinish, uint256 revenueRate, uint256 lastUpdateTime, uint256 revenuePerSignalStored);
```

Current global stream timestamps, whole-unit rate, and checkpointed revenue-per-signal index.

### `revenuePerSignal()`

```solidity
function revenuePerSignal() external view returns (uint256 accumulatedRevenue);
```

Returns the current cumulative USDG allocation per raw unit of active SignalGBX weight.
Includes elapsed time through the earlier of the current timestamp and `periodFinish` without mutating storage. If active weight is zero, the index does not increase and revenue elapsed during that interval is unallocated surplus. The index increment rounds down at `REWARD_PRECISION`.

**Returns**

- `accumulatedRevenue`: Cumulative raw USDG units multiplied by `REWARD_PRECISION` per raw signal unit.

### `setBribeBps(uint256)`

```solidity
function setBribeBps(uint256 newBribeBps) external;
```

Sets the prospective paired-Bribe share for every later Strategy purchase.
Callable only by the current owner. Values from zero through `MAX_BRIBE_BPS` are accepted. Each Strategy snapshots this value before token interaction, so earlier and in-flight purchases and active Bribe reward streams are not repriced. Emits `BribeBpsSet`, including when `newBribeBps` equals the current value.

**Parameters**

- `newBribeBps`: New global share in basis points, from zero through `MAX_BRIBE_BPS`.

### `setResonanceRouter(address)`

```solidity
function setResonanceRouter(address resonanceRouter_) external;
```

Permanently binds the sole ResonanceRouter allowed to notify USDG revenue.
Callable only by the current owner and only before a Router is bound. The candidate must be a deployed contract whose identity getters return this Resonance and the immutable `usdg`; missing or reverting identity getters fail validation. The binding cannot be replaced or cleared. Emits `ResonanceRouterSet`.

**Parameters**

- `resonanceRouter_`: Router candidate to validate and bind.

### `signalGBX()`

```solidity
function signalGBX() external view returns (contract IERC20 arg0);
```

Immutable non-transferable receipt and sole coordinator allowed to change Strategy signal weights.

### `strategyFactory()`

```solidity
function strategyFactory() external view returns (contract StrategyFactory arg0);
```

Immutable Resonance-bound factory used to deploy Strategies and their paired BribeRouters.

### `strategyRevenue(address)`

```solidity
function strategyRevenue(address strategy) external view returns (uint256 revenue);
```

Stored whole raw USDG units accrued and not yet transferred to each registered Strategy.

### `strategyRevenuePerSignalPaid(address)`

```solidity
function strategyRevenuePerSignalPaid(address strategy) external view returns (uint256 paid);
```

Per-Strategy checkpoint of the scaled global revenue-per-signal index already incorporated into accrual.

### `totalSignalWeight()`

```solidity
function totalSignalWeight() external view returns (uint256 arg0);
```

Total raw SignalGBX weight across live Strategies currently eligible for Resonance revenue.

### `transferOwnership(address)`

```solidity
function transferOwnership(address newOwner) external;
```

Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.

### `usdg()`

```solidity
function usdg() external view returns (contract IERC20 arg0);
```

Immutable USDG revenue token streamed to Strategies and accounted for only in raw token units.

### Events

#### `BribeBpsSet(uint256,uint256)`

```solidity
event BribeBpsSet(uint256 previousBribeBps, uint256 newBribeBps);
```

_No additional NatSpec notice is present in the compiled artifact._

#### `BribeRewardTokenAdded(address,address,address)`

```solidity
event BribeRewardTokenAdded(address indexed strategy, address indexed bribe, address indexed rewardToken);
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

#### `RevenueBelowRemaining(uint256,uint256)`

```solidity
error RevenueBelowRemaining(uint256 amount, uint256 remaining);
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

Public ABI: 3 functions, 2 events, 4 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address)`

```solidity
constructor(contract IERC20 usdg_, address resonance_);
```

Creates an immutable USDG route into a single Resonance receiver.
Both dependencies must be nonzero deployed contracts. Reciprocal Resonance and USDG identities are checked later when the Resonance owner calls `Resonance.setResonanceRouter`.

**Parameters**

- `resonance_`: Resonance contract that receives and schedules routed USDG.
- `usdg_`: USDG token forwarded by the Router.

### `resonance()`

```solidity
function resonance() external view returns (address arg0);
```

Immutable Resonance receiver that schedules and indexes routed USDG.

### `route()`

```solidity
function route() external returns (uint256 amount);
```

Routes the Router's complete USDG balance when it satisfies Resonance's current threshold.
Permissionless. The threshold is the greater of Resonance's remaining active revenue and the raw-unit duration required to create a nonzero whole-unit-per-second stream. Returns zero without transferring when a nonzero balance is below that threshold and emits `RevenueHeld`; reverts when the balance is zero. On a qualifying attempt, exact approval, Resonance notification, USDG transfer, and `RevenueRouted` emission are atomic; downstream failure leaves the balance retryable in the Router.

**Returns**

- `amount`: Nominal raw USDG units routed under the standard-token assumption, or zero below the threshold.

### `usdg()`

```solidity
function usdg() external view returns (contract IERC20 arg0);
```

Immutable USDG revenue token forwarded by this Router, accounted for in raw token units.

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

Creates the `SignalGumBall6900` (`sGBX`) receipt and assigns deployment-time setup ownership.
Uses 18 decimals inherited from ERC-20 and EIP-712 version `1` for ERC20Votes signatures. Reverts with `ZeroAddress` unless `gbx_` is a nonzero contract. OpenZeppelin `Ownable` rejects a zero `initialOwner`; renouncing ownership before binding Resonance permanently prevents signaling setup from completing.

**Parameters**

- `gbx_`: Standard ERC-20 GBX token deposited and returned one-for-one in raw units.
- `initialOwner`: Deployment-time owner responsible for the one-time Resonance binding.

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

Returns the immutable underlying GBX escrowed one raw unit per raw sGBX unit minted.

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

Moves an account's signal weight from one Strategy to another without changing GBX custody or sGBX.
Resonance removes source weight before adding destination weight, checkpointing both Strategies and paired Bribes under their prior weights. The source may be killed, but the destination must be live. A failed destination addition reverts the earlier removal. Supply, balances, delegation, and voting units do not change. No cooldown or epoch restriction applies. This contract emits no event, while Resonance and the two paired Bribes emit their removal and addition events.

**Parameters**

- `amount`: Nonzero raw signal units moved; cannot exceed the caller's source position.
- `fromStrategy`: Strategy losing signal weight; may already be killed.
- `toStrategy`: Registered live Strategy receiving signal weight; must differ from `fromStrategy`.

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

Returns the permanently bound Resonance that applies signal changes, or zero before setup completes.

### `setResonance(address)`

```solidity
function setResonance(address resonance_) external;
```

Permanently binds the Resonance dependency after reciprocal SignalGBX identity validation.
Callable only by the current owner and only while `resonance` is zero. The candidate must be a nonzero contract whose `signalGBX()` identity getter returns this receipt; a failed call or mismatch reverts with `InvalidResonance`. Successful binding emits `ResonanceSet` and has no replacement path. It does not automatically transfer or renounce inherited ownership.

**Parameters**

- `resonance_`: Resonance contract address to validate and bind.

### `signal(address,uint256)`

```solidity
function signal(address strategy, uint256 amount) external;
```

Deposits GBX, mints equal sGBX, and assigns equal signal weight to one live Strategy atomically.
Pulls GBX from the caller using its existing allowance. If the caller has no current delegate, the newly minted voting units self-delegate; an existing delegate is preserved. Resonance and the paired Bribe then checkpoint prior weights before adding the signal. Any failed transfer, mint, or Resonance hook reverts the complete transition. The function is unavailable before the one-time Resonance binding. Emits `Signaled` after the complete transition; inherited mint and delegation events and downstream signal events also apply.

**Parameters**

- `amount`: Nonzero raw units of GBX deposited, sGBX minted, and signal weight assigned.
- `strategy`: Registered live Strategy receiving the complete new signal weight.

### `signalWithPermit(address,uint256,uint256,uint8,bytes32,bytes32)`

```solidity
function signalWithPermit(address strategy, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
```

Attempts an ERC-2612 permit on GBX, then performs the same atomic transition as `signal`.
The permit authorizes this contract to spend `amount` from the caller. Permit failure is deliberately ignored, allowing a pre-consumed signature or an existing allowance to proceed; `safeTransferFrom` remains the authoritative custody and authorization check. A successful permit is rolled back if any later step reverts. This function does not add permit support to the sGBX receipt itself. Emits `Signaled` after the complete transition; inherited mint and delegation events and downstream signal events also apply.

**Parameters**

- `amount`: Nonzero raw units of GBX deposited, sGBX minted, and signal weight assigned.
- `deadline`: Unix timestamp after which the underlying GBX permit is invalid.
- `r`: ECDSA `r` component for the GBX permit signature.
- `s`: ECDSA `s` component for the GBX permit signature.
- `strategy`: Registered live Strategy receiving the complete new signal weight.
- `v`: ECDSA recovery identifier for the GBX permit signature.

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

Removes signal weight, burns equal sGBX, and returns equal GBX to the caller atomically.
Resonance first checkpoints revenue and the paired Bribe checkpoints rewards under the prior weight. Exits remain available when `strategy` is killed. Burning updates ERC20Votes checkpoints before GBX is transferred; a failed hook, burn, or transfer reverts the transition. Direct GBX donations are not part of the one-for-one entitlement. No cooldown, epoch restriction, or withdrawal lock applies. Emits `SignalWithdrawn` after completion; inherited burn events and downstream removal events also apply.

**Parameters**

- `amount`: Nonzero raw units of signal removed, sGBX burned, and GBX returned.
- `strategy`: Strategy losing signal weight; may already be killed.

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

#### `SameStrategy(address)`

```solidity
error SameStrategy(address strategy);
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

Public ABI: 20 functions, 1 event, 11 custom errors, 1 constructor, 0 receive entries, 0 fallback entries.

### `constructor(address,address,address,address,(uint256,uint256,uint256,uint256))`

```solidity
constructor(address resonance_, contract IERC20 usdg_, contract IERC20 paymentToken_, address fund_, struct Strategy.Config config);
```

Creates one Strategy and starts its zero-based first auction epoch immediately.
All address dependencies must be nonzero deployed contracts. Configuration validation enforces duration, multiplier, minimum-price, and absolute-price bounds; `initialPrice` must be at least `minimumPrice`.

**Parameters**

- `config`: Immutable auction configuration expressed in seconds, raw payment units, and fixed-point scale.
- `fund_`: Treasury receiving the non-Bribe share of every auction payment.
- `paymentToken_`: ERC-20 asset buyers pay to fill this Strategy.
- `resonance_`: Resonance that releases USDG and provides split and BribeRouter configuration.
- `usdg_`: USDG revenue token sold by this Strategy.

### `ABSOLUTE_MAXIMUM_PRICE()`

```solidity
function ABSOLUTE_MAXIMUM_PRICE() external view returns (uint256 arg0);
```

Absolute upper bound for a starting or minimum price, in raw payment-token units.

### `ABSOLUTE_MINIMUM_PRICE()`

```solidity
function ABSOLUTE_MINIMUM_PRICE() external view returns (uint256 arg0);
```

Absolute lower bound for `minimumPrice`, in raw payment-token units regardless of token decimals.

### `BPS()`

```solidity
function BPS() external view returns (uint256 arg0);
```

Basis-point denominator used to split each acquired payment.

### `MAX_EPOCH_DURATION()`

```solidity
function MAX_EPOCH_DURATION() external view returns (uint256 arg0);
```

Longest permitted price-decay period, in seconds.

### `MAX_PRICE_MULTIPLIER()`

```solidity
function MAX_PRICE_MULTIPLIER() external view returns (uint256 arg0);
```

Largest next-starting-price multiplier, scaled by `PRICE_SCALE`.

### `MIN_EPOCH_DURATION()`

```solidity
function MIN_EPOCH_DURATION() external view returns (uint256 arg0);
```

Shortest permitted price-decay period, in seconds.

### `MIN_PRICE_MULTIPLIER()`

```solidity
function MIN_PRICE_MULTIPLIER() external view returns (uint256 arg0);
```

Smallest next-starting-price multiplier, scaled by `PRICE_SCALE`.

### `PRICE_SCALE()`

```solidity
function PRICE_SCALE() external view returns (uint256 arg0);
```

Fixed-point scale representing a 1.0 next-starting-price multiplier.

### `buy(address,uint256,uint256,uint256)`

```solidity
function buy(address revenueReceiver, uint256 expectedEpochId, uint256 deadline, uint256 maximumPayment) external returns (uint256 paymentAmount);
```

Purchases all released and directly held Strategy USDG at the current declining price.
Permissionless. Snapshots Resonance's prospective Bribe share before token interaction, then checkpoints and pulls this Strategy's released USDG. The resulting complete USDG balance is fixed before payment is collected, which also keeps a Strategy priced in USDG from co-mingling payment with purchased revenue. The Bribe share is `floor(paymentAmount * bribeBps / BPS)` and the Fund receives the remainder, so split rounding favors Fund. A zero price after full decay skips payment collection, payment settlement, and BribeRouter interaction. All transfers, auction-state updates, and the event are atomic. Reverts for a zero receiver, expired deadline, stale epoch, empty USDG balance, payment above `maximumPayment`, a missing BribeRouter when the floored Bribe amount is nonzero, or a failed token operation. Emits `Purchased` after the next epoch is initialized.

**Parameters**

- `deadline`: Latest valid Unix timestamp; execution exactly at this timestamp is allowed.
- `expectedEpochId`: Active epoch expected by the buyer, protecting against a prior fill.
- `maximumPayment`: Maximum raw payment-token units authorized by the buyer.
- `revenueReceiver`: Address that receives the complete snapshotted USDG balance; need not equal the buyer.

**Returns**

- `paymentAmount`: Actual raw payment-token units required at execution, possibly zero.

### `currentPrice()`

```solidity
function currentPrice() external view returns (uint256 paymentAmount);
```

Returns the payment required to fill the active auction epoch at the current timestamp.
Before full decay, subtracts the floored elapsed-price fraction from `initialPrice`, which rounds the exact remaining-fraction price up to a whole raw token unit. Returns zero at and after `epochDuration` seconds.

**Returns**

- `paymentAmount`: Current price in raw payment-token units.

### `epochDuration()`

```solidity
function epochDuration() external view returns (uint256 arg0);
```

Immutable number of seconds over which each epoch's price declines to zero.

### `epochId()`

```solidity
function epochId() external view returns (uint256 arg0);
```

Zero-based identifier of the active auction epoch, incremented after every successful fill.

### `epochStartedAt()`

```solidity
function epochStartedAt() external view returns (uint256 arg0);
```

Unix timestamp at which the active epoch began.

### `fund()`

```solidity
function fund() external view returns (address arg0);
```

Immutable treasury that receives the payment remainder after the floored Bribe share.

### `initialPrice()`

```solidity
function initialPrice() external view returns (uint256 arg0);
```

Starting price of the active epoch, in raw payment-token units.

### `minimumPrice()`

```solidity
function minimumPrice() external view returns (uint256 arg0);
```

Immutable raw-payment-token floor applied only to each next epoch's starting price.

### `paymentToken()`

```solidity
function paymentToken() external view returns (contract IERC20 arg0);
```

Immutable ERC-20 asset required from buyers, accounted for in raw token units.

### `priceMultiplier()`

```solidity
function priceMultiplier() external view returns (uint256 arg0);
```

Immutable `PRICE_SCALE`-scaled multiplier applied to a completed epoch's clearing payment.

### `resonance()`

```solidity
function resonance() external view returns (address arg0);
```

Immutable Resonance that releases USDG and supplies the current Bribe split and paired BribeRouter.

### `usdg()`

```solidity
function usdg() external view returns (contract IERC20 arg0);
```

Immutable USDG revenue token sold by this Strategy, accounted for in raw token units.

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

Creates an unbound factory whose temporary owner may bind Resonance exactly once.
OpenZeppelin `Ownable` rejects a zero `initialOwner`.

**Parameters**

- `initialOwner`: Deployment-time owner responsible for the one-time Resonance binding.

### `createStrategy(address,address,address,address,(uint256,uint256,uint256,uint256))`

```solidity
function createStrategy(contract IERC20 usdg, contract IERC20 paymentToken, address fund, contract Bribe bribe, struct Strategy.Config config) external returns (contract Strategy strategy, contract BribeRouter bribeRouter);
```

Deploys a Strategy and its dedicated BribeRouter for the bound Resonance.
Callable only by `resonance`; an unbound factory therefore rejects every caller. Deployment is atomic and relies on the Strategy and BribeRouter constructors to validate code-bearing dependencies and auction configuration. The supplied Bribe becomes the Router's immutable destination, and `paymentToken` becomes both the Strategy's purchase asset and the Router's buffered reward asset. Emits `StrategyCreated` after both contracts are deployed.

**Parameters**

- `bribe`: Existing Bribe to pair with the new Strategy and Router.
- `config`: Immutable reverse-Dutch-auction configuration for the new Strategy.
- `fund`: Treasury receiving the non-Bribe share of each purchase payment.
- `paymentToken`: ERC-20 asset buyers pay and the BribeRouter buffers.
- `usdg`: USDG revenue token sold by the new Strategy.

**Returns**

- `bribeRouter`: Newly deployed BribeRouter paired with `strategy` and `bribe`.
- `strategy`: Newly deployed Strategy contract.

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

Permanently bound Resonance exclusively authorized to create Strategy graphs; zero before setup.

### `setResonance(address)`

```solidity
function setResonance(address resonance_) external;
```

Permanently binds the only Resonance allowed to create Strategy graphs.
Callable only by the current owner and only while unbound. The candidate must be a deployed contract whose `strategyFactory()` identity getter returns this factory; a missing or reverting getter fails validation. Emits `ResonanceSet` after the binding is stored.

**Parameters**

- `resonance_`: Resonance candidate to validate and bind.

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

### `REWARD_DURATION()`

```solidity
function REWARD_DURATION() external view returns (uint256 duration);
```

Returns the fixed duration assigned to each reward stream.

**Returns**

- `duration`: Reward duration in seconds; the production implementation returns seven days.

### `notifyReward(address,uint256)`

```solidity
function notifyReward(address rewardToken, uint256 amount) external;
```

Pulls fresh funding from the caller and starts or restarts a registered token's reward stream.
During an active stream, the implementation combines `amount` with the scheduled reward remaining and rounds the new whole-unit-per-second rate down over `REWARD_DURATION`. The fresh amount must meet both the duration and remaining-reward thresholds; implementation-specific registry and lifetime-cap checks apply.

**Parameters**

- `amount`: Fresh raw token units pulled from the caller.
- `rewardToken`: Registered standard ERC-20 token to pull and stream.

### `remainingReward(address)`

```solidity
function remainingReward(address rewardToken) external view returns (uint256 amount);
```

Returns raw token units still scheduled in a token's active reward stream.
The value is zero after the period finishes and excludes already elapsed rewards, direct donations, and any surplus produced when the stream rate was rounded down.

**Parameters**

- `rewardToken`: Reward token whose active stream is queried.

**Returns**

- `amount`: Raw token units remaining at the stored whole-unit-per-second rate.

## IMine

Source: [`src/core/interfaces/IMine.sol`](../../packages/contracts/src/core/interfaces/IMine.sol)

Artifact: `out/IMine.sol/IMine.json`

Public ABI: 3 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `effectiveTotalSupply()`

```solidity
function effectiveTotalSupply() external view returns (uint256 amount);
```

Returns current GBX total supply plus every occupied slot's accrued unminted GBX in constant time.

**Returns**

- `amount`: Economically effective supply in raw GBX units.

### `gbx()`

```solidity
function gbx() external view returns (address token);
```

Canonical GBX token minted by this contract.

**Returns**

- `token`: Canonical GBX token address.

### `pendingEmission()`

```solidity
function pendingEmission() external view returns (uint256 amount);
```

Returns accrued GBX that has not yet been minted across all sixteen slots in constant time.

**Returns**

- `amount`: Total accrued unminted emission in raw GBX units.

## IResonance

Source: [`src/core/interfaces/IResonance.sol`](../../packages/contracts/src/core/interfaces/IResonance.sol)

Artifact: `out/IResonance.sol/IResonance.json`

Public ABI: 8 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `REWARD_DURATION()`

```solidity
function REWARD_DURATION() external view returns (uint256 duration);
```

Returns the fixed duration of each Resonance USDG stream.

**Returns**

- `duration`: Stream duration in seconds.

### `addSignalFor(address,address,uint256)`

```solidity
function addSignalFor(address account, address strategy, uint256 amount) external;
```

Adds signal weight for an account to a live registered Strategy.
Callable only by the immutable SignalGBX coordinator. The Strategy is checkpointed at its prior weight before active total weight and paired-Bribe balances increase. Reverts for an unauthorized caller, zero account or amount, unregistered Strategy, or killed Strategy.

**Parameters**

- `account`: SignalGBX holder whose paired-Bribe weight increases.
- `amount`: Raw SignalGBX units to add.
- `strategy`: Live registered Strategy receiving the weight.

### `bribeBps()`

```solidity
function bribeBps() external view returns (uint256 basisPoints);
```

Returns the prospective global share of each Strategy payment assigned to its BribeRouter.
A Strategy snapshots this value before token interaction; it does not reprice prior purchases.

**Returns**

- `basisPoints`: Current payment share in basis points out of 10,000.

### `bribeRouterFor(address)`

```solidity
function bribeRouterFor(address strategy) external view returns (address router);
```

Returns the BribeRouter paired with a registered Strategy.

**Parameters**

- `strategy`: Strategy whose automatic-Bribe buffer is queried.

**Returns**

- `router`: Paired BribeRouter, or the zero address when no graph is registered for `strategy`.

### `distributeRevenue(address)`

```solidity
function distributeRevenue(address strategy) external returns (uint256 amount);
```

Checkpoints and transfers one registered Strategy's currently accrued USDG to that Strategy.
Permissionless and valid for live or killed Strategies. Returns zero without transferring when nothing is owed. A failed transfer reverts the checkpoint and claim reset atomically.

**Parameters**

- `strategy`: Registered Strategy whose fixed address receives the USDG.

**Returns**

- `amount`: Whole raw USDG units transferred, or zero when nothing is accrued.

### `notifyRevenue(uint256)`

```solidity
function notifyRevenue(uint256 amount) external;
```

Pulls newly routed USDG and restarts the global seven-day revenue stream.
Callable only by the permanently bound ResonanceRouter. During an active stream, the new amount must be at least the USDG still scheduled; the restarted schedule combines both values and rounds its whole-unit-per- second rate down. The schedule uses nominal `amount` under the standard-token assumption. Reverts for an unauthorized caller, zero amount, insufficient active-period amount, or failed USDG transfer.

**Parameters**

- `amount`: Nominal raw USDG units to pull from ResonanceRouter.

### `remainingRevenue()`

```solidity
function remainingRevenue() external view returns (uint256 amount);
```

Returns USDG still scheduled at the active stream's stored whole-unit-per-second rate.
Returns zero after the stream finishes and excludes unscheduled surplus, direct donations, and elapsed Strategy entitlements.

**Returns**

- `amount`: Whole raw USDG units scheduled from the current timestamp through stream completion.

### `removeSignalFor(address,address,uint256)`

```solidity
function removeSignalFor(address account, address strategy, uint256 amount) external;
```

Removes signal weight for an account from a registered live or killed Strategy.
Callable only by the immutable SignalGBX coordinator. The Strategy is checkpointed before its paired-Bribe weight decreases. Killed-Strategy exits do not reduce active total weight a second time. Reverts for an unauthorized caller, zero account or amount, unregistered Strategy, or insufficient account weight.

**Parameters**

- `account`: SignalGBX holder whose paired-Bribe weight decreases.
- `amount`: Raw SignalGBX units to remove.
- `strategy`: Registered live or killed Strategy losing the weight.

## IResonanceIdentity

Source: [`src/core/interfaces/IResonanceIdentity.sol`](../../packages/contracts/src/core/interfaces/IResonanceIdentity.sol)

Artifact: `out/IResonanceIdentity.sol/IResonanceIdentity.json`

Public ABI: 3 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `bribeFactory()`

```solidity
function bribeFactory() external view returns (address factory);
```

Returns the immutable BribeFactory controlled by Resonance.

**Returns**

- `factory`: BribeFactory contract address.

### `signalGBX()`

```solidity
function signalGBX() external view returns (address token);
```

Returns the immutable SignalGBX receipt used by Resonance.

**Returns**

- `token`: SignalGBX contract address and sole signal-weight coordinator.

### `strategyFactory()`

```solidity
function strategyFactory() external view returns (address factory);
```

Returns the immutable StrategyFactory controlled by Resonance.

**Returns**

- `factory`: StrategyFactory contract address.

## IResonanceRouter

Source: [`src/core/interfaces/IResonanceRouter.sol`](../../packages/contracts/src/core/interfaces/IResonanceRouter.sol)

Artifact: `out/IResonanceRouter.sol/IResonanceRouter.json`

Public ABI: 1 function, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `route()`

```solidity
function route() external returns (uint256 amount);
```

Routes the Router's complete USDG balance when it satisfies Resonance's current threshold.
Permissionless. The threshold is the greater of Resonance's remaining active revenue and the raw-unit duration required to create a nonzero whole-unit-per-second stream. Returns zero without transferring when a nonzero balance is below that threshold and emits `RevenueHeld`; reverts when the balance is zero. On a qualifying attempt, exact approval, Resonance notification, USDG transfer, and `RevenueRouted` emission are atomic; downstream failure leaves the balance retryable in the Router.

**Returns**

- `amount`: Nominal raw USDG units routed under the standard-token assumption, or zero below the threshold.

## IResonanceRouterIdentity

Source: [`src/core/interfaces/IResonanceRouter.sol`](../../packages/contracts/src/core/interfaces/IResonanceRouter.sol)

Artifact: `out/IResonanceRouter.sol/IResonanceRouterIdentity.json`

Public ABI: 2 functions, 0 events, 0 custom errors, 0 constructors, 0 receive entries, 0 fallback entries.

### `resonance()`

```solidity
function resonance() external view returns (address receiver);
```

Returns the immutable Resonance receiver used by the router.

**Returns**

- `receiver`: Resonance contract address.

### `usdg()`

```solidity
function usdg() external view returns (address token);
```

Returns the immutable USDG token forwarded by the router.

**Returns**

- `token`: USDG token address.
