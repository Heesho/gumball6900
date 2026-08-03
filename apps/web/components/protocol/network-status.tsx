'use client';

import { Badge } from '@gumball-6900/ui';
import { useAccount, useChainId } from 'wagmi';

import { getRuntimeStatusCopy } from '../../lib/runtime-copy';
import { useRuntimeDeployment } from './runtime-context';

export function NetworkStatus() {
  const runtime = useRuntimeDeployment();
  const account = useAccount();
  const chainId = useChainId();
  const wrongNetwork = account.isConnected && chainId !== runtime.chain.id;
  const statusCopy = getRuntimeStatusCopy(runtime);

  return (
    <div className="hidden items-center gap-2 lg:flex">
      <Badge
        tone={
          runtime.mode === 'demo' || wrongNetwork
            ? 'warning'
            : runtime.runtimeKind === 'production'
              ? 'positive'
              : 'info'
        }
      >
        {wrongNetwork ? 'Wrong network' : statusCopy.networkLabel}
      </Badge>
      <span className="text-xs text-[#657373]">Chain ID {runtime.chain.id.toString()}</span>
    </div>
  );
}
