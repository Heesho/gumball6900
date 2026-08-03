# Minimal GBX specification

This is the concise normative map for the current rebuild. Detailed arithmetic and risks are linked below. When prose
and implementation differ, production is blocked until the discrepancy is resolved, tested, and recorded when it
changes economics or trust.

## System boundary

- Core contracts are direct, non-upgradeable deployments.
- There is no public factory, generic executor, arbitrary vault call, NAV/price feed, conventional DAO, public launch
  funding, repayment state, or staking withdrawal lock.
- USDG and every acquisition or registered asset must be a reviewed standard ERC-20, non-rebasing and
  non-fee-on-transfer. Exact debit/receipt assertions fail closed; other measured deltas are accounting guards.
  Neither supports exotic tokens.

## Token and mining

- The constructor mints exactly 20M GBX once for canonical liquidity.
- Lifetime cumulative minting is capped at one billion; burns do not restore capacity.
- The canonical controller advances a daily four-year-half-life schedule for the nominal remaining 980M.
- Each non-empty ended epoch mints its complete scheduled amount into `MiningClaims`; an empty epoch mints zero and
  advances without carry.
- Mining contributions are final, attributed separately to payer and beneficiary, and optionally pay a fixed 2% team
  fee before exact net vault deposit.
- Claims are floor-proportional transfers of already-minted GBX to the beneficiary.

## Liquidity setup

- The script initializes one hookless GBX/USDG v4 pool from explicit inputs.
- It mints one entirely single-sided position using maximal integer GBX principal, burns the residual, clears
  approvals, and transfers the exact expected NFT to `LiquidityCustodian`.
- Mining starts only after custody and graph invariants pass.
- The position is outside the vault's raw redemption basket.

## Staking, signals, and budgets

- StakedGBX is a non-transferable 1:1 receipt.
- Signals are immediate absolute weights over at most 16 live strategies, bounded by stake.
- Users may reset and unstake once used weight is zero. Live acquisition-reward callbacks are strict; after terminal
  strategy disablement, zero-weight reset makes no call to that rewards code, so reverting or gas-burning hooks cannot
  block reset and unstake. Honest rewards retain their terminal weight snapshot and already indexed claims.
- Only physically deposited mining and liquidity-fee USDG may be notified to `AllocationVoter`.
- With zero total active weight, notified revenue becomes permanently idle and is not retroactively allocated.
- Strategy budgets are virtual claims against vault USDG and scale down pro rata on redemption.

## Strategies

- The script deploys one acquisition/rewards pair and one buyback strategy but leaves both unregistered and inactive.
- Each requires its own typed seven-day registration before signaling or fills.
- Both sell an immutable USDG lot through the exact pinned give.fun reverse Dutch transition. Price reaches zero at
  and after the endpoint.
- Acquisition receives target tokens first and routes observed receipt 98% to the vault plus 2% to supporters, or
  100% to the vault when supporter weight is zero.
- Buyback receives and burns observed GBX before USDG release.
- The vault releases only a live caller strategy's current budget, but accepts that strategy's selected receiver.

## Basket and redemption

- The registry holds at most 16 assets including USDG and at most 16 strategies.
- Strategy disablement is terminal; an associated asset remains in the basket.
- Redemption is public, atomic, and unpausable.
- A redemption burns GBX against pre-burn total supply and transfers the floor-proportional raw balance of every
  registered asset.
- No valuation, substitution, skip, or administrative sweep path exists.

## Controls and trust

- `ProtocolTimelock` exposes only typed operations with a fixed seven-day delay and no generic execution.
- `EmergencyGuardian` can only stop new exposure and cannot block exits or move value.
- Three delayed trust surfaces remain: replacement controller code, recipient code for the exact position NFT, and
  admitted strategy code.
- Controller/registry getter checks and recipient code-presence checks are not bytecode or semantic attestation.
- A malicious controller may consume all remaining mint capacity; a malicious NFT recipient may control the complete
  position; a malicious live strategy may send no more than its current budget to any receiver.
- Mature operations have no cancellation or expiry and remain permissionlessly executable until consumed.

## Release boundary

No deployment is canonical. Addresses, token approvals, pool and auction inputs, roles, pinned-fork evidence,
independent audits, legal approvals, a signed manifest, and licensing resolution remain production blockers. Local
tests do not authorize broadcast or release.

## Normative detail

- [Architecture](ARCHITECTURE.md)
- [Economics](ECONOMICS.md)
- [Emissions](EMISSIONS.md)
- [Invariants](INVARIANTS.md)
- [Uniswap v4](UNISWAP_V4.md)
- [Trust assumptions](TRUST_ASSUMPTIONS.md)
- [Threat model](THREAT_MODEL.md)
- [Access control](ACCESS_CONTROL.md)
- [Deployment](DEPLOYMENT.md)
- [ADR-0012](adr/0012-minimal-genesis-controller-and-liquidity-custody.md)
