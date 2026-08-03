# GUM BALL 6900 protocol client

The client starts in fail-closed `demo` mode. Demo mode renders deterministic typed data, labels the fallback in every
protocol view, permits wallet connection for UX inspection, and disables all contract writes.

## Remote runtime configuration

Set `GUMBALL_CLIENT_MODE=live` for release-approved Robinhood mainnet or `GUMBALL_CLIENT_MODE=testnet` for an explicitly
labeled remote Robinhood testnet candidate, then provide every variable documented in `.env.example`. Configuration is
read on the server for each deployment runtime and only the validated, browser-safe result is serialized to React.

- `GUMBALL_RPC_URL` must be a remote HTTPS provider rather than localhost or the rate-limited public endpoint.
- `GUMBALL_RPC_FALLBACK_URLS_JSON` must contain one to four distinct remote HTTPS fallback providers. Rehearsal may use
  an empty array; production live and remote testnet modes may not.
- `GUMBALL_SUBGRAPH_URL` must be a remote HTTPS endpoint; loopback endpoints are reserved for explicit rehearsal mode.
- `GUMBALL_PROTOCOL_ADDRESSES_JSON` must match `@gumball-6900/sdk`'s `ProtocolAddresses` schema.
- `GUMBALL_STRATEGIES_JSON` must contain `USDG`, `WETH`, `WBTC`, `QQQ`, `TSLA`, `SPCX`, `NVDA`, `AAPL`, and `BURN`.
- `GUMBALL_REWARDS_JSON` must contain `WETH`, `WBTC`, `QQQ`, `TSLA`, `SPCX`, `NVDA`, and `AAPL`.
- `GUMBALL_DEPLOYMENT_MANIFEST_JSON` must pass `@gumball-6900/config` validation. Live mode requires
  `release-approved` status on chain `4663`, and its policy ID, signer set, and threshold must exactly match the public
  release-manifest policy embedded from the build commit. Testnet mode requires signed `testnet-candidate` status on
  chain `46630` with a satisfied positive threshold, exact configured testnet USDG/WETH and Permit2 bindings, and
  complete candidate external/address coverage. Bespoke verified testnet v4 core/periphery remain candidate-only and
  cannot be promoted or reused as canonical mainnet evidence. Every configured contract address must appear in the
  selected manifest.

An invalid or incomplete live or testnet configuration does not partially activate. The client returns to a labeled
safe demo fallback and preserves validation issues for operator review without exposing raw environment values.
`packages/config/deployments/release-manifest-signature-policy.json` is currently an explicit unconfigured sentinel,
so live mode and signed remote testnet mode remain blocked. The signer trust root is not accepted from an environment
variable or from the manifest itself. Remote testnet mode uses the same validator and does not relax or bypass this
mainnet trust boundary; its candidate label never becomes release approval.

## Local Anvil browser rehearsal

`pnpm web:test:e2e` runs both the responsive/demo route suite and a disposable contract-backed Chromium journey. The
second suite starts Anvil on chain ID `46630`, deploys and wires a testnet-candidate protocol graph, starts the web app
in `rehearsal` mode, injects an unlocked EIP-1193 test provider, and tears every process down after the run. Rehearsal
mode is rejected when `NODE_ENV=production` or either the RPC or subgraph endpoint is not localhost. The UI labels it
as disposable test evidence and never calls it a deployed, verified, audited, or release-approved network.

The journey first exercises the production `GenesisBootstrap` orchestration twice. The browser exact-approves and
contributes to a below-minimum campaign, a permissionless driver call closes it as refundable, and the browser refunds
the beneficiary before the disposable chain snapshot is restored. It then exact-approves a minimum-funded campaign;
the driver closes and atomically settles it, and the browser claims the exact 80,000,000 GBX beneficiary allocation.
The same run uses browser controls for recurring mining contribution and claim, invalidated-epoch refund, GBX
approval/staking, persistent signals, an NVDA reverse Dutch fill, the exact 98% vault / 2% manager split,
manager-reward claim, immediate unstake, GBX buyback and real burn, in-kind redemption, guardian pause, typed timelock
queue/execute, and exact Quoter reads in both USDG → GBX and GBX → USDG directions. Keeper-style close and settlement
calls remain test-driver actions because user pages intentionally expose no keeper control. Static claim rows remain
demo-only. The fixture manifest is deliberately unsigned with a zero threshold, so this journey does not exercise
release-manifest signer trust.

