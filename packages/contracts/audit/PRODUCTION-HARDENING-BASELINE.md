# Production-hardening baseline

> **Pre-ADR-0047 historical snapshot.** ADR 0047 later replaced the captured reward and settlement mechanics with
> scalar Synthetix scheduling, per-purchase Strategy splitting, direct Fund payment, and a Bribe-only Router. Any
> exact-carry, queue, pause, liability, selected-batch, exact-transfer, inventory, size, gas, or test conclusion below
> is intentionally preserved for its pinned checkout and is not current evidence. ADR 0048 further supersedes this
> snapshot's eight-token cap and dedicated move hook with a sixteen-token cap and composed moves.

> Historical evidence only. ADR 0024 also replaced the distribution contract and supply model with Mine; the
> inventory, sizes, constants, and results below are not current release evidence.

> Historical snapshot only. ADR 0022 later superseded the captured LiquidityPosition compounding API and A-06/A-07
> dispositions with fixed-principal fee routing. The inventory below is intentionally preserved as baseline evidence.

> Captured before production Solidity was modified on 2026-08-09. This is internal engineering evidence for the
> reviewed checkout; it is not a deployment, release authorization, or independent audit.

## Checkout

Commands:

```text
git branch --show-current
git rev-parse HEAD
git status --short --branch
git diff --name-only
git ls-files --others --exclude-standard
```

Captured output before branch creation:

```text
main
395a0dfbf56e3d478233736ef7a110e584a676e7
## main...origin/main
```

There were no modified or untracked files. Work then moved to the requested
`codex/gumball-production-hardening` branch at the same commit. The reviewed baseline SHA is therefore
`395a0dfbf56e3d478233736ef7a110e584a676e7`.

## Runtime and compiler configuration

Commands:

```text
node --version
pnpm --version
forge --version
cast --version
anvil --version
solc --version
node node_modules/hardhat/internal/cli/cli.js --version
node node_modules/solhint/solhint.js --version
sed -n '1,300p' packages/contracts/foundry.toml
sed -n '1,260p' packages/contracts/hardhat.config.ts
```

Captured output:

```text
Initial login-shell Node: v20.19.6
Repository-pinned Node used for package commands: v22.23.1
pnpm: 10.14.0
forge: 1.2.3-stable (a813a2cee7dd4926e7c56fd8a785b54f32e0d10f)
cast: 1.2.3-stable (a813a2cee7dd4926e7c56fd8a785b54f32e0d10f)
anvil: 1.2.3-stable (a813a2cee7dd4926e7c56fd8a785b54f32e0d10f)
standalone solc: not installed
configured Solidity compiler: 0.8.26+commit.8a97fa7a
Hardhat: 2.29.0
Solhint: 6.0.1
EVM target: cancun
optimizer: enabled
optimizer runs: 10,000
via IR: false
metadata bytecode hash: none
CBOR metadata: disabled
```

Foundry and Hardhat both compile `packages/contracts/src` with exact pragma/compiler `0.8.26`, Cancun, optimizer
10,000, no IR, no bytecode hash, and no CBOR trailer. The repository tool lock requests Foundry 1.7.1; the initial host
binary is older and must not be represented as the pinned campaign tool.

Package installation command and result:

```text
corepack enable
corepack prepare pnpm@10.14.0 --activate
pnpm install --frozen-lockfile

Scope: all 9 workspace projects
Lockfile is up to date, resolution step is skipped
Done in 10.4s using pnpm v10.14.0
```

The command requires Node 22.23.1. Running it under the initial Node 20.19.6 failed closed with
`ERR_PNPM_UNSUPPORTED_ENGINE`; the successful captured run used the exact repository Node version.

## Dependency pins

Command:

```text
node -e "for (const p of ['@openzeppelin/contracts','@uniswap/v4-core','@uniswap/v4-periphery','hardhat','solhint']) { const j=require('./node_modules/'+p+'/package.json'); console.log(p,j.version); }"
sed -n '1,120p' node_modules/@uniswap/v4-periphery/lib/permit2/package.json
```

