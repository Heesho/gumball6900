import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Governance-minimized development design' };

const contracts = [
  'GBX',
  'Mine',
  'SignalGBX (sGBX)',
  'ResonanceRouter',
  'Resonance',
  'StrategyFactory',
  'Strategy',
  'BribeFactory',
  'BribeRouter',
  'Bribe',
  'Fund',
] as const;

const deploymentInputs = [
  'Exact external governance release, plugins, permissions, voting parameters, and execution semantics',
  'Independent economic review of the hard-coded Mine multiplier, USDG floor, 64 GBX/second initial rate, 69-day periods, and 1 GBX/second tail',
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
          Deposit GBX directly into a Strategy signal to mint non-transferable sGBX with voting checkpoints for a future
          external governance integration. Strategy payments use one global Bribe share: 10% by default, adjustable from
          0% through 20%, with the complement going to Fund. Holders can redeem a caller-selected pro-rata basket
          without an asset registry.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Metric label="GBX premint" value="0 GBX" />
          <Metric label="Automatic Bribe share" value="10% default · 0–20%" />
          <Metric label="Signal withdrawal lock" value="None" />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <Panel eyebrow="Architecture" title="Eleven direct, non-upgradeable contracts">
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
            <Definition label="Mining revenue" value="20% Router deposit · 80% displaced miner" />
            <Definition label="LP exposure" value="Ordinary ERC-20 Strategy target" />
            <Definition label="Strategy payment" value="80–100% Fund · 0–20% paired Bribe" />
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
            <li>GBX starts at zero and permanently assigns issuance to one immutable Mine.</li>
            <li>An occupied slot keeps its assigned TPS until replacement, including across halvings.</li>
            <li>Redemption uses minted plus pending pre-burn supply and caller-selected Fund balances.</li>
            <li>Fund has no asset registry or protocol-wide token loop.</li>
            <li>GBX payments remain supply-neutral until a permissionless Fund burn.</li>
            <li>Every sGBX unit is backed by an active Strategy signal; SignalGBX is the sole signal coordinator.</li>
            <li>GBX supports permit approvals; non-transferable sGBX supports votes but no approval permit.</li>
            <li>Mine has exactly sixteen ownerless slots and no all-slot checkpoint.</li>
            <li>Mine deposits revenue into ResonanceRouter; later routing is a separate permissionless action.</li>
            <li>A 0% automatic Bribe rate leaves signaling, movement, withdrawal, and independent rewards live.</li>
            <li>The deployed core has no proxy, upgrade path, treasury recovery, or successor migration.</li>
            <li>Core transfers use SafeERC20 under the supported standard-token model.</li>
          </ul>
        </Panel>

        <Panel eyebrow="Governance" title="External integration pending">
          <ul className="space-y-3 text-sm leading-6 text-[#a8b5b4]">
            <li>Add a Strategy.</li>
            <li>Kill a Strategy.</li>
            <li>Add Bribe rewards.</li>
            <li>Set the global prospective automatic-Bribe share from 0% through 20%.</li>
          </ul>
          <p className="mt-5 text-xs leading-5 text-[#778786]">
            SignalGBX exposes ERC20Votes checkpoints, but this repository does not select or implement the governance
            system that will own Resonance. Deployment remains blocked until the exact external executor, permissions,
            voting rules, upgrade model, delay, cancellation behavior, and ownership handoff are reviewed.
          </p>
        </Panel>
      </section>

      <Panel eyebrow="Settlement observability" title="Streams, balances, and claims stay visible">
        <p className="max-w-4xl text-sm leading-6 text-[#a8b5b4]">
          A blocked Strategy or reward token cannot strand signal movement or withdrawal. Strategy pays Fund inline,
          while each BribeRouter buffers only its Bribe share for permissionless routing. Reward holders can claim one
          token to isolate a broken asset or claim every registered token in one call.
        </p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <Definition label="Revenue stream" value="remainingRevenue() · distributeRevenue(strategy)" />
          <Definition label="Acquisition state" value="Strategy → Fund · Strategy → BribeRouter → route()" />
          <Definition label="Reward claims" value="claimReward(account, token) · claimRewards(account)" />
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