This remains local engineering evidence, not a launch rehearsal. The fixture uses test ERC-20s, the production
`GenesisBootstrap`, bounded read-compatible LiquidityManager, StateView, PositionManager, and Quoter
protocol-boundary mocks, a LaunchGuardHook code stub, and a static protocol-event and `_meta` subgraph responder rather
than Graph Node. The browser validates the signed-address → manager immutable → PoolKey/PoolId → four-NFT custody
graph at one revalidated block. It therefore does not cover canonical v4 trade/liquidity writes, real pool accounting,
live indexing, external-token behavior, claim expiry, deployment verification, or any Robinhood network.

## Browser security boundary

`proxy.ts` creates a cryptographically random nonce for every document request, forwards it in the request CSP so
Next.js can nonce framework scripts and styles, and returns the same enforced policy to the browser. Production script
execution requires that nonce and `strict-dynamic`; `unsafe-eval` and local HMR WebSocket sources exist only in the
explicit development runtime. Inline script attributes, framing, plugins, media, and third-party frames are denied. Inline style
attributes remain allowed because financial bars and allocation controls use bounded dynamic widths, colors, and a CSS
custom property; style elements still require the request nonce.

In live and remote testnet modes, `connect-src` adds only remote HTTPS normalized origins from `GUMBALL_RPC_URL`,
`GUMBALL_RPC_FALLBACK_URLS_JSON`, and
`GUMBALL_SUBGRAPH_URL`; loopback origins are rejected, and paths,
queries, and URL credentials are never copied into response headers. Rehearsal mode authorizes only localhost origins,
including when a remote endpoint uses HTTPS. Remote cleartext or malformed endpoints are not authorized. Demo mode
ignores both endpoint variables, which preserves the existing no-read/no-write fallback. Local development additionally
authorizes only `ws://127.0.0.1:*` and `ws://localhost:*` for Next HMR.

Every document response also denies framing with both CSP and `X-Frame-Options`, disables MIME sniffing and DNS
prefetch, sends no referrer, restricts camera/geolocation/microphone/payment permissions, and disables legacy
cross-domain policy files. HSTS is emitted only in production on non-local request hosts. It intentionally omits
`includeSubDomains` and `preload` until the production domain owner verifies that every subdomain is HTTPS-only.

## Transaction boundary

SDK builders encode protocol actions. Before a wallet request, the client performs an `eth_call` simulation with the
connected account. It reports success only after a successful transaction receipt and links to the configured chain
explorer. Redemption and auction writes first pin their complete financial preflight to one block number and hash,
revalidate that hash, bind token identity/order/decimals to the signed runtime manifest, then refresh that preflight
immediately before simulation. A confirmed receipt invalidates active read state and the action refetches its quote,
basket, and allowance; deterministic or stale fallback values can never authorize those writes. Revert copy is decoded
only from bounded ABIs selected by the manifest-pinned transaction destination and otherwise uses a sanitized fallback.

The Admin route uses a closed, selector-specific operation inventory. Immediate guardian controls can only pause or
disable exposure. The timelock workbench covers every supported post-launch recovery and maintenance selector with its
fixed 48-hour or seven-day delay: recovery registry/voter ordering, guardian rotation, auction unpause and
reviewed-baseline rate reset, contribution/signal/migration unpause, redemption-readiness metadata, validated asset or stock registration,
canonical strategy-pair deployment, and bounded liquidity migration. It has no target, calldata, salt, or generic-call
escape hatch.