Captured output:

```text
@openzeppelin/contracts 5.6.1
@uniswap/v4-core 1.0.2
@uniswap/v4-periphery 1.0.3
@uniswap/permit2 1.0.0 (vendored by v4-periphery)
hardhat 2.29.0
solhint 6.0.1
```

All production dependencies are exact npm pins. No floating Git dependency or development branch appears in the
production contract package.

## Security-tool baseline

Commands:

```text
slither --version
aderyn --version
semgrep --version
echidna --version
medusa --version
myth version
gitleaks version
docker --version
sed -n '1,260p' packages/contracts/audit/toolchain.lock
```

Captured host state and checked-in pins:

| Tool     | Host result         | Checked-in pin                                                                          |
| -------- | ------------------- | --------------------------------------------------------------------------------------- |
| Slither  | 0.11.6              | 0.11.5                                                                                  |
| Aderyn   | not installed       | 0.6.8                                                                                   |
| Semgrep  | not installed       | 1.162.0                                                                                 |
| Echidna  | 2.3.3 native        | 2.3.2, image `sha256:8546f6705d46aea2cdf8309a251ad0946c7f92b7d3eb0b968fba37e3afbf131c`  |
| Medusa   | not installed       | 1.5.1                                                                                   |
| Mythril  | not installed       | 0.24.8, image `sha256:ca947a2a79204667ae2ae93ea6aaaca0cea669f61bc4db6958e7556ea263bd80` |
| Solhint  | package-local 6.0.1 | 6.0.1                                                                                   |
| Gitleaks | 8.30.1              | 8.30.1                                                                                  |
| Docker   | not installed       | required for pinned Echidna/Mythril images                                              |

Uninstalled or mismatched host tools are not baseline passes. `bash audit/install-tools.sh nightly` is the reproducible
installation path; Docker-dependent campaigns remain blocked unless Docker becomes available.

## Production and interface inventory

Command:

```text
rg --files packages/contracts/src/core --glob '*.sol' | sort
rg -n '^contract |^interface ' packages/contracts/src/core --glob '*.sol'
```

Captured production-contract inventory (12):

```text
GBX
Fundraiser
SignalGBX
ResonanceRouter
Resonance
StrategyFactory
Strategy
BribeFactory
BribeRouter
Bribe
Fund
LiquidityPosition
```

Captured interface inventory (4):

```text
IBribe
ICoreResonance
IFund
IResonanceRouter
```

`packages/contracts/src/core` contained 16 Solidity files in total. `MAX_REWARD_TOKENS` was exactly `8` in
`Bribe.sol`.

## Public ABI inventory

Command:

```text
for c in GBX Fundraiser SignalGBX ResonanceRouter Resonance StrategyFactory Strategy BribeFactory BribeRouter Bribe Fund LiquidityPosition; do forge inspect "$c" methods; done
```

Captured callable signatures, excluding inherited event/error ABI entries:

