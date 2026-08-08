import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Core starting point' };

const contracts = [
  'GBX',
  'Fundraiser',
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
  'TimelockController',
] as const;

const deploymentInputs = [
  'USDG, Uniswap v4, genesis price, and single-sided range inputs',
  'Project multisig and OpenZeppelin timelock delay',
  'Initial Strategy payment tokens and bounded auction parameters',
  'Independent security review and tested migration procedure',
] as const;

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="hero-grid rounded-[1.6rem] border border-[#75f7e7]/20 bg-[linear-gradient(145deg,rgba(20,41,41,.96),rgba(15,22,24,.92))] p-6 sm:p-10">
        <p className="inline-flex rounded-full border border-[#f4c56a]/25 bg-[#f4c56a]/10 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#f6d58f]">
          Local implementation evidence · not deployed
        </p>
        <h1 className="mt-7 max-w-4xl text-[2.5rem] font-semibold leading-[0.98] tracking-[-0.06em] text-white sm:text-[4rem]">
          The deliberately minimal GBX protocol.
        </h1>
        <p className="mt-6 max-w-3xl text-sm leading-7 text-[#a5b3b2] sm:text-base">
          USDG contributions flow through Resonance into signal-selected Strategies. Acquisitions grow Fund and reward
          signalers, buybacks burn GBX, and holders can redeem a caller-selected pro-rata basket without an asset
          registry.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Metric label="Lifetime mint ceiling" value="1,000,000,000 GBX" />
          <Metric label="Default acquisition split" value="90% Fund · 10% signalers" />
          <Metric label="Staking withdrawal lock" value="None" />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <Panel eyebrow="Architecture" title="Twelve core contracts plus standard timelock">
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
            <Definition label="Contribution revenue" value="Fundraiser → ResonanceRouter → Resonance" />
            <Definition label="v4 fees" value="GBX burned · USDG → ResonanceRouter" />
            <Definition label="Acquisition payment" value="90% Fund · 10% BribeRouter" />
            <Definition label="Buyback payment" value="100% GBX burned" />
            <Definition label="Signal" value="Replaceable at any time" />
            <Definition label="Redemption" value="Selected raw balances ÷ pre-burn GBX supply" />
          </dl>
        </Panel>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel eyebrow="Public guarantees" title="What contract code keeps narrow">
          <ul className="space-y-3 text-sm leading-6 text-[#a8b5b4]">
            <li>Burns never reopen lifetime mint capacity.</li>
            <li>Redemption always uses pre-burn supply and caller-selected Fund balances.</li>
            <li>Fund has no asset registry or protocol-wide token loop.</li>
            <li>Buyback burns its complete observed GBX payment atomically.</li>
            <li>SignalGBX (sGBX) withdrawals have no time lock after allocations are reset.</li>
            <li>Genesis supply is fixed at 20M for v4 liquidity and 980M for the Fundraiser schedule.</li>
          </ul>
        </Panel>

        <Panel eyebrow="Disclosed trust" title="Delayed mutable surfaces">
          <ul className="space-y-3 text-sm leading-6 text-[#a8b5b4]">
            <li>OpenZeppelin TimelockController owns Resonance, Fund, and LiquidityPosition.</li>
            <li>The project multisig proposes or cancels operations; anyone may execute after the delay.</li>
            <li>The signal-reward share is governable but cannot exceed 50%.</li>
            <li>Fund migration is one-way, same-GBX, token-selected, and moves complete balances only.</li>
          </ul>
        </Panel>
      </section>

      <Panel eyebrow="Deployment boundary" title="No production parameters are guessed">
        <p className="max-w-4xl text-sm leading-6 text-[#a8b5b4]">
          The local rehearsal uses deterministic mocks. A real deployment remains blocked until every external address
          and market parameter below is reviewed and supplied explicitly.
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
          This page exposes no wallet connection and submits no transaction. No production deployment addresses or
          release claims are implied by the local implementation.
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
