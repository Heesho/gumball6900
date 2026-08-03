# Web Application

`apps/web` is a strict TypeScript Next.js App Router application using React, wagmi, viem, TanStack Query, RainbowKit,
GraphQL requests, Tailwind CSS, shared UI primitives, Vitest, Playwright, and Storybook.

## Runtime safety model

The application has four explicit runtime selections:

- `live`: requires a release-approved deployment manifest whose signer policy exactly matches the public trust root
  embedded from reviewed source commit `C` (and byte-identical in evidence commit `E`), exact chain, remote HTTPS
  non-public production RPC, at least one independent HTTPS fallback RPC, and a remote HTTPS subgraph endpoint,
  complete unique protocol/asset/strategy/reward addresses, resolved compliance mode, and manifest coverage. Loopback
  endpoints are rejected outside explicit rehearsal mode.
- `testnet`: remote chain-46630 mode for a validated, signed `testnet-candidate` manifest with a satisfied positive
  signature threshold. It requires remote HTTPS RPC and subgraph endpoints, an independent HTTPS fallback, complete
  manifest/address coverage, exact testnet USDG/WETH bindings, and the provisional official testnet Permit2 binding.
  It is visibly labeled as a candidate and is never presented as mainnet, release-approved, audited, or launch
  evidence. Bespoke v4 core/periphery may be supplied and validated by the candidate manifest while the typed
  canonical testnet v4 config remains unresolved; that evidence is testnet-only and cannot be promoted or reused as
  canonical mainnet evidence. No mainnet address is substituted by assumption.
- `rehearsal`: non-production, chain-46630, localhost-only RPC/subgraph mode for the disposable Playwright fixture. It
  requires a validated `testnet-candidate` manifest and is visibly labeled as local test evidence.
- `demo`: visibly labeled fixture data; every contract write is disabled.

Invalid or incomplete live, testnet, or rehearsal configuration fails closed into demo mode. The client never silently
sends a transaction to provisional or zero addresses. The repository currently embeds an explicit unconfigured
release-manifest policy, so production live mode remains blocked until a reviewed policy ID, signer set, and threshold
are committed; signed remote testnet mode is blocked by the same current sentinel. There is no environment variable
that can replace or weaken this trust root. Testnet-candidate
validation uses the same manifest validator and requires a configured, satisfied positive signature policy; selecting
testnet mode does not weaken mainnet release validation. The schema-defined inactive policy remains limited to local
rehearsal within the web runtime.

## Transaction lifecycle

Every write follows:

```text
validate exact decimal input
  -> construct typed calldata
  -> simulate against the selected account and chain
  -> request wallet signature
  -> show submitted hash
  -> await receipt
  -> show confirmed or reverted result (including decoded per-asset redemption logs)
  -> refetch authoritative reads
```

Allowance steps are explicit. Redemption and auction panels show a fresh raw preview/quote and refuse submission
when it is stale or unavailable. Errors are presented as states rather than swallowed.

## Pages

- Home: live supply/mining, exact pinned vault balances and allocation state, indexed buyback totals and recent
  activity, plus a signed-identity Uniswap v4 snapshot. Refresh failures retain only explicitly stale, block-labeled
  data; unavailable sources never become invented zeroes or demo values.
- Mine: current epoch, demand-scaled estimate, approval/contribution, and claims.
- Manage: stake, immediate unstake, delayed signals, reset, budgets, reward claims, and permissionless terminal-dust
  sweeps. The dust view anchors one healthy subgraph block hash, derives every genesis and post-launch reward identity
  from GumBallLens at that same block, then follows chain-scoped `id_gt` pages until the complete unsettled set is read.
  Per-page responses are bounded to 128 rows; the overall result is not capped. Every page stays at the anchor hash and
  the sum for each rewards contract must equal its pinned onchain `totalPendingTerminalDust` before any sweep is shown.
- Vault: deterministic raw-balance preview in demo mode plus a live, hash-revalidated GumBallLens snapshot of every
  signed-manifest asset balance, registry flag, strategy weight, and virtual USDG budget. RHJ registry, trading-halt,
  multiplier, and corporate-action context remains presentation-only; unlike asset units are never summed into NAV.
- Redeem: percentage of total supply and every exact raw basket output before burn.
- Trade: manifest-bound v4 quote/route and a clear swap-versus-redemption comparison. Mainnet uses the canonical pool;
  remote testnet may use only its visibly candidate-bound bespoke pool and exposes no canonical Uniswap handoff.
- Liquidity: demo PoolKey/range preview; a validated contract-enabled runtime first obtains a bounded complete
  active-position ID index
  from the subgraph at an explicit indexed block/hash. It pins StateView, LiquidityManager, PositionManager, and token
  balance reads to that block, cross-checks index counts and every NFT's record/custody/pool/ticks/liquidity, then
  revalidates the hash. An exact zero count and empty list are valid when every position has been swept and render zero
  position principal/fees; count/list mismatches, duplicates, more than 16 entries, omissions, reorgs, or
  migration inconsistencies fail closed. The four genesis getters are a fallback only while the onchain migration count
  is zero. The client verifies the onchain `MAX_ACTIVE_POSITIONS` and `activePositionCount`; LiquidityManager's global
  16-position cap makes the bounded index complete for every valid state. The human USDG-per-GBX price and
  each active NFT's GBX/USDG principal use pinned official v4 math. Current uncollected fees use the PositionManager
  core position's `bytes32(tokenId)` salt and StateView fee-growth checkpoints with `uint256` wrap and Q128 floor math.
  The table and aggregate cards label the active-ID indexed block. Cumulative collected GBX fees burned and USDG fees
  routed to GumBallVault remain separately event-derived and indexed. No composition or fee amount is treated as NAV.