```text
GBX: CLOCK_MODE, DOMAIN_SEPARATOR, FUNDRAISER_ALLOCATION, GENESIS_LIQUIDITY_ALLOCATION, MAX_SUPPLY, allowance,
approve, balanceOf, burn, checkpoints, clock, decimals, delegate, delegateBySig, delegates, eip712Domain,
getPastTotalSupply, getPastVotes, getVotes, lifetimeBurned, name, nonces, numCheckpoints, permit, symbol, totalSupply,
transfer, transferFrom
Fundraiser: DAILY_DECAY, DISTRIBUTION_ALLOCATION, DISTRIBUTION_EPOCHS, EPOCH_DURATION, INITIAL_DAILY_EMISSION,
MIN_CONTRIBUTION, WAD, accountContributions, accountHasClaimed, claim, contribute, currentEpoch,
currentScheduledEmission, epochContributions, epochEmission, epochSettled, gbx, nextEpochToSettle, pendingReward,
resonanceRouter, settleEpochs, startedAt, usdg
SignalGBX: CLOCK_MODE, DOMAIN_SEPARATOR, allowance, approve, balanceOf, checkpoints, clock, decimals, delegate,
delegateBySig, delegates, eip712Domain, gbx, getPastTotalSupply, getPastVotes, getVotes, name, nonces, numCheckpoints,
owner, permit, renounceOwnership, resonance, setResonance, stake, symbol, totalSupply, transfer, transferFrom,
transferOwnership, unstake
ResonanceRouter: pendingRevenue, resonance, route, usdg
The following inventory records the pre-ADR-0021 baseline API and is intentionally historical except for the GBX line,
which is reconciled to ADR 0023 to avoid describing a nonexistent mint authority. Current ABI evidence is generated
from the source tree; ADR 0021 removes Strategy kinds, the payment split, and `setBribeBps`.

Resonance: BPS_SCALE, DEFAULT_BRIBE_BPS, INDEX_PRECISION, MAX_BRIBE_BPS, accountSignalWeight, accountSignals,
accountStrategies, addBribeReward, addSignal, addSignalMany, addStrategy, bribeBps, bribeFactory, bribeFor,
bribeRouterFor, claimRewards, claimableRevenue, distribute, distributeAll, distributeRange, fund, isStrategy,
isStrategyAlive, killStrategy, notifyRevenue, owner, paymentTokenFor, pendingRevenue, removeSignal, removeSignalMany,
renounceOwnership, resonanceRouter, revenueIndex, setBribeBps, setResonanceRouter, signalGBX, strategies,
strategyFactory, strategyRevenueIndex, strategySignalWeight, totalSignalWeight, transferOwnership, updateStrategy, usdg
StrategyFactory: createStrategy, owner, renounceOwnership, resonance, setResonance, transferOwnership
Strategy: ABSOLUTE_MAXIMUM_PRICE, ABSOLUTE_MINIMUM_PRICE, BPS_SCALE, MAX_EPOCH_DURATION, MAX_PRICE_MULTIPLIER,
MIN_EPOCH_DURATION, MIN_PRICE_MULTIPLIER, PRICE_SCALE, availableRevenue, buy, currentPrice, epochDuration, epochId,
epochStartedAt, fund, initialPrice, kind, minimumPrice, paymentToken, priceMultiplier, resonance, revenueToken
BribeFactory: createBribe, owner, renounceOwnership, resonance, setResonance, transferOwnership
BribeRouter: bribe, distribute, fund, pendingRewards, rewardToken, routeRewards, strategy
Bribe: MAX_REWARD_TOKENS, REWARD_DURATION, REWARD_PRECISION, addRewardToken, balanceOf, claimRewards, deposit,
earned, isRewardToken, lastTimeRewardApplicable, left, notifyRewardAmount, resonance, rewardData, rewardPerToken,
rewardTokens, rewards, totalSupply, userRewardPerTokenPaid, withdraw
Fund: burnGBX, gbx, pendingGBX, redeem
LiquidityPosition: BPS_SCALE, COMPOUND_BPS, compound, compoundRequirement, currency0, currency1,
expectedPositionTokenId, expectedTickLower, expectedTickUpper, gbx, onERC721Received, permit2, poolFee, poolKey,
poolKeyHash, positionDepositor, positionInCustody, positionManager, positionRecorded, positionTokenId, tickSpacing, usdg
```

## Tests and fuzz configuration

Commands:

```text
rg -c '^\s*function (test|invariant_)' packages/contracts/test/minimal --glob '*.sol'
rg -c '^\s*function test' packages/contracts/test/integration --glob '*.sol'
rg -c '^\s*function invariant_' packages/contracts/test/minimal --glob '*.sol'
forge test --summary
```

Captured counts and result:

```text
Default Foundry tests: 335
Integration Foundry tests: 21
Stateful invariant properties: 24
Hardhat tests: 2
Default Foundry result: 335 passed, 0 failed, 0 skipped
Ordinary fuzz properties: 10,000 runs each
Stateful result: 1,000 runs x depth 500 for each property, 500,000 calls/property, 0 handler reverts
Aggregate default invariant calls: 12,000,000
```

