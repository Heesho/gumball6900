# Plan 003: Build the Robinhood mainnet demo foundation without changing the core

> **DONE.** The maintainer approved the recommended Robinhood mainnet demo lane on 2026-08-31. The contract, local-test,
> pinned-fork, and documentation foundation is complete. No mainnet transaction was broadcast.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: ADR 0054 launcher, ADR 0055 ownership handoff, ADR 0060 genesis-liquidity disclosure
- **Category**: demo infrastructure and test coverage
- **Planned at**: commit `3481e954d14a6e092f69e3fc1e4cd50eb11b5255`, 2026-08-31
- **Completed in working tree**: 2026-08-31

## Goal

Create the smallest contract and test foundation needed to rehearse a valueless public demo on Robinhood Chain mainnet
while leaving the reviewed GBX core, launcher, and component deployers unchanged.

The selected environment is named **Robinhood Mainnet Demo**, not testnet or production. Its assets are worthless mock
tokens, but every public transaction spends real ETH for gas.

## Selected design

### Mock USDG

- Deploy a standard six-decimal ERC-20 named `Mock USDG (No Value)` with symbol `mUSDG`.
- Mint exactly the launcher's `1e6` raw genesis requirement to the setup authority in the constructor.
- Keep the public, caller-owned fixed-amount faucet disabled initially.
- Let the launch authority bind exactly one matching, not-yet-launched `GBXLauncher`.
- Let anyone enable the faucet exactly once only after that bound launcher proves it completed and produced a deployed
  Pair. No privileged account is required after binding.
- No configurable amount, receiver selection, pause, recovery, or disable path remains afterward.

The constructor and disabled faucet prevent an unrelated account from self-minting mUSDG before genesis. Because mUSDG
remains a standard transferable ERC-20, the authority still controls custody of the seed; the broadcast preflight must
prove that the authority retains exactly `1e6` raw units and that the predicted Pair remains empty. This does not try to
repair a poisoned Pair or weaken the launcher's create-only behavior.

### Other demo assets

- Provide one reusable 18-decimal faucet token whose constructor automatically prefixes wallet-visible metadata with
  `Mock ` and `m`.
- Mint a fixed amount only to `msg.sender` through a permanently public faucet.
- Add no owner, allowlist, cooldown, receiver parameter, supply cap, or economic-integrity claim.

### Demo owner

- Deploy a non-upgradeable, ownerless `DemoOwner` before launch so it can be the launcher's code-bearing `finalOwner`.
- Precommit one through four deployments of the exact compiled 18-decimal `DemoFaucetToken` runtime in the constructor.
- Let anyone complete one deterministic setup transaction after launch. It validates both pending-owner handoffs and
  the reciprocal Mine/Router/Resonance/SignalGBX identity graph, atomically accepts both ownerships, and registers the
  precommitted assets using the fixed demo Strategy configuration.
- Expose no post-setup administration. In particular, do not expose `Mine.setResonanceRouter`, future Strategy
  additions, `killStrategy`, `setBribeBps`, `addBribeRewardToken`, arbitrary calls, delegatecalls, value custody,
  upgradeability, or production-governance claims. A different asset set requires a fresh demo generation.

## Implementation phases

### Phase 1: Record the environment boundary

- Add ADR 0061 describing the demo trust model, labels, faucet activation, fixed ownerless setup, and explicit
  production separation.
- Add a short repository-guide rule for `packages/contracts/src/demo`.

### Phase 2: Add demo-only contracts

- Add `packages/contracts/src/demo/DemoUSDG.sol`.
- Add `packages/contracts/src/demo/DemoFaucetToken.sol`.
- Add `packages/contracts/src/demo/DemoOwner.sol`.
- Add `packages/contracts/src/demo/README.md` with the exact safety and lifecycle boundaries.

### Phase 3: Add deterministic local coverage

Cover at least:

- exact mUSDG metadata, decimals, seed, and fixed faucet amount;
- faucet rejection before a completed matching launch;
- unauthorized launcher-binding rejection, one-time binding, permissionless post-launch activation, and repeated-
  activation rejection;
- fixed self-only public minting for both token types;
- automatic mock metadata prefixes;
- atomic Mine/Resonance ownership acceptance;
- rejection of incomplete prelaunch state and a mismatched pending-ownership handoff;
- exact demo-token runtime rejection for marker-compatible stand-ins;
- fixed-precommit-only Strategy creation and successful registration of a demo asset; and
- absence of broader forwarding methods from the public ABI.

