'use client';

import { Badge, Card, SectionHeading } from '@gumball-6900/ui';

import { useRuntimeDeployment } from './runtime-context';

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export function RuntimeAdminCard() {
  const runtime = useRuntimeDeployment();
  const rehearsal = runtime.mode === 'live' && runtime.runtimeKind === 'local-rehearsal';
  const testnetCandidate = runtime.mode === 'live' && runtime.runtimeKind === 'testnet-candidate';
  return (
    <Card className="p-5 sm:p-6" tone="highlight">
      <SectionHeading eyebrow="Deployment manifest" title={runtime.chain.name} />
      <dl className="mt-6 space-y-4 text-xs">
        <div className="flex justify-between gap-4">
          <dt className="text-[#718080]">Chain ID</dt>
          <dd className="font-semibold text-white">{runtime.chain.id.toString()}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#718080]">Client mode</dt>
          <dd>
            <Badge
              tone={
                runtime.mode === 'live' && runtime.runtimeKind === 'production'
                  ? 'positive'
                  : runtime.mode === 'live'
                    ? 'info'
                    : 'warning'
              }
            >
              {runtime.mode === 'live'
                ? runtime.runtimeKind === 'local-rehearsal'
                  ? 'Local rehearsal'
                  : runtime.runtimeKind === 'testnet-candidate'
                    ? 'Testnet candidate'
                    : 'Validated live'
                : 'Safe demo'}
            </Badge>
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#718080]">Release</dt>
          <dd className="font-semibold text-white">{runtime.manifest?.version ?? 'Not loaded'}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#718080]">Manifest signatures</dt>
          <dd className="font-semibold text-[#7bf9e9]">
            {runtime.manifest === null
              ? 'Unavailable'
              : rehearsal
                ? 'Unsigned disposable fixture'
                : testnetCandidate
                  ? runtime.manifest.signatureThreshold === 0
                    ? 'Inactive testnet policy (0 / 0)'
                    : `${runtime.manifest.signatureCount.toString()} / ${runtime.manifest.signatureThreshold.toString()} candidate policy`
                  : `${runtime.manifest.signatureCount.toString()} / ${runtime.manifest.signatureThreshold.toString()} quorum`}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#718080]">Compliance mode</dt>
          <dd className="max-w-48 text-right font-semibold text-[#f2d18e]">
            {runtime.manifest?.complianceMode.replaceAll('-', ' ') ?? 'Unresolved'}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#718080]">Runtime gate</dt>
          <dd className="max-w-48 text-right font-semibold text-white">
            {runtime.mode === 'live'
              ? runtime.runtimeKind === 'local-rehearsal'
                ? 'Local-only testnet-candidate schema and address coverage passed'
                : runtime.runtimeKind === 'testnet-candidate'
                  ? 'Remote testnet-candidate schema, canonical bindings, and address coverage passed'
                  : 'Release-approved schema and address coverage passed'
              : `${runtime.issues.length.toString()} fail-closed notice${runtime.issues.length === 1 ? '' : 's'}`}
          </dd>
        </div>
      </dl>
      {runtime.mode === 'live' ? (
        <div className="mt-6 space-y-3 border-t border-white/8 pt-5">
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-white">
              {rehearsal
                ? 'Rehearsal asset metadata'
                : testnetCandidate
                  ? 'Candidate asset metadata'
                  : 'Signed asset metadata'}
            </summary>
            <div className="mt-3 space-y-2">
              {Object.values(runtime.assetMetadata).map((asset) => (
                <div className="rounded-xl border border-white/7 bg-black/10 p-3" key={asset.symbol}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-white">{asset.symbol}</span>
                    <span className="font-mono text-[0.65rem] text-[#91a09f]">{shortAddress(asset.address)}</span>
                  </div>
                  <p className="mt-1 text-[0.65rem] leading-5 text-[#718080]">
                    {asset.decimals.toString()} decimals ·{' '}
                    {asset.registryStatus.replace('ASSET_STATUS_', '').toLowerCase()}
                    {asset.uid === null ? '' : ` · UID ${asset.uid}`}
                  </p>
                </div>
              ))}
            </div>
          </details>
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-white">
              {rehearsal
                ? 'Rehearsal external contracts'
                : testnetCandidate
                  ? 'Candidate external contracts'
                  : 'Signed external contracts'}
            </summary>
            <div className="mt-3 space-y-2">
              {Object.entries(runtime.externalContracts).map(([key, contract]) => (
                <div className="rounded-xl border border-white/7 bg-black/10 p-3" key={key}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-white">{key}</span>
                    <span className="font-mono text-[0.65rem] text-[#91a09f]">{shortAddress(contract.address)}</span>
                  </div>
                  <a
                    className="mt-1 block text-[0.65rem] text-[#67f5e4] hover:underline"
                    href={contract.sourceUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {runtime.runtimeKind === 'local-rehearsal'
                      ? 'Rehearsal source'
                      : runtime.runtimeKind === 'testnet-candidate'
                        ? 'Candidate evidence source'
                        : 'Verification source'}{' '}
                    · block {contract.verifiedAtBlock}
                  </a>
                </div>
              ))}
            </div>
          </details>
        </div>
      ) : null}
    </Card>
  );
}