The exact default configuration is:

```text
fuzz = { runs = 10_000, max_test_rejects = 1_000_000 }
invariant = { runs = 1_000, depth = 500, fail_on_revert = true }
nightly fuzz = { runs = 100_000 }
nightly invariant = { runs = 10_000, depth = 1_000, fail_on_revert = true }
```

External-fuzzer configuration:

```text
Echidna: testLimit 100000, seqLen 150, timeout 3600, seed 6900, stopOnFail true
Medusa: 4 workers, testLimit 100000, sequence length 150, timeout 3600, transaction gas 12500000
```

These are configured targets, not results from this baseline turn.

## Bytecode sizes

Command:

```text
cd packages/contracts && forge build --sizes
```

Captured production sizes:

| Contract          | Runtime bytes | Initcode bytes |
| ----------------- | ------------: | -------------: |
| GBX               |        10,098 |         13,117 |
| Fundraiser        |         5,157 |          5,646 |
| SignalGBX         |        10,905 |         12,299 |
| ResonanceRouter   |         1,852 |          2,220 |
| Resonance         |        11,370 |         12,164 |
| StrategyFactory   |        13,048 |         13,293 |
| Strategy          |         5,318 |          6,696 |
| BribeFactory      |         7,594 |          7,839 |
| BribeRouter       |         3,922 |          4,528 |
| Bribe             |         6,092 |          6,341 |
| Fund              |         4,169 |          4,453 |
| LiquidityPosition |         8,518 |         10,755 |

Every production contract was below EIP-170 and EIP-3860 limits in this configuration.

## Reward-token gas baseline

Command:

```text
forge test --match-contract SignalGasTest -vv
```

Captured measurements:

| Path                                                 |     Gas |
| ---------------------------------------------------- | ------: |
| `addSignal`, one reward token                        | 222,352 |
| `removeSignal`, one active reward token              |  76,137 |
| `removeSignal`, eight active reward tokens           | 534,519 |
| all-token `claimRewards`, eight active reward tokens | 752,732 |
| `Strategy.buy`, eight registered reward tokens       | 329,869 |
| `addSignal` marginal token slope                     |  13,629 |
| `removeSignal` marginal active-token slope           |  65,483 |

The baseline did not yet measure selective claims, Fund-bound payouts, token-eight registration, or a rejected ninth
registration; those are required final measurements, not inferred baseline values.

## Findings, deployment, and provenance state

Command:

```text
sed -n '1,420p' packages/contracts/audit/FINDINGS.md
find packages/config/deployments -maxdepth 2 -type f -print | sort
rg -n 'provisional|unresolved|signed|canonical|status|activation|release' packages/config/deployments docs/DEPLOYMENT.md
```

Captured current open findings relevant to this pass:

```text
A-02 Open: sub-index-resolution Resonance revenue is silently absorbed.
A-03 Open: Bribe rate flooring and zero-supply time strand reward value.
A-04 Open: a failed dead-Strategy transfer to Fund blocks signal removal.
A-06 Open: a caller can time LiquidityPosition composition when compounding.
A-08 Open: eight-token Bribe work is bounded but linear.
```

Accepted outcomes A-05 (late-fill ratchet) and A-07 (LP fees fund compounding) remain frozen. Deployment evidence is
unexecuted/provisional: authorization and control-plane policies are `unconfigured`; Uniswap v4 testnet dependencies
remain `unresolved`; no signed release manifest authorizes activation. No deployment was performed.

Licensing and provenance are unresolved release blockers involving give.fun, Liquid Signal Governance, Euler Fee Flow,
possible Solidly ancestry, possible Synthetix StakingRewards ancestry, and BUSL/MIT/GPL compatibility. The baseline has
no legal conclusion, clean-room claim, or license change. The mutation record has no defensible complete baseline score:
an earlier disposable-runner failure was stopped and explicitly did not claim a kill ratio. These blockers must remain
visible regardless of local test results.
