import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Minimal rebuild' };

const contracts = [
  'GBXToken',
  'EmissionController',
  'MiningPool',
  'MiningClaims',
  'StakedGBX',
  'AllocationVoter',
  'AcquisitionStrategy',
  'StrategyRewards',
  'BuybackStrategy',
  'GumBallVault',
  'AssetRegistry',
  'LiquidityCustodian',
  'ProtocolTimelock',
  'EmergencyGuardian',
] as const;

const deploymentInputs = [
  'USDG, Uniswap v4 PositionManager, and Permit2 addresses',
  'Initial sqrt price, fee tier, tick spacing, and one-sided tick range',
  'Protocol proposer, guardian operator, and optional team recipient',
  'Acquisition target, fixed USDG lots, and auction start/minimum prices',
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
          One 20M constructor mint creates a hookless, single-sided GBX/USDG position. Daily mining, liquid signals,
          fixed-lot auctions, real buyback burns, and unpausable raw-basket redemption remain; the public bootstrap,
          oracles, factories, generic execution, and broad upgrade machinery do not.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Metric label="Lifetime mint ceiling" value="1,000,000,000 GBX" />
          <Metric label="Genesis allocation" value="20,000,000 GBX" />
          <Metric label="Mining allocation" value="980,000,000 GBX" />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <Panel eyebrow="Architecture" title="Fourteen direct contracts">
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

        <Panel eyebrow="Immutable economics" title="Solidity-equivalent daily decay">
          <dl className="space-y-5">
            <Definition label="Initial daily emission" value="465,152.749681042811702004 GBX" />
            <Definition label="Daily decay factor" value="0.999525354337060160" />
            <Definition label="Epoch duration" value="1 day" />
            <Definition label="Non-empty epoch" value="Complete scheduled emission" />
            <Definition label="Empty epoch" value="Zero mint; schedule still advances" />
          </dl>
        </Panel>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel eyebrow="Public guarantees" title="What contract code keeps narrow">
          <ul className="space-y-3 text-sm leading-6 text-[#a8b5b4]">
            <li>Burns never reopen lifetime mint capacity.</li>
            <li>Redemption always uses pre-burn supply and every registered raw vault balance.</li>
            <li>AllocationVoter is a ledger and never holds USDG.</li>
            <li>Buyback burns observed GBX before the vault releases its fixed USDG lot.</li>
            <li>The guardian can stop new exposure but cannot block exits, claims, settlement, or fee collection.</li>
          </ul>
        </Panel>

        <Panel eyebrow="Disclosed trust" title="Delayed mutable surfaces">
          <ul className="space-y-3 text-sm leading-6 text-[#a8b5b4]">
            <li>A seven-day typed operation can replace the mining controller; the token cap still applies.</li>
            <li>A seven-day typed operation can transfer only the recorded canonical liquidity NFT.</li>
            <li>
              Typed strategy registration admits code that can direct its current signaled USDG budget to an arbitrary
              recipient; wiring checks are not code attestation.
            </li>
            <li>
              No proxy, generic target/calldata executor, arbitrary vault call, or principal-withdrawal method exists.
            </li>
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
          Distribution is also blocked by unresolved transitive licensing provenance disclosed in NOTICE. This page
          exposes no wallet connection and submits no transaction. Each auction remains inactive after deployment and
          begins at its full configured initial price only when its separate typed seven-day registration executes.
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
