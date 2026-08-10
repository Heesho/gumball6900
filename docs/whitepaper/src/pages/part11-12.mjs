/**
 * Part XI - Security and trust. Part XII - Using the protocol.
 */

import * as fig2 from '../figures2.mjs';
import { widths } from '../svg.mjs';
import { html, sectionHead, note, figureBlock, table, steps } from '../page-kit.mjs';
import { auditEvidence, status } from '../protocol-facts.mjs';

const n = (context, id) => context.sectionNumber(id);
const ev = auditEvidence;

export const part11Pages = [
  {
    id: 'security-goals',
    runner: 'Security goals and protections',
    group: 'Part XI · Security and trust',
    section: { title: 'Security goals and layered protections', note: 'What the design defends, and how' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part XI · Security and trust',
          number: n(context, 'security-goals'),
          title: 'Security goals and layered protections',
          deck: 'The design defends a short list of properties with several independent layers - and is explicit about the layer it still lacks.',
        })}
        ${figureBlock({
          index: context.figure('defense'),
          svg: fig2.defenseLayers({ width: widths.full }),
          caption:
            'Architecture, runtime checks, exact accounting, and testing reinforce each other. The dashed outer layer - independent review, deployment evidence, legal clearance - does not exist yet.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            ${table({
              className: 'table--tight',
              head: ['Protected property', 'Principal mechanisms'],
              rows: [
                ['Supply', 'Lifetime ceiling, locked minter, burns never reopen capacity'],
                [
                  'Contributions and settlement',
                  'Exact-transfer checks, atomic routing, buyer protections, 100% fixed liabilities',
                ],
                ['Signals and exits', 'Balance-bounded deltas, checkpoint-before-change, token-free exits'],
                ['Solvency', 'Exact scaled carry with tested conservation identities everywhere'],
                ['Redemption', 'One pre-burn snapshot, transient-storage duplicate checks, full atomicity'],
                ['Custody', 'Ownerless Fund and position, six-check NFT admission, fixed principal'],
              ],
            })}
            <p class="small muted stack-1">
              Cross-cutting: every token-moving entry point is reentrancy-guarded; every supported-token transfer
              verifies exact deltas on both sides; and all loops are bounded by the eight-token cap or caller-chosen
              batch sizes.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'In one sentence',
              body: 'The system tries to make every failure loud, local, and retryable - and every irreversible thing deliberate.',
            })}
            ${note({
              label: 'What testing cannot prove',
              kind: 'asset',
              body: 'Absence of evidence is not evidence of absence: no volume of passing tests demonstrates that no vulnerability exists.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'token-model',
    runner: 'The supported-token model',
    section: { title: 'The supported-token model', note: 'SafeERC20 is not a safety certificate' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part XI · Security and trust',
          number: n(context, 'token-model'),
          title: 'The supported-token model',
          deck: 'The contracts assume standard, non-rebasing, exact-transfer ERC-20 behavior. Everything outside that assumption fails closed - which is protection, not support.',
        })}
        <div class="spread">
          <div class="col-main">
            <p>
              A <em>supported</em> token moves exactly the requested amount, keeps honest balances, does not rebase, and
              cannot use callbacks to re-enter guarded code. The protocol's exact-delta checks mean unsupported behavior
              - transfer fees, sender surcharges, rebasing, dishonest <code>balanceOf</code> - causes clean reverts
              rather than silent mis-accounting. Pauses, blacklists, and upgrades are subtler: a token that freezes the
              protocol's address strands its own flows (its Fund liability, its reward stream, its redemption selection)
              while the architecture confines the damage - fixed destinations stay retryable, selective paths route
              around it, and signal exits never touch it.
            </p>
            <p>
              Each token class carries its own assumption set. <strong>USDG</strong> must behave for contributions,
              routing, and auctions to function at all - it is the load-bearing external dependency.
              <strong>GBX</strong> is protocol-authored and exact by construction.
              <strong>Payment and reward tokens</strong> are chosen by governance registration, and each one imports its
              issuer's whole rulebook. <strong>Redemption selections</strong> are chosen per call by the redeemer - the
              one place where token risk is entirely the user's own choice.
            </p>
            <p>
              <strong>Tokenized stocks deserve their own paragraph.</strong> A wrapper token linked to NVIDIA or Apple
              stock is a claim on an issuer's arrangement - custody, redemption terms, jurisdiction - not registered
              ownership of shares. Issuers can freeze, blacklist, upgrade, restrict transfers to certain hours, or be
              compelled by regulators; the underlying may be inaccessible in your jurisdiction; and none of this is
              visible to, or fixable by, this protocol. Holding such a token through the Fund is holding that entire
              legal stack.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Important risk',
              kind: 'asset',
              body: 'The open A-09 finding is decimal-sensitive: for 6-decimal tokens like USDG, carry buckets can reach whole-token size at extreme signal supply. Low-decimal reward tokens deserve extra skepticism.',
            })}
            ${note({
              label: 'For everyone',
              body: 'Before touching any Strategy, read its payment token like a contract - because it is one, written by someone else, changeable by someone else.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'dependencies',
    runner: 'Threats and dependencies',
    section: { title: 'The dependency map', note: 'Everything trusted, in one place' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part XI · Security and trust',
          number: n(context, 'dependencies'),
          title: 'The dependency map',
          deck: 'A protocol is never more trustworthy than the things it stands on. These are all of them.',
        })}
        ${figureBlock({
          index: context.figure('dependencies'),
          svg: fig2.dependencyMap({ width: widths.full }),
          caption:
            'Pinned versions where pinning is possible: OpenZeppelin 5.6.1, Uniswap v4 core 1.0.2 and periphery 1.0.3, Solidity 0.8.26. Chain-level facts were checked read-only at Robinhood Chain block 32,035,314.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            <p>
              Three dependency notes matter most. <strong>The chain:</strong> Fund redemption requires EIP-1153
              transient storage; internal review executed <code>TSTORE</code>/<code>TLOAD</code> successfully in an
              <code>eth_call</code> at the pinned block and recorded the documented Uniswap addresses and code hashes.
              <strong>The libraries:</strong> OpenZeppelin supplies the token standards, guards, and the
              TimelockController; Uniswap supplies the pool machinery; both are pinned, and the two known Solidity
              0.8.26 compiler bugs were reviewed as not applicable to this build configuration.
              <strong>The humans:</strong> multisig signers, volunteer maintenance callers, and every token issuer
              remain outside any pin.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Presentation is not protocol',
              kind: 'capital',
              body: 'The frontend and subgraph can be wrong, censored, or offline without affecting a single onchain rule. Anything that matters can be done and verified against the chain directly.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'evidence',
    runner: 'Internal testing evidence',
    section: { title: 'What was actually tested', note: 'Recorded numbers, and recorded gaps' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part XI · Security and trust',
          number: n(context, 'evidence'),
          title: 'What was actually tested',
          deck: 'Every number below is a recorded internal-engineering result. Blocked and invalid runs are listed with the same prominence as passes.',
        })}
        <div class="full">
          ${table({
            className: 'table--tight',
            head: ['Campaign', 'Tooling', 'Recorded result'],
            rows: [
              [
                'Unit and fuzz tests',
                'Foundry 1.7.1, solc 0.8.26',
                `${ev.foundry.defaultTests}/340 pass; ${ev.foundry.fuzzProperties} fuzz properties × ${ev.foundry.fuzzRunsPerProperty.toLocaleString('en-US')} runs. Re-run for this edition: 340/340.`,
              ],
              [
                'Stateful invariants',
                'Foundry invariant engine',
                `${ev.foundry.invariantProperties} properties × ${ev.foundry.invariantRunsPerProperty.toLocaleString('en-US')} runs × depth ${ev.foundry.invariantDepth} = ${ev.foundry.invariantAggregateCalls.toLocaleString('en-US')} calls, zero reverts, ${ev.foundry.invariantHandlerActions}-action reachability`,
              ],
              [
                'Uniswap v4 integration',
                'Genuine pinned v4 contracts',
                `17/17 pass; harvest exactness fuzzed ${ev.foundry.harvestFuzzCases.toLocaleString('en-US')} cases`,
              ],
              ['Compiler parity / supply', 'Hardhat 2.29.0', '2/2 pass'],
              [
                'Independent state fuzzing',
                'Medusa 1.5.1',
                `${ev.medusa.calls.toLocaleString('en-US')} calls, ${ev.medusa.branches.toLocaleString('en-US')} branches, ${ev.medusa.surfaces}`,
              ],
              [
                'Second fuzzer',
                'Echidna',
                'INVALID: pinned 2.3.2 blocked (no Docker); native 2.3.3 crashed at start (0/25). Release blocker.',
              ],
              [
                'Coverage (reduced profile)',
                'forge coverage',
                `${ev.coverage.lines} lines, ${ev.coverage.statements} statements, ${ev.coverage.branches} branches, ${ev.coverage.functions} functions`,
              ],
              [
                'Static analysis',
                'Slither, Aderyn, Semgrep, Solhint',
                `${ev.staticAnalysis.dispositionedFindings} findings dispositioned in ${ev.staticAnalysis.detectorClasses} classes; Semgrep 0; ${ev.staticAnalysis.gitleaksOpen} secret-scan matches await classification`,
              ],
              [
                'Mutation testing',
                'None pinned',
                'NO current-tree score exists; historical figures disowned. Release blocker.',
              ],
              ['Symbolic / formal', 'Mythril 0.24.8', 'Fails closed on Cancun opcodes. No formal proof exists.'],
              [
                'Fork validation',
                'JSON-RPC, read-only',
                `No current-graph fork ran. Chain ${ev.fork.chainId}, block ${ev.fork.block.toLocaleString('en-US')}: EIP-1153 verified, v4 code hashes recorded.`,
              ],
              [
                'Nightly deep profile',
                'Foundry nightly config',
                'Configured (100k fuzz; 10k invariant runs, depth 1,000) but never completed - not counted.',
              ],
            ],
          })}
        </div>
        <div class="spread stack-2">
          <div class="col-main">
            <p class="small muted">
              Commit precision, stated once more: the register names candidate ${status.auditCandidateCommitShort}...;
              production Solidity then changed (checked increments in the Fundraiser; the ADR 0022 harvest redesign) and
              the finalized campaign above was recorded against the resulting tree, committed as
              ${status.contractsCommitShort}.... The exact final commit therefore has recorded evidence but no
              separately signed re-review - a distinction a careful reader deserves.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'Not "audited"',
              kind: 'asset',
              body: 'These are internal results on internal infrastructure. Independent external audit: not completed. The word "audited" does not describe this system.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'findings',
    runner: 'The finding register',
    section: { title: 'The finding register', note: 'Seven findings, one open' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part XI · Security and trust',
          number: n(context, 'findings'),
          title: 'The finding register',
          deck: 'Internal adversarial review tracked its findings by identifier. Here is each one&rsquo;s final recorded state - none omitted.',
        })}
        ${figureBlock({
          index: context.figure('findings'),
          svg: fig2.findingsBoard({ width: widths.full }),
          caption:
            'Three High findings resolved by redesign; one Medium resolved by removal; one accepted with disclosure; one retained as a bounded cost; one open pending an owner and independent-reviewer decision.',
        })}
        <div class="spread stack-2">
          <div class="col-main">
            ${table({
              className: 'table--tight',
              head: ['ID', 'Severity', 'State', 'One-line substance'],
              rows: ev.findings.map((f) => [f.id, f.severity, f.status, f.summary]),
            })}
          </div>
          <div class="col-side">
            ${note({
              label: 'Where each is explained',
              body: 'A-02 and A-09 in Part V; A-03 and A-08 in Part VII; A-04 in Part IV; A-05 in Part VI; A-06 in Part IX. Every disclosure lives beside its mechanism.',
            })}
            ${note({
              label: 'Remaining release blockers',
              kind: 'asset',
              body: 'Independent audit; A-09 resolution or explicit acceptance; a real mutation campaign; a working second fuzzer; symbolic checks; secret-scan classification; legal and provenance clearance; signed deployment evidence.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'cannot-guarantee',
    runner: 'What cannot be guaranteed',
    section: { title: 'What the protocol cannot guarantee', note: 'The honest closing list' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part XI · Security and trust',
          number: n(context, 'cannot-guarantee'),
          title: 'What the protocol cannot guarantee',
          deck: 'A short chapter, on purpose. Everything here is outside any contract&rsquo;s reach, no matter how well the code works.',
        })}
        <div class="spread">
          <div class="col-main">
            ${steps([
              'That GBX has, holds, or ever reaches any particular value - there is no peg, no NAV, no floor.',
              'That mining is profitable on any day, or that miners participate at all.',
              'That any auction clears, clears well, or clears before reaching zero.',
              'That signaling earns anything - reward funding is voluntary and may never happen.',
              'That Fund assets keep value, stay transferable, or remain legally accessible - each answers to its issuer.',
              'That redemption yields anything worth having: it is a share of what is actually there, in kind.',
              'That volunteers perform unpaid maintenance promptly - settlement, distribution, harvesting, and burning all wait for someone.',
              'That immutable code is correct code: no amount of internal testing proves the absence of vulnerabilities, and what ships cannot be fixed.',
            ])}
            <p class="small muted stack-2">
              The affirmative guarantees this paper does make - supply ceilings, routing, settlement, exit liveness,
              atomic redemption, custody - are collected with their exact mechanisms in the appendices, each one stated
              as a testable property rather than an assurance.
            </p>
          </div>
          <div class="col-side">
            ${note({
              label: 'In one sentence',
              kind: 'asset',
              body: 'The contracts constrain behavior, not outcomes: they can make the game fair and its rules permanent - never make it a good game to play.',
            })}
          </div>
        </div>
      </div>
    `,
  },
];

export const part12Pages = [
  {
    id: 'guide-in',
    runner: 'Walkthroughs: putting value in',
    group: 'Part XII · Using the protocol',
    section: { title: 'Walkthroughs: mine, stake, signal', note: 'The inbound path, step by step' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part XII · Using the protocol',
          number: n(context, 'guide-in'),
          title: 'Walkthroughs: mine, stake, signal',
          deck: 'Assuming a wallet, gas, and verified contract addresses. Every step is a transaction you sign; nothing happens on your behalf.',
        })}
        <div class="spread">
          <div class="col-main">
            <h3>Contribute and claim (miner)</h3>
            ${steps([
              'Verify the Fundraiser address independently; approve it - or rather, approve nothing: contributions pull USDG via allowance to the router path, so set your USDG allowance for the Fundraiser first.',
              'Check the current epoch&rsquo;s scheduled emission and running total contributed - your eventual cost is total ÷ emission, and the day is not over.',
              'Call contribute(beneficiary, amount) - minimum 0.01 USDG; the beneficiary can be you or anyone.',
              'After the epoch ends, ensure it is settled (anyone can call settleEpochs), then claim(account, epoch). GBX mints straight to the beneficiary; claims never expire.',
            ])}
            <h3 class="stack-2">Stake and signal (signaler)</h3>
            ${steps([
              'Approve SignalGBX for your GBX, then stake(amount) - one sGBX per GBX, instantly.',
              'Pick live Strategies (check isStrategyAlive) and addSignal(strategy, amount) each, or batch with addSignalMany. Amounts are deltas from your unallocated balance.',
              'Adjust freely: removeSignal frees weight instantly; unstake(amount) returns GBX for anything unallocated.',
              'After a Strategy is killed: removeSignal still works - exits never depend on any token transfer.',
            ])}
          </div>
          <div class="col-side">
            ${note({
              label: 'For contributors',
              kind: 'capital',
              body: 'Your USDG is working - and at risk - from the moment it routes, which is the same transaction. There is no cancel, no refund, and no cooling-off.',
            })}
            ${note({
              label: 'Gas expectations',
              body: 'Signal operations walk the Strategy&rsquo;s reward-token list: entry from ~228k gas (one token) to ~337k (eight); exit up to ~1.34M at the cap. Budget accordingly.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'guide-out',
    runner: 'Walkthroughs: value out and upkeep',
    section: { title: 'Walkthroughs: buy, claim, redeem, maintain', note: 'The outbound path and the public levers' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part XII · Using the protocol',
          number: n(context, 'guide-out'),
          title: 'Walkthroughs: buy, claim, redeem, maintain',
          deck: 'Auction fills, reward claims, redemptions, and the unpaid maintenance calls anyone can make.',
        })}
        <div class="spread">
          <div class="col-main">
            <h3>Fill an auction (buyer)</h3>
            ${steps([
              'Read availableRevenue() (the lot), currentPrice() (the full-lot ask), and epochId. Judge lot ÷ price, not price alone.',
              'Approve the Strategy for the payment token, then buy(receiver, expectedEpochId, deadline, maximumPayment). All three protections are yours to set tightly.',
              'You receive the USDG immediately; the payment becomes a Fund liability anyone may deliver via the router&rsquo;s payFundPayment().',
            ])}
            <h3 class="stack-2">Claim rewards (signaler)</h3>
            ${steps([
              'Check earned(account, token) per registered token on the Strategy&rsquo;s Bribe.',
              'Prefer claimReward(account, token) or the selective claimRewards(account, tokens[]) - immune to any one broken token.',
            ])}
            <h3 class="stack-2">Redeem (holder)</h3>
            ${steps([
              'Inventory Fund balances offchain; drop dust and tokens you distrust.',
              'First do - or wait for - the free hygiene calls: settle GBX liabilities, then Fund.burnGBX(pendingGBX()); Fund-held GBX in the denominator dilutes you.',
              'Approve the Fund for your GBX and redeem(amount, receiver, tokens[]). One atomic transaction: your burn and every selected payout, or nothing.',
            ])}
            <h3 class="stack-2">Maintain (anyone)</h3>
            ${steps([
              'settleEpochs · distributeAll / distributeRange · indexPendingRevenue · syncRevenue · payFundRevenue · payFundPayment · payFundReward · harvestFees · burnGBX - all permissionless, all unpaid, all useful.',
            ])}
          </div>
          <div class="col-side">
            ${note({
              label: 'For auction buyers',
              kind: 'capital',
              body: 'Set maximumPayment barely above the current ask and a tight deadline. The epoch check already protects you from filling a re-opened, repriced round.',
            })}
            ${note({
              label: 'For redeemers',
              kind: 'asset',
              body: 'Omitted is forfeited. A reverted redemption costs gas but returns your GBX - the burn only survives if every selected payout does.',
            })}
          </div>
        </div>
      </div>
    `,
  },

  {
    id: 'checklists',
    runner: 'Safety checklists',
    section: { title: 'Safety checklists', note: 'Before you sign anything' },
    render: (context) => html`
      <div class="frame">
        ${sectionHead({
          eyebrow: 'Part XII · Using the protocol',
          number: n(context, 'checklists'),
          title: 'Safety checklists',
          deck: 'Seven roles, seven short lists. If a line fails, stop - the protocol will still be there tomorrow.',
        })}
        <div class="full">
          ${table({
            className: 'table--tight',
            head: ['Role', 'Check before acting'],
            rows: [
              [
                'Everyone',
                'Contract addresses verified from more than one independent source · this deployment actually exists and matches reviewed code (none does today) · wallet on the right chain · you can afford total loss',
              ],
              [
                'Contributor / miner',
                'Scheduled emission and running total for today · realistic exit liquidity for GBX · allowance no larger than needed · you accept that the day&rsquo;s final cost is unknown until it ends',
              ],
              [
                'Signaler',
                'Strategy is alive · you understand its payment token and issuer powers · reward-token list is what you expect (≤ 8) · exit gas at the current token count is acceptable',
              ],
              [
                'Auction buyer',
                'Lot ÷ ask beats your own valuation with margin · expectedEpochId is current · deadline tight · maximumPayment tight · payment-token allowance exact',
              ],
              [
                'Reward claimant',
                'earned() is worth the gas · claiming selectively · a claim triggered by someone else still only pays you',
              ],
              [
                'Redeemer',
                'Every selected token previewed and transferable · dust dropped · Fund-held GBX burned first · payout after flooring is still worth it · receiver address triple-checked',
              ],
              [
                'Maintenance caller',
                'The call actually has something to move · gas cost accepted as a gift to everyone · no assumption anyone will thank you',
              ],
              [
                'Multisig signer',
                'Proposal payload decoded and understood · targets one of the three real actions · community notice given · cancellation path rehearsed · keys stored like the protocol depends on them, because it does',
              ],
            ],
          })}
        </div>
        <p class="statement stack-2">
          The protocol cannot be paused, so it also cannot wait for you to be careless. <em>Verify, then sign.</em>
        </p>
      </div>
    `,
  },
];