Every queue and execute attempt refreshes a one-block, hash-revalidated protocol graph, obtains `requiredDelay`,
`hashOperation`, and `operationReadyAt` from ProtocolTimelock, and then reruns selector-specific semantic checks.
Operation IDs are not enumerable onchain: an operator must retain or re-enter the exact typed parameters to inspect,
cancel, or execute an operation. Scheduling and cancellation require the configured proposer; execution is
permissionless after readiness and before the exact grace-period boundary. New acquisition strategies use a deliberate
two-stage flow: schedule and execute the code-hash/length-bound StrategyDeployer call, read the resulting canonical
strategy and rewards addresses, then schedule the separate validated registration call. The UI never predicts or asks
an operator to guess those CREATE addresses. Guardian Safe ownership, threshold, modules, and guard remain external
review evidence; the client does not claim to validate them from an address alone.

## Read-only Robinhood metadata

`GET /rhj` is a server-only aggregate over Robinhood's official `/rhj/assets`, per-symbol `/rhj/prices`, and
`/rhj/corporate-actions` endpoints. It accepts no wallet, account, cookie-derived identity, or query input. Requests
use fixed allowlisted URLs, short timeouts, response-size limits, request coalescing, and an 18-entry in-memory
cache sized only for the two aggregate endpoints plus the bounded 16-token price set. Prices use the documented
15-second window and corporate actions use one hour. Because Robinhood does not
document an `/assets` duration, asset metadata is retained only when the upstream response supplies `max-age`.

The service is available only in release-approved mainnet mode. It cryptographically validates the release manifest,
proves that the signed Lens references the signed AssetRegistry, and discovers every currently registered stock token
(up to the protocol maximum of 16) at one hash-revalidated block. The five genesis stocks retain exact signed-manifest
address, UID, symbol, and decimal checks. Post-launch stocks are instead bound to their AssetRegistry index, token
address, assetId/`uid()`, symbol hash/`symbol()`, decimals, and `uiMultiplier()` at that same block. Each complete
snapshot uses one RPC endpoint so fallback routing cannot mix providers within a block view.

Official RHJ records and corporate actions join by UID plus chain deployment address; symbol is only a hash-checked
display field. Duplicate symbols therefore cannot cross-attach records, and the ambiguous per-symbol price endpoint is
reported unavailable for those tokens. RPC identity conflicts fail closed, while REST outages leave status, halt, and
action fields explicitly unavailable. These fields remain read-only display data and never enter contract calldata.

Live Vault and Redeem views join exact raw Lens amounts to this reconciled metadata by unique token address and then
cross-check the display symbol. A fixed-18 `uiMultiplier` is parsed as bigint and applied as
`rawAmount * multiplierWad / 1e18`; raw amounts
remain the accounting and redemption source of truth, while adjusted underlying-share exposure is labeled display-only.
If the multiplier stream is loading, stale, unavailable, unsupported on the active network, or fails identity
reconciliation, raw amounts remain visible and no default multiplier or demo value is substituted. Recent Vault fills
come from the separately bounded, validated subgraph query and retain their own loading, stale, empty, and unavailable
states.

The live Vault shows the specification-required percentage of total raw vault units by dividing each token's atomic-unit
count by the sum of all registered atomic-unit counts. Because USDG, WBTC, and the 18-decimal tokens use unlike unit
scales, the UI explicitly labels this literal comparison as neither basket composition nor economic value, exposure,
backing, or NAV. Contracts do not calculate or consume it.

The Trade view labels its quote-size comparison as approximate price impact. It compares the requested trade's effective
output rate with a one-token v4 Quoter probe pinned to the same block number and hash; it is not a TWAP, oracle price,
execution guarantee, or slippage limit.

## Storybook

Storybook 10 documents the shared protocol primitives and important financial states with the production Tailwind
theme. Accessibility checks are configured as errors.

```bash
pnpm --filter @gumball-6900/web storybook
pnpm --filter @gumball-6900/web storybook:build
```