### Phase 4: Add the exact Robinhood fork rehearsal

Using the existing opt-in `launcher_fork` profile and a recorded block pin:

1. deploy the exact demo mUSDG, DemoOwner, four component deployers, and launcher;
2. prove the counterfactual Pair is absent;
3. approve the exact `1e6` raw seed and launch against the real pinned Factory;
4. accept both ownerships atomically and register one demo-asset Strategy;
5. enable and exercise the mUSDG faucet only after launch;
6. exercise faucet -> Mine -> tenure replacement -> GBX settlement -> signal -> revenue route -> Strategy purchase ->
   Bribe route/claim -> unsignal -> Fund redemption; and
7. recheck reciprocal graph identities and exitability at the end.

The fork is engineering evidence only. It must never broadcast.

Recorded rehearsal evidence on 2026-08-31:

- public RPC: `https://rpc.mainnet.chain.robinhood.com` (historical state served for the selected pin);
- block: `50,983,777`;
- chain ID: `4663`;
- Factory runtime hash: `0xbab145d02e7005f0d84c6c1639d39b799b0ea16df99ebbdaf5a14d9da820b4e0`;
- Router runtime hash: `0xbd55ea26b2f8d42a8ff151511cef92a326a9817686899fe96a8a8f81ee7fc55e`;
- result: `GBXDemoForkTest` passed, with `GBXLauncher.launch` consuming `23,425,306` gas in the rehearsal.

## Verification

Run from the repository root with Node `22.23.1` where Node-based commands are involved:

```bash
cd packages/contracts && forge fmt --check
cd packages/contracts && forge build --sizes
cd packages/contracts && forge test --match-path test/minimal/DemoEnvironment.t.sol -vv
cd packages/contracts && FOUNDRY_PROFILE=launcher_fork forge test \
  --fork-url "https://rpc.mainnet.chain.robinhood.com" \
  --fork-block-number 50983777 \
  --match-contract GBXDemoForkTest -vv
pnpm --filter @gumball-6900/contracts lint
pnpm --filter @gumball-6900/contracts test:hardhat
git diff --check
```

After focused checks, run all applicable repository gates before handoff. A missing archive-capable fork endpoint is a
reported fork blocker, not a passing result.

### Completion evidence

- `DemoEnvironmentTest`: 9 passed, including the exact faucet delta, marker-spoof rejection, mismatched handoff rollback,
  full entry/reward/exit lifecycle, and a four-token setup using `10,729,908` gas.
- `GBXDemoForkTest`: 1 passed at block `50,983,777` against the pinned Factory and Router runtimes; launch used
  `23,425,306` gas and no transaction was broadcast.
- Full Foundry gate: 436 tests passed, including 32 invariant properties at 1,000 runs and 500 calls per run.
- Hardhat: compiler-bytecode parity and 6 tests passed.
- Repository lint, typecheck, build, aggregate tests, SDK ABI freshness, subgraph build/Matchstick tests, and 36 browser
  E2E tests passed with Node `22.23.1` and the supported pinned-Python override.
- Every in-scope file passes Prettier and Forge formatting. The aggregate `pnpm format:check` remains blocked by eight
  unrelated pre-existing files; they were preserved rather than rewritten as part of this plan.

## Stop conditions

Stop and report rather than broadening the implementation if:

- the exact demo token cannot reproduce the launcher's fixed Pair math against the real Factory;
- enabling the faucet can succeed before the matching launcher completes;
- DemoOwner requires a generic executor or another core/admin method to complete the selected flow;
- any file under `packages/contracts/src/core` or an existing file under `packages/contracts/src/launch` would need to
  change;
- the current pinned Factory identity or runtime differs from the reviewed evidence; or
- unrelated user work overlaps an in-scope file.

## Explicitly deferred

This plan does not add or execute:

- a mainnet deployment/broadcast script;
- a demo deployment manifest or signed release manifest;
- deployer funding, key handling, verification, or live ownership transactions;
- a managed or self-hosted Graph Node;
- subgraph publication or endpoint registration;
- web wallet/RPC integration or transaction buttons; or
- production governance, production USDG, an audit-clearance claim, or user-fund authorization.
