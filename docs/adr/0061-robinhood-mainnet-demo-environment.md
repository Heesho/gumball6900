# ADR 0061: Isolate a valueless Robinhood mainnet demo environment

- Status: accepted for development; not deployed, audited, or authorized for user funds
- Date: 2026-08-31
- Preserves: the unchanged core and GBX launcher; create-only exact-seed Pair handling; permanent genesis LP lock;
  scalar exits and claims; and the production governance/release blockers

## Context

Robinhood Chain mainnet has inexpensive ETH-denominated gas and is the target chain for the protocol, but the current
graph is not approved for production funds and Robinhood testnet does not reproduce every mainnet dependency. A public
demo can exercise the real Factory, wallet, indexing, and application paths using visibly worthless assets without
claiming that production has launched.

The existing launcher already accepts any deployed standard six-decimal USDG implementation. It also uses predictable
addresses and requires exact Pair balances. If a public mUSDG faucet existed before launch, another account could send
mUSDG to the counterfactual Pair and force that launcher to be abandoned under the selected create-only model.

The launcher also requires a code-bearing final owner. The demo needs the two ownership acceptances and a fixed set of
mock-token Strategies, but it does not need an ongoing governance key or a broad executor.

## Decision

### Environment identity

The environment is named **Robinhood Mainnet Demo**. It must never be called testnet or production. Wallets spend real
ETH for gas. `mUSDG`, the other demo assets, and all resulting balances are manipulable, have no promised value, and
must be labelled accordingly onchain and in every application surface.

Production status remains “not deployed.” A truthful combined status may later say that production is not deployed
while a separately identified mainnet demo is available, once exact live receipts support that statement.

### Demo mUSDG

`DemoUSDG` is a conventional six-decimal ERC-20 named `Mock USDG (No Value)` with symbol `mUSDG`.

- Its constructor mints exactly `1e6` raw units to one nonzero launch authority.
- Its public faucet is initially disabled and always mints a fixed `1_000e6` raw units only to the caller.
- The launch authority may bind exactly one deployed, not-yet-launched `GBXLauncher` whose `usdg` and
  `launchAuthority` identities match.
- After that launcher completes and records a deployed Pair, anyone may irreversibly enable the faucet.
- There is no arbitrary-recipient mint, amount setter, owner, pause, disable, recovery, sweep, or supply-integrity
  claim.

Before activation, no unrelated account can self-mint mUSDG through the token. The constructor gives the entire initial
supply to the launch authority, but mUSDG remains freely transferable, so the authority still controls prelaunch
custody. A broadcast preflight must therefore prove the authority retains the exact seed and the predicted Pair is
empty. This narrows the predictable-Pair prefunding window without changing the launcher's rejection and fresh-launcher
recovery model.

### Other demo assets

`DemoFaucetToken` is an ownerless 18-decimal standard ERC-20. Its constructor prefixes metadata as
`Mock <asset> (No Value)` and `m<symbol>`. Its only issuance path is a repeatable fixed `1_000 ether` self-faucet.
There is no receiver or amount parameter. Unlimited self-minting is intentional demo behavior, not an economic
integrity property.

### Fixed ownerless demo setup

`DemoOwner` is deployed after the launcher and before `launch`. Its constructor permanently records that launcher and
one through four deployments whose runtime bytecode exactly matches the compiled `DemoFaucetToken` artifact. A marker
method alone is insufficient. It has no EOA owner.

After launch, anyone may call its one state-changing `completeSetup` function. The call:

1. reads the launcher's stored deployment;
2. validates that Mine and Resonance both have `DemoOwner` as pending owner and still belong to the launcher;
3. validates reciprocal Mine, ResonanceRouter, Resonance, SignalGBX, GBX, USDG, and Fund identities;
4. accepts both ownerships atomically; and
5. registers every precommitted demo asset in constructor order using:

```text
initialPrice    = 100 ether
minimumPrice    = 100 ether
epochDuration   = 1 hour
priceMultiplier = 1.2e18
```

If any validation, acceptance, or Strategy creation fails, the whole setup reverts and remains retryable. On success,
Mine and Resonance are owned by the ownerless `DemoOwner`, which exposes no Router replacement, parameter change,
Strategy kill, reward-token addition, future Strategy addition, arbitrary call, upgrade, or recovery function. A new
asset set or administrative policy requires a fresh, separately labelled demo generation.

## Consequences

- The production core, launcher, and component deployers do not change.
- A successful demo can exercise the exact mainnet Pair and full user lifecycle without using production USDG.
- The prelaunch mUSDG supply is deliberately centralized in the launch authority for one seed transaction; after
  faucet activation, supply is deliberately unlimited and valueless. Standard ERC-20 transfers remain possible before
  activation, so exact authority and Pair balances are broadcast-time proof gates.
- The fixed ownerless setup removes an ongoing demo admin key but also makes the demo graph intentionally incapable of
  Router migration, Strategy removal, parameter changes, or later asset additions.
- User entry does not weaken exitability. Website work must ship each signal, reward, mining, and redemption entry path
  with its scalar claim or exit counterpart.
- Demo deployment records, indexer generations, and website configuration must remain separate from production
  manifests and must preserve old generation endpoints for position discovery.

## Verification and release boundary

Before any mainnet broadcast, the exact demo artifacts must pass local tests and a pinned non-broadcast Robinhood fork
using the real Factory. The rehearsal must cover the closed-faucet launch, dual ownership acceptance, fixed Strategy
creation, faucet activation, mining settlement, signaling, revenue routing, Strategy purchase, Bribe routing and claim,
unsignaling, and Fund redemption.

Passing those checks is engineering evidence only. It does not establish production deployment, audit closure,
governance review, token value, market integrity, legal approval, subgraph availability, website publication, or
authorization for user funds. CI must never broadcast.
