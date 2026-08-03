'use client';

import { Badge } from '@gumball-6900/ui';

import { useProtocolSnapshot } from '../../hooks/use-protocol-reads';
import { useRuntimeDeployment } from './runtime-context';

export function LiveEpochBadge() {
  const runtime = useRuntimeDeployment();
  const snapshot = useProtocolSnapshot();
  const rehearsal = runtime.mode === 'live' && runtime.runtimeKind === 'local-rehearsal';
  const testnetCandidate = runtime.mode === 'live' && runtime.runtimeKind === 'testnet-candidate';
  if (runtime.mode === 'live' && snapshot.source !== 'live') {
    return (
      <Badge tone="info">
        Epoch unavailable · {rehearsal ? 'rehearsal' : testnetCandidate ? 'testnet candidate' : 'production'}
      </Badge>
    );
  }
  return (
    <Badge tone={snapshot.source === 'live' && !rehearsal ? 'positive' : 'info'}>
      Epoch {snapshot.data.currentEpochId.toString()}{' '}
      {snapshot.source === 'live'
        ? rehearsal
          ? 'rehearsal'
          : testnetCandidate
            ? 'testnet candidate'
            : 'contract'
        : 'preview'}
    </Badge>
  );
}
