# Canonical Uniswap v4 position

> The repository contains a minimal hookless integration. Exact network addresses and pool parameters are unresolved
> production inputs, and no canonical deployed pool is claimed here.

## Pool identity

The deployment script constructs one immutable `PoolKey`:

```text
currency0 = min(address(GBX), address(USDG))
currency1 = max(address(GBX), address(USDG))
fee = GBX_V4_POOL_FEE
tickSpacing = GBX_V4_TICK_SPACING
hooks = address(0)
```

The initial square-root price and tick range are supplied explicitly. The script rejects a zero price, a static fee
above `1_000_000`, spacing outside `1..32_767`, unaligned ticks, an inverted/out-of-bounds range, or a range that is
not entirely single-sided in GBX at the initialized tick.

If GBX is token0, the lower tick must be above the initial tick. If GBX is token1, the upper tick must be below the
initial tick. No USDG is supplied when the position is created.

## Maximal one-sided liquidity

`GenesisLiquidityMath` uses Uniswap v4 core/periphery math plus a bounded binary search to find the greatest `uint128`
liquidity whose rounded-up GBX principal does not exceed `20_000_000 ether`.

```text
principal <= 20_000_000 ether
principal + residualBurned = 20_000_000 ether
```

The script approves only the required GBX through Permit2, mints one position to the deployment account, clears both
approvals, burns the remaining GBX, and safe-transfers the NFT to `LiquidityCustodian`. It checks the PositionManager's
`nextTokenId()` before deploying the custodian and requires that same ID during mint and receipt.

The PositionManager mint receives the explicit absolute Unix timestamp in `GBX_V4_LIQUIDITY_DEADLINE`. The script
rejects a value at or before its execution timestamp and passes the reviewed value unchanged; it does not replace it
with `block.timestamp`. The selected deadline therefore needs deliberate margin for simulation, broadcast transaction
sequencing, and mining without becoming an unbounded standing authorization.

## Custody admission

The custodian records only one NFT and requires all of the following:

- caller is the immutable PositionManager;
- prior owner is the immutable deployment depositor;
- token ID equals the immutable expected token ID;
- the NFT reports the exact stored PoolKey; and
- the custodian owns the NFT during the receipt callback.

Unrelated NFTs, a second NFT, another depositor, or another PoolKey revert. The custodian has no ERC-20 or NFT rescue
function.

## Fee collection

Anyone may call `collectFees()` while the exact NFT remains in custody. The PositionManager call decreases zero
liquidity and takes the fee pair to the custodian. The custodian then:

1. measures newly received GBX and USDG;
2. burns all newly received GBX;
3. transfers all newly received USDG to `GumBallVault` with exact debit/receipt checks; and
4. notifies `AllocationVoter` only for the exact amount received by the vault.

Fee collection does not withdraw principal, change ticks, add liquidity, approve another operator, or change the
PoolKey. If no strategy has active signal weight, the USDG fee becomes idle and is not allocated later.

## Typed NFT transfer

`ProtocolTimelock` can schedule the exact tuple `(custodian, recipient, salt)`. After seven days, anyone can execute
the operation and the custodian safe-transfers only its recorded NFT. The recipient must be nonzero deployed code,
but no interface, runtime hash, or behavior is attested.

This is a material trust surface: the proposer can select arbitrary recipient code that accepts the NFT and can then
remove liquidity, change custody, or otherwise control the complete canonical position. The public delay is warning,
not a guarantee that the recipient is a safe successor. Once transferred, `positionInCustody()` is false and fee
collection through the original custodian stops.

## Deliberately absent functionality

The current source tree has no swap-time hook, access adapter, position ladder, active range management, extra
positions, generic migration engine, principal withdrawal method, leverage, lending, or oracle. Those features are
outside this rebuild and cannot be inferred from older repository history.

## Deployment evidence

A reviewed deployment must bind and independently verify:

- GBX and USDG ordering and code;
- PositionManager and Permit2 addresses and runtime code;
- `initialSqrtPriceX96`, fee, spacing, lower tick, upper tick, and the absolute future liquidity deadline;
- expected token ID, mint transaction, principal, liquidity, and residual burn;
- PositionManager ownership and exact PoolKey returned for the NFT;
- cleared ERC-20 and Permit2 approvals; and
- zero deployment-account GBX after the custody transfer.

None of those unresolved values is selected by this document.
