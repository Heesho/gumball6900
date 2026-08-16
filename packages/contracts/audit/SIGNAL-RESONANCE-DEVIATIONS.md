# Deviations from the historical Bribe design

Status: reviewed local implementation record dated 2026-08-16.

Resonance remains recognizably Bribe-derived: it retains a duration, reward-rate schedule, cumulative reward-per-token
index, per-virtual-account paid index and accrued reward, checkpoint-before-weight-change ordering, and permissionless
fixed-recipient claims. The following differences are deliberate:

| Area             | Historical Bribe shape                  | Resonance implementation                                              | Reason                                           |
| ---------------- | --------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| Stakers          | Users custody staking receipts          | Strategies are virtual reward accounts                                | Users signal; Strategies acquire USDG            |
| Weight mutation  | Direct deposit/withdraw                 | SignalGBX-only `addSignalFor`, `removeSignalFor`, `moveSignalFor`     | One external coordinator and no duplicate ledger |
| Reward registry  | Up to eight tokens                      | USDG only                                                             | Protocol revenue has one immutable token         |
| Decimals         | Usually matching 18-decimal units       | 6-decimal USDG over 18-decimal signal                                 | `1e36` preserves useful index precision          |
| Period remainder | Bribe queues and pauses exact streams   | Quotient plus front-loaded raw remainder                              | Every scheduled USDG unit is represented         |
| Zero supply      | Bribe pauses stream time                | Elapsed USDG becomes unclaimable surplus                              | Required Resonance policy                        |
| Active top-up    | Bribe queues additions                  | Router waits; qualifying notification restarts with exact amount left | Preserves the Router threshold contract          |
| Claims           | Account or selected reward-token claims | Permissionless `distribute(strategy)`                                 | Revenue can only reach the fixed Strategy        |
| Death            | No Strategy lifecycle                   | Kill checkpoints, excludes weight once, preserves exits and claim     | Irreversible membership lifecycle                |
| Final member     | Not applicable                          | Final live Strategy cannot be killed                                  | Prevents a governance-created dead-end graph     |

Outside Resonance, SignalGBX adds exact GBX custody, non-transferable ERC20Votes receipts, atomic paired-Bribe
orchestration, and no idle receipt state. BribeRouter is not a historical Bribe component: it implements the fixed,
frequency-independent 90% Fund / 10% paired-Bribe acquired-asset classification and isolated pull settlement.

No upgrade, pause, rescue, migration, receiver redirection, or new owner role was introduced to obtain these behaviors.
`HistoricalBribeDifferentialTest` makes the common divisible-stream behavior and the front-loaded-remainder divergence
directly executable rather than relying on prose comparison alone.