- Activity: bounded paginated index data merged across protocol entities with functional filters and exact
  block/transaction/log coordinates. Index failures show an unavailable state rather than demo rows.
- Admin: role-gated, selector-specific guardian actions plus a closed 14-operation post-launch timelock workbench; no
  arbitrary target, calldata, salt, or vault-call console. The workbench distinguishes the fixed 48-hour and seven-day
  delay classes; refreshes exact onchain delay, operation ID, ready time, and grace state; requires exact typed
  parameter re-entry because operations are not enumerable; and reruns a hash-pinned semantic preflight before every
  queue or permissionless execution. Recovery is ordered registry-first then voter-reactivation and includes HoldUSDG.
  Asset admission is two-stage: a code-hash/length-bound canonical StrategyDeployer operation is executed first, then
  its resulting strategy/rewards pair is entered into a separately delayed validated asset or stock registration.
  Liquidity migration is restricted to the canonical GBX/USDG PoolKey and complete active-position evidence.

## Financial presentation

Financial arithmetic uses `bigint` and token decimals. JavaScript `number` is limited to non-financial presentation
such as safe UI counts. Raw asset units and stock-token UI-adjusted exposure are shown separately. Any price-derived
mix, quote, or USD value is labeled as an estimate and is never described as contract NAV.

## Robinhood read-only metadata boundary

`GET /rhj` runs only on the web server and accepts no wallet address, account identifier, or query input. It fetches
fixed official Robinhood `/rhj/assets`, per-symbol `/rhj/prices`, and `/rhj/corporate-actions` URLs with bounded
timeouts, response sizes, request coalescing, and an eight-entry TTL cache. Prices use Robinhood's documented
15-second window, corporate actions use one hour, and `/assets` is retained only when its response supplies a cache
duration. Before returning data, the service cryptographically validates the release manifest against the same
build-bound signer policy used by live runtime configuration and reconciles stock-token addresses and UIDs. Onchain `uid()` and
`uiMultiplier()` views use the validated primary/fallback RPC transport set when REST metadata is unavailable; any
identity conflict fails closed.

Prices, trading halts, registry status, multipliers, and corporate actions are presentation-only. They cannot enter a
transaction builder or change raw vault balances, redemption outputs, or any other protocol state.

## Accessibility and privacy

Controls are keyboard reachable and labeled; status is not conveyed by color alone; layouts cover mobile and desktop;
contrast and focus states follow WCAG-oriented review. The Playwright route suite runs Axe against every public page
with WCAG 2.0, 2.1, and 2.2 A/AA plus best-practice rules; any reported violation fails CI and release evidence.
Analytics must not join wallet addresses to personal identity, jurisdiction, or browsing history. Eligibility and
jurisdiction messages disclose the production trust boundary.

Wallet discovery, selection, account details, disconnect, and chain switching are provided through the pinned
RainbowKit modal surface on top of wagmi and viem. The branded header dialog remains a protocol-specific explanation
layer; it delegates connection and account operations to RainbowKit rather than maintaining a second wallet stack.
The explanation dialog moves focus into its controls, traps keyboard focus while open, closes with Escape, and restores
focus to its trigger.

## Verification

```bash
pnpm --filter @gumball-6900/web typecheck
pnpm web:test
pnpm web:test:e2e
pnpm --filter @gumball-6900/web build
pnpm --filter @gumball-6900/web storybook:build
```

Storybook 10.5.5 is configured in `apps/web/.storybook` with production styles, autodocs, and accessibility checks.
The initial stories cover primitives, safe fallback, stock-token status, raw-versus-adjusted balances, halts, and
read-only metadata warnings.

The Playwright command runs the responsive/demo route suite followed by a disposable local-Anvil journey. The latter
uses the production `GenesisBootstrap`: the browser contributes to a failed campaign and refunds after permissionless
close, the chain snapshot is restored, then the browser funds a successful campaign and claims its exact 80,000,000
GBX allocation after permissionless close and atomic settlement. The same journey exercises real wallet
simulation/submission/receipt/refetch paths for recurring mining contribution, claim, and invalidated-epoch refund;
staking; signaling; an oracleless acquisition and exact 98/2 split; manager rewards; immediate unstake; buyback burn;
in-kind redemption; guardian pause; typed timelock recovery; and exact ABI-compatible Quoter reads in both token
directions. The live Mine page discovers beneficiary contribution events in bounded ranges starting at the recorded
MiningPool deployment block and revalidates every claim or refund at pinned RPC state. Static claim rows remain
restricted to demo mode. The fixture manifest is deliberately unsigned with a zero threshold, so this journey does
not exercise release-manifest signer trust.

This suite does not satisfy the complete release checklist: its ERC-20s are test-only, and external Uniswap v4 write
behavior and LaunchGuardHook behavior are stubbed. Bounded LiquidityManager, StateView, PositionManager, and Quoter
mocks exercise the signed identity and pinned read boundaries used by the live UI; the subgraph responder supplies
validated static protocol event pages rather than running Graph Node. Canonical trade/liquidity writes, claim expiry,
external-token behavior, verification, and Robinhood network execution remain outside its evidence.
