import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Governance-minimized final design' };

const contracts = [
  'GBX',
  'Mine',
  'LiquidityPosition',
  'SignalGBX (sGBX)',
  'ResonanceRouter',
  'Resonance',
  'StrategyFactory',
  'Strategy',
  'BribeFactory',
  'BribeRouter',
  'Bribe',
  'Fund',
  'ProtocolGovernor',
] as const;

const deploymentInputs = [
  'USDG, Uniswap v4, genesis price, and single-sided range inputs',
  'Timelock delay and immutable block-clock voting delay, period, threshold, and quorum',
  'Mine multiplier, minimum USDG price, initial GBX/second, halving amount, and positive tail',
  'Initial Strategy payment tokens and bounded auction parameters',
  'Independent security review of the immutable final bytecode',
  'Written third-party licensing and provenance clearance',
] as const;

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="hero-grid rounded-[1.6rem] border border-[#75f7e7]/20 bg-[linear-gradient(145deg,rgba(20,41,41,.96),rgba(15,22,24,.92))] p-6 sm:p-10">
        <p className="inline-flex rounded-full border border-[#f4c56a]/25 bg-[#f4c56a]/10 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#f6d58f]">
          Internally hardened candidate · not deployed · external audit pending
        </p>
        <h1 className="mt-7 max-w-4xl text-[2.5rem] font-semibold leading-[0.98] tracking-[-0.06em] text-white sm:text-[4rem]">
          The governance-minimized GBX protocol.
        </h1>
        <p className="mt-6 max-w-3xl text-sm leading-7 text-[#a5b3b2] sm:text-base">
          Deposit GBX directly into a Strategy signal to mint non-transferable sGBX and vote on four bounded protocol
          actions. Every completed Strategy payment is split 90% to Fund and 10% to that Strategy&apos;s Bribe, while
          holders can redeem a caller-selected pro-rata basket without an asset registry.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Metric label="Genesis GBX supply" value="20,000,000 GBX" />
          <Metric label="Strategy payment split" value="90% Fund · 10% Bribe" />
          <Metric label="Signal withdrawal lock" value="None" />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <Panel eyebrow="Architecture" title="Thirteen direct, non-upgradeable contracts">
          <div className="grid gap-2 sm:grid-cols-2">
            {contracts.map((contract, index) => (
              <div
                className="flex items-center gap-3 rounded-xl border border-white/7 bg-white/[0.025] px-3 py-2.5"
                key={contract}
              >
                <span className="w-6 text-right text-[0.65rem] font-bold text-[#5e706f]">{index + 1}</span>
                <code className="text-xs text-[#dfe8e6]">{contract}</code>
              </div>
            ))}
          </div>
        </Panel>

        <Panel eyebrow="Core economics" title="Simple, explicit value flows">
          <dl className="space-y-5">
            <Definition label="Mining revenue" value="20% Resonance · 80% displaced miner" />
            <Definition label="v4 position fees" value="USDG → Resonance · GBX → Fund burn · principal fixed" />
            <Definition label="Strategy payment" value="90% fixed Fund liability · 10% fixed Bribe liability" />
            <Definition label="GBX payment" value="Fund receipt · optional later burn" />
            <Definition label="Signal" value="Replaceable at any time" />
            <Definition label="Signal workflow" value="signal() / signalWithPermit() · withdrawSignal()" />
            <Definition label="Signal reward" value="Pro-rata Bribe stream from its explicit notifications" />
            <Definition label="Redemption" value="Selected raw balances ÷ pre-burn GBX supply" />
          </dl>
        </Panel>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel eyebrow="Target guarantees" title="What the final contract code must keep narrow">
          <ul className="space-y-3 text-sm leading-6 text-[#a8b5b4]">
            <li>GBX starts at 20M and permanently assigns future issuance to one immutable Mine.</li>
            <li>An occupied slot keeps its assigned TPS until replacement, including across halvings.</li>
            <li>Redemption uses minted plus pending pre-burn supply and caller-selected Fund balances.</li>
            <li>Fund has no asset registry or protocol-wide token loop.</li>
            <li>GBX payments remain supply-neutral until a permissionless Fund burn.</li>
            <li>Every sGBX unit is backed by an active Strategy signal; SignalGBX is the sole signal coordinator.</li>
            <li>GBX supports permit approvals; non-transferable sGBX supports votes but no approval permit.</li>
            <li>Mine has exactly sixteen ownerless slots and no all-slot checkpoint.</li>
            <li>The deployed core has no proxy, upgrade path, treasury recovery, or successor migration.</li>
            <li>Supported token movements fail closed unless sender debit and receiver credit are both exact.</li>
          </ul>
        </Panel>

        <Panel eyebrow="Governance" title="Three narrow timelocked actions">
          <ul className="space-y-3 text-sm leading-6 text-[#a8b5b4]">
            <li>Add a Strategy.</li>
            <li>Kill a Strategy.</li>
            <li>Add Bribe rewards.</li>
          </ul>
          <p className="mt-5 text-xs leading-5 text-[#778786]">
            SignalGBX voting power operates an immutable ProtocolGovernor, the Timelock&apos;s sole proposer. Its
            target, block-clock voting configuration, and three zero-value selectors cannot change. Execution is
            permissionless after the delay, with no multisig bypass, guardian, or queued-proposal veto.
          </p>
        </Panel>
      </section>

      <Panel eyebrow="Settlement observability" title="Streams, claims, and fixed liabilities stay visible">
        <p className="max-w-4xl text-sm leading-6 text-[#a8b5b4]">
          A blocked Strategy, Fund, or reward token cannot strand signal movement or withdrawal. Revenue and settlement
          liabilities keep immutable receivers and remain permissionlessly retryable. Reward holders can claim one token
          or a unique selected set so a broken token does not block healthy rewards.
        </p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <Definition label="Revenue stream" value="left(USDG) · distribute(strategy)" />
          <Definition
            label="Acquisition state"
            value="fundPaymentLiability → payFundPayment() · bribePaymentLiability → notifyBribeReward()"
          />
          <Definition label="Reward claims" value="claimReward() · claimRewards(account, tokens)" />
        </dl>
      </Panel>

      <Panel eyebrow="Deployment boundary" title="No production parameters are guessed">
        <p className="max-w-4xl text-sm leading-6 text-[#a8b5b4]">
          The local rehearsal uses deterministic mocks. The code is an internally hardened deployment candidate, but
          external addresses, market parameters, legal provenance, and independent review remain unresolved gates.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {deploymentInputs.map((input) => (
            <li
              className="rounded-xl border border-[#f4c56a]/15 bg-[#f4c56a]/[0.045] px-4 py-3 text-sm text-[#d9cfb9]"
              key={input}
            >
              {input}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs leading-5 text-[#778786]">
          This page exposes no wallet connection and submits no transaction. It describes the intended final design, not
          a claim that the current development contracts already enforce it.
        </p>
      </Panel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#758785]">{label}</p>
      <p className="mt-2 text-lg font-semibold tracking-[-0.035em] text-white">{value}</p>
    </div>
  );
}

function Panel({ children, eyebrow, title }: { children: React.ReactNode; eyebrow: string; title: string }) {
  return (
    <section className="rounded-[1.35rem] border border-white/8 bg-[#111719]/88 p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,.9)] sm:p-6">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#6debdc]">{eyebrow}</p>
      <h2 className="mb-5 mt-2 text-xl font-semibold tracking-[-0.04em] text-[#f3f7f6] sm:text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function Definition({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/7 pb-4 last:border-0 last:pb-0">
      <dt className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#718080]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-[#e1e8e7] tabular-nums">{value}</dd>
    </div>
  );
}
