# Upstream provenance

Status: exact primary sources mechanically verified; chain-of-title/legal disposition remains a release blocker.

Verified references:

- [Curve Finance MultiRewards](https://github.com/curvefi/multi-rewards/blob/99995f90bd129bbe6b5a995daf6233fb79789e4e/contracts/MultiRewards.sol),
  commit `99995f90bd129bbe6b5a995daf6233fb79789e4e`, SHA-256
  `4b1f8145fc51fc234f3f445be33ebc1841da06cb78b4c23d6f651bfbf2ad554d`. The file uses exact Solidity `0.5.17`,
  has no file SPDX header, and its repository is MIT-licensed.
- [Euler Fee Flow](https://github.com/euler-xyz/fee-flow/blob/3bee858a1568d1313f37d615953f83391a897866/src/FeeFlowController.sol),
  commit `3bee858a1568d1313f37d615953f83391a897866`, SHA-256
  `b2ae9c1067bd6b6964bb1e91776d181ac89eefca69c9e3795f9229b393067abc`. The file is GPL-2.0-or-later, uses
  pragma `^0.8.13`, and that repository's Foundry configuration pins Solidity `0.8.24`.

The reward-kernel lineage is consistent with Curve MultiRewards through historical Liquid Signal code: last-applicable
time, quotient-only active-period rollover, cumulative index, earned calculation, and checkpoint-before-weight-change
ordering map directly. The auction kernel maps directly to Euler's linear decay, deadline/epoch/slippage guards,
multiplied next price, and min/max clamp.

This establishes behavioral provenance, not documentary chain of title. Current GumBall source is exact Solidity
`0.8.26` with file-level MIT headers, while root package metadata says BUSL-1.1 and no root `LICENSE` exists. Mine's
non-Euler multi-slot/emission behavior also has unresolved donut-miner ancestry and is not labeled original.

No upstream security credit is granted to GumBall-specific custody, authorization, lifecycle, cap, migration,
deployment, or launcher composition. Exact differential gaps are recorded in `SEMANTIC_DIFFS.md` and `COVERAGE.md`.

The four affected Solidity sources also carry scoped provenance footers after their closing contract braces. They name
the same pinned commit and source path, delimit the GumBall-specific behavior outside the attribution, and explicitly
deny inherited audit, endorsement, or security assurance. Footer placement preserves executable source locations used
by the exact static-finding register. Independent pre/post builds confirmed identical creation and deployed bytecode,
ABIs, and storage layouts.
