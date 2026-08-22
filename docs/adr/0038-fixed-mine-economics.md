# ADR 0038: Fixed Mine economics

- Status: partially superseded by ADR 0041's time-based model, ADR 0042's initial-rate and period values, and ADR
  0043's tail value; replacement-price constants remain accepted for development; not approved for deployment or user
  funds
- Date: 2026-08-21
- Supersedes: ADR 0024's constructor-configured Mine economics and every claim that the Mine values remain unselected

## Context

Mine previously accepted a five-field constructor `Config` for its replacement-price multiplier, auction-price floor,
initial global emission rate, cumulative halving amount, and positive tail rate. Bounds made those values immutable
after deployment, but still allowed a deployer to choose materially different protocol economics.

Mine is intended to have one legible economic schedule. Deployment-time flexibility adds validation, ABI surface, and
irreversible misconfiguration risk without serving a protocol requirement.

## Decision

Mine hard-codes these raw-unit constants:

| Constant                |               Value | Meaning                                                                               |
| ----------------------- | ------------------: | ------------------------------------------------------------------------------------- |
| `PRICE_MULTIPLIER`      |                 `2` | The next slot auction starts at twice the preceding payment before clamps.            |
| `MINIMUM_INITIAL_PRICE` |               `1e6` | Every empty or zero-price-reset auction starts at 1 USDG when USDG uses six decimals. |
| `MAX_INITIAL_PRICE`     | `type(uint192).max` | Dynamic slot starting prices retain the existing absolute ceiling.                    |
| `INITIAL_TPS`           |           `4 ether` | The initial global rate is 4 GBX per second.                                          |
| `HALVING_AMOUNT`        | `490_000_000 ether` | Superseded by ADR 0041 and removed from Mine.                                         |
| `TAIL_TPS`              |        `0.01 ether` | The prospective global rate never falls below 0.01 GBX per second.                    |

The Mine constructor accepts only GBX, USDG, and ResonanceRouter identities. `Mine.Config`, its range constants, its
configuration errors, and its immutable economic fields are removed. There is no setter or other administrative path.

Per-slot `initialPrice` remains state because every handoff starts a new auction at `2 * paid`, clamped to the fixed
floor and ceiling. Per-slot `tps` also remains state because a new tenure receives the current global rate divided by
sixteen and keeps that assigned rate until replacement.

## Consequences

- Deployments cannot select alternate Mine economics or accidentally encode a different schedule.
- The constructor ABI changes and every deployment, SDK ABI, subgraph ABI, and test fixture must use the three-address
  constructor.
- At the initial rate, sixteen same-generation occupied slots emit 14,400 GBX per hour in aggregate, or 900 GBX per
  slot per hour.
- The positive tail emits 315,360 GBX per year globally before tenure-lock transition effects.
- TypeScript and Python economic fixtures pin the same constants and remain independent calculation implementations.
- Selecting and modelling the constants does not constitute independent economic review, audit approval, deployment
  authorization, or a signed production manifest. Those gates remain open.
