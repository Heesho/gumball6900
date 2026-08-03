# @gumball-6900/sdk

Typed, bigint-only protocol helpers for GUM BALL 6900.

The complete public surface is published in the generated
[TypeScript SDK API reference](../../docs/reference/sdk/README.md). Regenerate it with `pnpm docs:generate` and verify
committed output with `pnpm docs:check`.

## Safety model

- Every financial value is a raw `bigint`; token decimals are carried explicitly where assets can differ.
- Composed read helpers pin all RPC calls to one block number and hash, then re-read the header before returning. Pass
  `{ atBlock, expectedBlockHash }` to bind multiple reads to one canonical block, or let each helper pin the latest block.
- Protocol addresses are accepted only through strict Zod schemas. `selectProtocolDeployment` is release-approved by default and fails on missing or ambiguous records.
- EIP-2612 typed data requires an explicit token name, version, nonce, chain, and deadline. The SDK never guesses a production signing domain.
- There is no generic multicall or arbitrary router builder. The only router helpers encode the bounded canonical `GumBallRouter` stake/redeem methods.
- The SDK does not expose guessed Universal Router commands or production addresses. Those remain unavailable until a release-approved deployment manifest is signed and verified.

## ABI pipeline

Committed ABIs are generated from Foundry artifacts:

```sh
forge build --root packages/contracts
pnpm sdk:abi:generate
pnpm sdk:abi:check
```

CI runs the drift check after `forge build`. Do not edit `src/generated-abis.ts` by hand.

## Package integrity

Build and inspect the exact npm artifact without publishing it:

```sh
pnpm --filter @gumball-6900/sdk pack:check
```

The check fails if the package contains anything outside `dist/`, `README.md`, and npm's generated
`package.json`, if required entry points are absent, or if a runtime dependency or bundled import
references a private workspace package. The SDK remains marked `private` until the repository's
license, release authorization, and publication destination are explicitly approved; the check does
not publish, sign, or upload an artifact.

The bundled Uniswap runtime intentionally omits its JavaScript source map because the upstream maps
contain package-manager-internal paths and incomplete source content. The executable bundle still
links its generated third-party legal-notice file, while TypeScript declaration maps remain available
for the SDK's public types.

## Core examples

```ts
import {
  buildEip2612PermitTypedData,
  buildRouterStakeWithPermit,
  GBX_TOKEN_NAME,
  pinBlockSnapshot,
  readMiningEpochView,
  readRedemptionPreview,
} from '@gumball-6900/sdk';

const snapshot = await pinBlockSnapshot(publicClient);
const readOptions = { atBlock: snapshot.blockNumber, expectedBlockHash: snapshot.blockHash };
const epoch = await readMiningEpochView(publicClient, { miningPool, miningClaims }, 42n, account, readOptions);

const redemption = await readRedemptionPreview(publicClient, gumBallLens, 1_000_000_000_000_000_000n, {
  ...readOptions,
});

const typedData = buildEip2612PermitTypedData({
  chainId: 4663,
  deadline,
  name: GBX_TOKEN_NAME,
  nonce,
  owner: account,
  spender: gumBallRouter,
  token: gbx,
  value: amount,
  version: '1',
});

const transaction = buildRouterStakeWithPermit(gumBallRouter, amount, deadline, signature);
```

Use `resolveAssetRegistry` before decoding multi-asset redemption results so each raw amount is paired with the registry token and its decimals.

Canonical USDG has six decimals. Use `CANONICAL_USDG_DECIMALS`, `parseTokenAmountRaw`, and `formatTokenAmountRaw`; never parse USDG with an 18-decimal default. Mining and genesis quote helpers require `usdGDecimals`, and auction helpers require both USDG and target-token decimals. Auction rates are human target tokens per human USDG, scaled by `1e18`; raw fill amounts remain token atomic units.

## Uniswap v4 math

`canonicalPoolKey`, `canonicalPoolId`, `sqrtPriceX96FromRawAmounts`, `sqrtPriceX96AtTick`, `tickAtSqrtPriceX96`, and price/tick conversion helpers delegate to pinned official Uniswap SDK packages. Pool token metadata, including six-decimal USDG, is mandatory. Inputs are exact raw integer ratios; UI formatting is intentionally outside this package. The build bundles this module because the pinned official packages' native ESM entry points are not directly executable by Node; the financial algorithms remain the pinned upstream implementations.

`readCanonicalV4Snapshot` uses reviewed read-only ABI subsets matching `IStateView` and `IPositionManager` from pinned `@uniswap/v4-periphery` `1.0.3`. It binds signed runtime addresses to LiquidityManager immutables, derives the PoolKey and PoolId through the official SDK, and validates StateView and PositionManager dependencies. A caller may supply a complete, duplicate-free active-position ID index of zero to 16 entries with its subgraph block number/hash, active count, and migration count. An exact zero count and empty list are valid after every range is swept; the reader still checks all four genesis records and rejects the empty index if any genesis NFT remains active. Every RPC read is pinned to that block; the SDK requires LiquidityManager's `MAX_ACTIVE_POSITIONS` to equal 16 and cross-checks both the onchain active-position and migration counters against the index. Every supplied candidate is then checked against LiquidityManager records and PositionManager custody/pool/ticks/liquidity, active genesis omissions are rejected, and the block number/hash are verified before and after the read. The fixed four-genesis-ID fallback is accepted only while the onchain migration count is zero and its active genesis records must equal the onchain active-position count. The contract enforces the 16-position lifetime active-set cap, so the bounded query can retrieve the complete set rather than a partial aggregate.

The exact human-unit USDG-per-GBX rational comes from the official v4 `Pool.priceOf(GBX)` with currency ordering and both decimal scales applied. Each active record's raw GBX/USDG principal is computed through official v4 `Pool` and `Position` math. Exact current uncollected fees use StateView `getPositionInfo` for the PositionManager-owned core position with `bytes32(tokenId)` salt plus `getFeeGrowthInside`; growth deltas wrap modulo `uint256`, then multiply by liquidity and floor at Q128 exactly like v4 core. Principal and fee aggregates are mapped from currency0/currency1 to GBX/USDG. Inventory fields remain exact ERC-20 balances held directly by LiquidityManager. The snapshot does not infer pool-wide reserves, NAV, or cross-asset display value.

`readCanonicalV4ExactInputQuote` applies the same block-header revalidation. Callers comparing more than one quote can pin
once with `pinBlockSnapshot` and pass its `blockNumber` and `blockHash` as `atBlock` and `expectedBlockHash` to every quote.
